package ru.itmo.grouptracking;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Objects;
import java.util.UUID;
import javax.sql.DataSource;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;
import ru.itmo.grouptracking.api.model.AlertResult;
import ru.itmo.grouptracking.api.model.AlertState;

@Path("/api/v1")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
public class AlertResource {
    private static final Logger LOG = Logger.getLogger(AlertResource.class);
    private final RequestValidator validator;
    private final EventStore store;
    private final DataSource dataSource;
    private final String publicUrl;
    private final String internalUrl;
    private final HttpClient http =
            HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    public AlertResource(
            RequestValidator validator,
            EventStore store,
            DataSource dataSource,
            @ConfigProperty(name = "ntfy.public-url") String publicUrl,
            @ConfigProperty(name = "ntfy.internal-url") String internalUrl) {
        this.validator = validator;
        this.store = store;
        this.dataSource = dataSource;
        this.publicUrl = publicUrl.replaceAll("/+$", "");
        this.internalUrl = internalUrl.replaceAll("/+$", "");
    }

    @GET
    @Path("/alert")
    public Response get(
            @HeaderParam("Authorization") String authorization,
            @HeaderParam("X-Observer-Key") String observerKey) {
        return Response.ok(execute(authorization, observerKey, null, Action.READ, null, null))
                .header("Cache-Control", "no-store")
                .build();
    }

    @POST
    @Path("/alert")
    public Response raise(
            @HeaderParam("Authorization") String authorization,
            @HeaderParam("X-Alert-Source") String source,
            @HeaderParam("X-Alert-Member-Id") String memberId) {
        if (source == null) source = "observer";
        if (!source.equals("observer") && !source.equals("sos"))
            throw new ApiFailure(400, "invalid_source", "invalid alert source");
        UUID member = null;
        if (memberId != null) {
            try {
                member = UUID.fromString(memberId);
                if (!member.toString().equalsIgnoreCase(memberId)
                        || member.version() != 4
                        || !source.equals("sos")) throw new IllegalArgumentException();
            } catch (IllegalArgumentException exception) {
                throw new ApiFailure(400, "invalid_member", "invalid SOS member id");
            }
        }
        var state = execute(authorization, null, null, Action.RAISE, source, member);
        var topic =
                UUID.fromString(
                        state.getSubscriptionUrl().getPath().substring("/rollcall-".length()));
        return Response.ok(
                        new AlertResult()
                                .notified(notify(topic, source, member, state.getUsername())))
                .header("Cache-Control", "no-store")
                .build();
    }

    @DELETE
    @Path("/alert")
    public Response confirm(
            @HeaderParam("Authorization") String authorization,
            @HeaderParam("X-Observer-Key") String observerKey,
            @HeaderParam("X-Alert-Id") String alertId) {
        return Response.ok(execute(authorization, observerKey, alertId, Action.CONFIRM, null, null))
                .header("Cache-Control", "no-store")
                .build();
    }

    @POST
    @Path("/observers")
    public Response register(
            @HeaderParam("Authorization") String authorization,
            @HeaderParam("X-Observer-Key") String observerKey) {
        execute(authorization, observerKey, null, Action.REGISTER, null, null);
        return Response.noContent().header("Cache-Control", "no-store").build();
    }

