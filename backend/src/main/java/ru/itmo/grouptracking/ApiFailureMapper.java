package ru.itmo.grouptracking;

import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import ru.itmo.grouptracking.api.model.ErrorDetail;
import ru.itmo.grouptracking.api.model.ErrorResponse;

@Provider
public class ApiFailureMapper implements ExceptionMapper<ApiFailure> {
    @Override
    public Response toResponse(ApiFailure failure) {
        var detail = new ErrorDetail().code(failure.code()).message(failure.getMessage());
        var body = new ErrorResponse().error(detail);

        return Response.status(failure.status())
                .type(MediaType.APPLICATION_JSON)
                .entity(body)
                .build();
    }
}
