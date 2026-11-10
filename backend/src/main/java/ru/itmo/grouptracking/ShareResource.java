package ru.itmo.grouptracking;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.security.SecureRandom;
import java.sql.SQLException;
import java.util.Base64;
import org.jboss.logging.Logger;
import ru.itmo.grouptracking.api.model.ShareToken;

@Path("/api/v1/share-links")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
public class ShareResource {
    private static final Logger LOG = Logger.getLogger(ShareResource.class);
    private final RequestValidator validator;
    private final EventStore store;
    private final SecureRandom random = new SecureRandom();

    public ShareResource(RequestValidator validator, EventStore store) {
        this.validator = validator;
        this.store = store;
    }

    @POST
    public Response create(@HeaderParam("Authorization") String authorization) {
        var groupHash = validator.groupHash(authorization);
        var bytes = new byte[32];
        random.nextBytes(bytes);
        var token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        var shareHash = validator.groupHash("Bearer " + token);

        try {
            store.createShareToken(groupHash, shareHash);
            return Response.status(201)
                    .header("Cache-Control", "no-store")
                    .entity(new ShareToken().token("view_" + token))
                    .build();
        } catch (SQLException exception) {
            LOG.warn("share link creation failed", exception);
            throw new ApiFailure(503, "unavailable", "event storage is unavailable");
        }
    }
}
