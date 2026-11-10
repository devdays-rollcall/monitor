package ru.itmo.grouptracking;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;
import javax.sql.DataSource;
import org.jboss.logging.Logger;
import ru.itmo.grouptracking.api.model.EventInput;
import ru.itmo.grouptracking.api.model.EventOutput;
import ru.itmo.grouptracking.api.model.EventPage;
import ru.itmo.grouptracking.api.model.LocationData;

@ApplicationScoped
public class EventStore {
    private static final Logger LOG = Logger.getLogger(EventStore.class);
    private final DataSource dataSource;
    private final ObjectMapper mapper;

    public EventStore(DataSource dataSource, ObjectMapper mapper) {
        this.dataSource = dataSource;
        this.mapper = mapper;
    }

    public void save(QueuedBatch batch) throws SQLException, JsonProcessingException {
        try (var connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);

            try {
                long groupId = upsertGroup(connection, batch);
                upsertMember(
                        connection, groupId, batch.batch().getSenderId(), batch.receivedAt(), true);

                for (var event : batch.batch().getEvents()) {
                    upsertMember(
                            connection, groupId, event.getMemberId(), batch.receivedAt(), false);
                    insertEvent(connection, groupId, event, batch.receivedAt());
                }

                connection.commit();
            } catch (SQLException | JsonProcessingException | RuntimeException exception) {
                connection.rollback();
                throw exception;
            }
        }
    }

    private long upsertGroup(Connection connection, QueuedBatch batch) throws SQLException {
        var sql =
                """
                insert into groups (token_hash, created_at, last_contact_at)
                values (?, now(), ?)
                on conflict (token_hash) do update
                set last_contact_at = greatest(groups.last_contact_at, excluded.last_contact_at)
                returning id
                """;

        try (var statement = connection.prepareStatement(sql)) {
            statement.setBytes(1, HexFormat.of().parseHex(batch.groupHash()));
            statement.setObject(2, batch.receivedAt());

            try (var result = statement.executeQuery()) {
                if (!result.next()) throw new SQLException("group upsert returned no id");
                return result.getLong(1);
            }
        }
    }

    private void upsertMember(
            Connection connection,
            long groupId,
            UUID memberId,
            OffsetDateTime receivedAt,
            boolean direct)
            throws SQLException {
        var sql =
                """
                insert into members (group_id, member_id, first_seen_at, last_direct_contact_at)
                values (?, ?, ?, ?)
                on conflict (group_id, member_id) do update
                set first_seen_at = least(members.first_seen_at, excluded.first_seen_at),
                    last_direct_contact_at = greatest(members.last_direct_contact_at, excluded.last_direct_contact_at)
                """;

        try (var statement = connection.prepareStatement(sql)) {
            statement.setLong(1, groupId);
            statement.setObject(2, memberId);
            statement.setObject(3, receivedAt);
            statement.setObject(4, direct ? receivedAt : null);
            statement.executeUpdate();
        }
    }

    private void insertEvent(
            Connection connection, long groupId, EventInput event, OffsetDateTime receivedAt)
            throws SQLException, JsonProcessingException {
        var data = mapper.writeValueAsString(event.getData());
        var sql =
                """
                insert into events (group_id, id, member_id, type, recorded_at, received_at, data)
                values (?, ?, ?, ?, ?, ?, cast(? as jsonb))
                on conflict (group_id, id) do nothing
                """;

        try (var statement = connection.prepareStatement(sql)) {
            statement.setLong(1, groupId);
            statement.setObject(2, event.getId());
            statement.setObject(3, event.getMemberId());
            statement.setString(4, event.getType().toString());
            statement.setObject(5, event.getRecordedAt());
            statement.setObject(6, receivedAt);
            statement.setString(7, data);

            if (statement.executeUpdate() == 0 && !sameEvent(connection, groupId, event, data)) {
                LOG.warnf("event conflict group_id=%d event_id=%s", groupId, event.getId());
            }
        }
    }

    private boolean sameEvent(Connection connection, long groupId, EventInput event, String data)
            throws SQLException {
        var sql =
                """
                select member_id = ? and type = ? and recorded_at = ? and data = cast(? as jsonb)
                from events
                where group_id = ? and id = ?
                """;

        try (var statement = connection.prepareStatement(sql)) {
            statement.setObject(1, event.getMemberId());
            statement.setString(2, event.getType().toString());
            statement.setObject(3, event.getRecordedAt());
            statement.setString(4, data);
            statement.setLong(5, groupId);
            statement.setObject(6, event.getId());

            try (var result = statement.executeQuery()) {
                return result.next() && result.getBoolean(1);
            }
        }
    }

    public EventPage page(String groupHash, int limit, long cursor)
            throws SQLException, JsonProcessingException {
        try (var connection = dataSource.getConnection()) {
            long groupId = findGroup(connection, groupHash);
            var sql =
                    """
                    select stored.sequence, stored.id, stored.member_id, stored.type,
                           stored.recorded_at, stored.received_at, stored.data
                    from (
                        select sequence from events
                        where group_id = ? and sequence > ?
                        order by sequence
                        limit ?
                    ) page
                    cross join lateral (
                        select sequence, id, member_id, type, recorded_at, received_at, data
                        from events where sequence = page.sequence offset 0
                    ) stored
                    order by page.sequence
                    """;
            var events = new ArrayList<EventOutput>();
            long lastSequence = cursor;
            boolean hasMore = false;

            try (var statement = connection.prepareStatement(sql)) {
                statement.setLong(1, groupId);
                statement.setLong(2, cursor);
                statement.setInt(3, limit + 1);

                try (var result = statement.executeQuery()) {
                    while (result.next()) {
                        if (events.size() == limit) {
                            hasMore = true;
                            break;
                        }

                        lastSequence = result.getLong("sequence");
                        var event =
                                new EventOutput()
                                        .id(result.getObject("id", UUID.class))
                                        .memberId(result.getObject("member_id", UUID.class))
                                        .type(
                                                EventOutput.TypeEnum.fromValue(
                                                        result.getString("type")))
                                        .recordedAt(
                                                result.getObject(
                                                        "recorded_at", OffsetDateTime.class))
                                        .receivedAt(
                                                result.getObject(
                                                        "received_at", OffsetDateTime.class))
                                        .data(
                                                mapper.readValue(
                                                        result.getString("data"),
                                                        LocationData.class));
                        events.add(event);
                    }
                }
            }

            var next = hasMore ? encodeCursor(lastSequence) : null;
            return new EventPage().events(events).nextCursor(next);
        }
    }

    private long findGroup(Connection connection, String groupHash) throws SQLException {
        var sql = "select id from groups where token_hash = ?";

        try (var statement = connection.prepareStatement(sql)) {
            statement.setBytes(1, HexFormat.of().parseHex(groupHash));

            try (var result = statement.executeQuery()) {
                if (!result.next()) throw new ApiFailure(404, "group_not_found", "group not found");
                return result.getLong(1);
            }
        }
    }

    public long decodeCursor(String cursor) {
        if (cursor == null) return 0;

        try {
            var bytes = Base64.getUrlDecoder().decode(cursor);
            var value = Long.parseLong(new String(bytes, java.nio.charset.StandardCharsets.UTF_8));

            if (value < 1 || !encodeCursor(value).equals(cursor))
                throw new IllegalArgumentException();
            return value;
        } catch (IllegalArgumentException exception) {
            throw new ApiFailure(400, "invalid_cursor", "cursor is invalid");
        }
    }

    private String encodeCursor(long value) {
        return Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(
                        Long.toString(value).getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
}
