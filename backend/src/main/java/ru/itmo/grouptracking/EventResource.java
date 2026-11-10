package ru.itmo.grouptracking;

import io.nats.client.JetStreamApiException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.jboss.logging.Logger;
import ru.itmo.grouptracking.api.model.Accepted;

@Path("/api/v1/events")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
public class EventResource {
    private static final Logger LOG = Logger.getLogger(EventResource.class);
    private final RequestValidator validator;
    private final EventQueue queue;
    private final EventStore store;

    public EventResource(RequestValidator validator, EventQueue queue, EventStore store) {
        this.validator = validator;
        this.queue = queue;
        this.store = store;
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    public Response post(@HeaderParam("Authorization") String authorization, String body) {
        var receivedAt = OffsetDateTime.now(ZoneOffset.UTC);
        var hash = validator.groupHash(authorization);
        var batch = validator.batch(body);

        try {
            queue.publish(new QueuedBatch(hash, receivedAt, batch));
            return Response.accepted(new Accepted().accepted(batch.getEvents().size())).build();
        } catch (IOException | JetStreamApiException exception) {
            LOG.warn("queue publication failed", exception);
            throw new ApiFailure(503, "unavailable", "event queue is unavailable");
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new ApiFailure(503, "unavailable", "event queue is unavailable");
        }
    }

    @GET
    public Response get(
            @HeaderParam("Authorization") String authorization,
            @QueryParam("limit") String limitValue,
            @QueryParam("cursor") String cursorValue) {
        boolean readOnly =
                authorization != null
                        && authorization.length() == 55
                        && authorization.startsWith("Bearer view_");
        var hash =
                validator.groupHash(
                        readOnly ? "Bearer " + authorization.substring(12) : authorization);
        int limit = parseLimit(limitValue);
        long cursor = store.decodeCursor(cursorValue);

        try {
            return Response.ok(store.page(hash, limit, cursor, readOnly))
                    .header("Cache-Control", "no-store")
                    .build();
        } catch (SQLException | IOException exception) {
            LOG.warn("event read failed", exception);
            throw new ApiFailure(503, "unavailable", "event storage is unavailable");
        }
    }

    private int parseLimit(String value) {
        if (value == null) return 500;

        try {
            int limit = Integer.parseInt(value);

            if (limit < 1 || limit > 1000) throw new NumberFormatException();
            return limit;
        } catch (NumberFormatException exception) {
            throw new ApiFailure(400, "invalid_limit", "limit must be between 1 and 1000");
        }
    }
}
