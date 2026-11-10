package ru.itmo.grouptracking;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Base64;
import org.junit.jupiter.api.Test;

class RequestValidatorTest {
    private final ObjectMapper mapper = mapper();
    private final RequestValidator validator = new RequestValidator(mapper);
    private final String token =
            Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[32]);

    private static ObjectMapper mapper() {
        var mapper = new ObjectMapper().findAndRegisterModules();
        new JsonConfiguration().customize(mapper);
        return mapper;
    }

    @Test
    void acceptsCanonicalTokenAndRejectsNonCanonicalToken() {
        assertEquals(64, validator.groupHash("Bearer " + token).length());
        var failure =
                assertThrows(
                        ApiFailure.class,
                        () -> validator.groupHash("Bearer " + token.substring(0, 42) + "B"));
        assertEquals(401, failure.status());
    }

    @Test
    void acceptsHeartbeat() {
        var batch =
                validator.batch(
                        """
                {"sender_id":"c9c7458e-3d19-4e20-ae5d-dbc3ec6f4af1","events":[]}
                """);
        assertTrue(batch.getEvents().isEmpty());
    }

    @Test
    void preservesLocationAndUnknownProperties() throws Exception {
        var batch =
                validator.batch(
                        """
                {"sender_id":"c9c7458e-3d19-4e20-ae5d-dbc3ec6f4af1","events":[
                  {"id":"d8a6b9f0-32b1-4b1d-a186-a86f2e401a11","member_id":"c9c7458e-3d19-4e20-ae5d-dbc3ec6f4af1",
                   "type":"location","recorded_at":"2026-11-09T12:00:00Z",
                   "data":{"latitude":43.3499,"longitude":42.4453,"battery_percent":0,"extra":"kept","empty":"preserved"}}
                ]}
                """);
        var json =
                mapper.readTree(mapper.writeValueAsString(batch.getEvents().getFirst().getData()));

        assertEquals(43.3499, json.get("latitude").doubleValue());
        assertEquals(42.4453, json.get("longitude").doubleValue());
        assertEquals(0, json.get("battery_percent").intValue());
        assertEquals("kept", json.get("extra").textValue());
        assertEquals("preserved", json.get("empty").textValue());
        assertNotNull(batch.getEvents().getFirst().getRecordedAt());
        assertFalse(json.has("speed_mps"));
    }

    @Test
    void rejectsInvalidCoordinatesAndMissingTimezone() {
        var invalidLatitude =
                """
                {"sender_id":"c9c7458e-3d19-4e20-ae5d-dbc3ec6f4af1","events":[
                  {"id":"d8a6b9f0-32b1-4b1d-a186-a86f2e401a11","member_id":"c9c7458e-3d19-4e20-ae5d-dbc3ec6f4af1",
                   "type":"location","recorded_at":"2026-11-09T12:00:00Z","data":{"latitude":91,"longitude":42}}
                ]}
                """;
        var failure = assertThrows(ApiFailure.class, () -> validator.batch(invalidLatitude));
        assertEquals(422, failure.status());
        assertEquals(
                422,
                assertThrows(
                                ApiFailure.class,
                                () ->
                                        validator.batch(
                                                invalidLatitude
                                                        .replace("91", "43")
                                                        .replace("00Z", "00")))
                        .status());
    }
}