    private AlertState execute(
            String authorization,
            String observerKey,
            String alertId,
            Action action,
            String source,
            UUID member) {
        boolean readOnly =
                authorization != null
                        && authorization.length() == 55
                        && authorization.startsWith("Bearer view_");
        if (readOnly && "sos".equals(source))
            throw new ApiFailure(403, "forbidden", "SOS requires a group key");
        var hash =
                validator.groupHash(
                        readOnly ? "Bearer " + authorization.substring(12) : authorization);
        byte[] observer =
                observerKey == null && action != Action.REGISTER
                        ? null
                        : HexFormat.of().parseHex(validator.groupHash("Bearer " + observerKey));

        try (var connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            try {
                long groupId = store.findGroup(connection, hash, readOnly);
                var sql =
                        "select notification_topic, alert_active, alert_id, alert_source, alert_member_id from groups where id = ?"
                                + (action == Action.READ ? "" : " for update");
                UUID topic;
                boolean active;
                UUID currentAlert;
                String currentSource;
                UUID currentMember;
                try (var statement = connection.prepareStatement(sql)) {
                    statement.setLong(1, groupId);
                    try (var result = statement.executeQuery()) {
                        if (!result.next())
                            throw new ApiFailure(404, "group_not_found", "group not found");
                        topic = result.getObject(1, UUID.class);
                        active = result.getBoolean(2);
                        currentAlert = result.getObject(3, UUID.class);
                        currentSource = result.getString(4);
                        currentMember = result.getObject(5, UUID.class);
                    }
                }

                if (action == Action.REGISTER) {
                    try (var statement =
                            connection.prepareStatement(
                                    "insert into alert_observers (group_id, observer_hash) values (?, ?) on conflict do nothing")) {
                        statement.setLong(1, groupId);
                        statement.setBytes(2, observer);
                        statement.executeUpdate();
                    }
                }
                if (action == Action.RAISE
                        && (!active
                                || (source.equals("sos")
                                        && (!"sos".equals(currentSource)
                                                || (member != null
                                                        && !Objects.equals(
                                                                member, currentMember)))))) {
                    currentAlert = UUID.randomUUID();
                    currentSource = source;
                    currentMember = member;
                    updateActive(
                            connection, groupId, true, currentAlert, currentSource, currentMember);
                    deleteApprovals(connection, groupId);
                    active = true;
                }

                var state = counts(connection, groupId, observer);
                if (action == Action.CONFIRM) {
                    if (!active || currentAlert == null || !currentAlert.toString().equals(alertId))
                        throw new ApiFailure(409, "alert_changed", "alert has changed");
                    updateActive(connection, groupId, false, null, null, null);
                    currentMember = null;
                    currentSource = null;
                    currentAlert = null;
                    deleteApprovals(connection, groupId);
                    active = false;
                    state = counts(connection, groupId, observer);
                }
                String username = null;
                if (active && currentMember != null) {
                    try (var statement =
                            connection.prepareStatement(
                                    "select username from events where group_id = ? and member_id = ? and username is not null order by sequence desc limit 1")) {
                        statement.setLong(1, groupId);
                        statement.setObject(2, currentMember);
                        try (var result = statement.executeQuery()) {
                            if (result.next()) username = result.getString(1);
                        }
                    }
                }
                connection.commit();
                return new AlertState()
                        .active(active)
                        .alertId(currentAlert)
                        .memberId(active ? currentMember : null)
                        .username(username)
                        .source(
                                active
                                        ? AlertState.SourceEnum.fromValue(
                                                currentSource == null ? "unknown" : currentSource)
                                        : null)
                        .subscriptionUrl(URI.create(publicUrl + "/rollcall-" + topic))
                        .observers(state.observers())
                        .approvals(state.approvals())
                        .requiredApprovals(1)
                        .registered(state.registered())
                        .approved(state.approved());
            } catch (SQLException | RuntimeException exception) {
                connection.rollback();
                throw exception;
            }
        } catch (SQLException exception) {
            LOG.warn("alert operation failed", exception);
            throw new ApiFailure(503, "unavailable", "event storage is unavailable");
        }
    }

    private Counts counts(Connection connection, long groupId, byte[] observer)
            throws SQLException {
        var sql =
                """
                select (select count(*) from alert_observers where group_id = ?),
                       (select count(*) from alert_approvals where group_id = ?),
                       exists (select 1 from alert_observers where group_id = ? and observer_hash = ?),
                       exists (select 1 from alert_approvals where group_id = ? and observer_hash = ?)
                """;
        try (var statement = connection.prepareStatement(sql)) {
            statement.setLong(1, groupId);
            statement.setLong(2, groupId);
            statement.setLong(3, groupId);
            statement.setBytes(4, observer);
            statement.setLong(5, groupId);
            statement.setBytes(6, observer);
            try (var result = statement.executeQuery()) {
                if (!result.next()) throw new SQLException("alert count returned no row");
                return new Counts(
                        result.getInt(1),
                        result.getInt(2),
                        result.getBoolean(3),
                        result.getBoolean(4));
            }
        }
    }

    private void updateActive(
            Connection connection,
            long groupId,
            boolean active,
            UUID alertId,
            String source,
            UUID member)
            throws SQLException {
        try (var statement =
                connection.prepareStatement(
                        "update groups set alert_active = ?, alert_id = ?, alert_source = ?, alert_member_id = ? where id = ?")) {
            statement.setBoolean(1, active);
            statement.setObject(2, alertId);
            statement.setString(3, source);
            statement.setObject(4, member);
            statement.setLong(5, groupId);
            statement.executeUpdate();
        }
    }

    private void deleteApprovals(Connection connection, long groupId) throws SQLException {
        try (var statement =
                connection.prepareStatement("delete from alert_approvals where group_id = ?")) {
            statement.setLong(1, groupId);
            statement.executeUpdate();
        }
    }

    private boolean notify(UUID topic, String source, UUID member, String username) {
        var request =
                HttpRequest.newBuilder(URI.create(internalUrl + "/rollcall-" + topic))
                        .timeout(Duration.ofSeconds(10))
                        .header("Title", "Rollcall")
                        .header("Priority", "high")
                        .POST(
                                HttpRequest.BodyPublishers.ofString(
                                        source.equals("sos")
                                                ? (member == null
                                                        ? "Участник группы отправил SOS. Проверьте маршрут."
                                                        : "SOS от участника "
                                                                + (username == null
                                                                        ? member
                                                                        : username + " (" + member
                                                                                + ")")
                                                                + ". Проверьте маршрут.")
                                                : "Наблюдатель просит проверить маршрут группы."))
                        .build();
        try {
            return http.send(request, HttpResponse.BodyHandlers.discarding()).statusCode() / 100
                    == 2;
        } catch (IOException exception) {
            return false;
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    private enum Action {
        READ,
        RAISE,
        REGISTER,
        CONFIRM
    }

    private record Counts(int observers, int approvals, boolean registered, boolean approved) {}
}
