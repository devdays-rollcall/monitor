package ru.itmo.grouptracking;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;
import java.util.regex.Pattern;
import ru.itmo.grouptracking.api.model.EventBatch;

@ApplicationScoped
public class RequestValidator {
    private static final int MAX_BODY_BYTES = 1024 * 1024;
    private static final Pattern TOKEN = Pattern.compile("Bearer ([A-Za-z0-9_-]{43})");
    private static final Pattern UUID_FORMAT =
            Pattern.compile(
                    "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");
    private final ObjectMapper mapper;

    public RequestValidator(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    public String groupHash(String authorization) {
        var match = TOKEN.matcher(authorization == null ? "" : authorization);

        if (!match.matches()) {
            throw new ApiFailure(401, "invalid_token", "group token is missing or invalid");
        }

        var token = match.group(1);

        try {
            var bytes = Base64.getUrlDecoder().decode(token);
            var encoded = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

            if (bytes.length != 32 || !encoded.equals(token)) {
                throw new IllegalArgumentException();
            }

            var digest =
                    MessageDigest.getInstance("SHA-256")
                            .digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (IllegalArgumentException exception) {
            throw new ApiFailure(401, "invalid_token", "group token is missing or invalid");
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    public EventBatch batch(String body) {
        if (body == null) {
            throw new ApiFailure(400, "invalid_request", "request body is required");
        }

        if (body.getBytes(StandardCharsets.UTF_8).length > MAX_BODY_BYTES) {
            throw new ApiFailure(413, "request_too_large", "request body is too large");
        }

        JsonNode root;

        try {
            root =
                    mapper.reader()
                            .with(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
                            .readTree(body);
        } catch (JsonProcessingException exception) {
            throw new ApiFailure(400, "invalid_request", "request body must be valid JSON");
        }

        validateBatch(root);

        try {
            return mapper.treeToValue(root, EventBatch.class);
        } catch (JsonProcessingException exception) {
            throw new ApiFailure(400, "invalid_request", "request body is invalid");
        }
    }

    void validateBatch(JsonNode root) {
        if (root == null
                || !root.isObject()
                || !validUuid(root.get("sender_id"))
                || !root.path("events").isArray()) {
            throw new ApiFailure(400, "invalid_request", "sender_id and events are required");
        }

        var events = root.get("events");

        if (events.size() > 500) {
            throw new ApiFailure(400, "invalid_request", "at most 500 events are allowed");
        }

        for (var event : events) {
            validateEvent(event);
        }
    }

    private void validateEvent(JsonNode event) {
        if (!event.isObject()
                || !validUuid(event.get("id"))
                || !validUuid(event.get("member_id"))) {
            throw invalidEvent("event id and member_id must be valid UUIDs");
        }

        if (!event.path("type").isTextual() || !event.path("type").asText().equals("location")) {
            throw invalidEvent("event type must be location");
        }

        try {
            var recordedAt = event.get("recorded_at");

            if (recordedAt == null || !recordedAt.isTextual()) {
                throw invalidEvent("recorded_at must be an RFC 3339 timestamp with a timezone");
            }

            OffsetDateTime.parse(recordedAt.asText());
        } catch (DateTimeParseException exception) {
            throw invalidEvent("recorded_at must be an RFC 3339 timestamp with a timezone");
        }

        var data = event.get("data");

        if (data == null || !data.isObject()) {
            throw invalidEvent("data must be an object");
        }

        number(data, "latitude", true, -90, 90, false);
        number(data, "longitude", true, -180, 180, false);
        number(data, "accuracy_m", false, 0, Double.MAX_VALUE, false);
        number(data, "altitude_m", false, -Double.MAX_VALUE, Double.MAX_VALUE, false);
        number(data, "speed_mps", false, 0, Double.MAX_VALUE, false);
        number(data, "bearing_deg", false, 0, 360, true);

        var battery = data.get("battery_percent");

        if (battery != null
                && (!battery.isIntegralNumber()
                        || !battery.canConvertToInt()
                        || battery.intValue() < 0
                        || battery.intValue() > 100)) {
            throw invalidEvent("battery_percent must be an integer between 0 and 100");
        }
    }

    private void number(
            JsonNode data,
            String field,
            boolean required,
            double minimum,
            double maximum,
            boolean exclusiveMaximum) {
        var value = data.get(field);

        if (value == null && !required) {
            return;
        }

        if (value == null
                || !value.isNumber()
                || !Double.isFinite(value.doubleValue())
                || value.doubleValue() < minimum
                || (exclusiveMaximum
                        ? value.doubleValue() >= maximum
                        : value.doubleValue() > maximum)) {
            throw invalidEvent(field + " is outside the valid range");
        }
    }

    private boolean validUuid(JsonNode value) {
        if (value == null || !value.isTextual() || !UUID_FORMAT.matcher(value.asText()).matches()) {
            return false;
        }

        try {
            UUID.fromString(value.asText());
            return true;
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }

    private ApiFailure invalidEvent(String message) {
        return new ApiFailure(422, "invalid_event", message);
    }
}
