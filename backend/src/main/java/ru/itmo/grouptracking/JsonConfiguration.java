package ru.itmo.grouptracking;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import io.quarkus.jackson.ObjectMapperCustomizer;
import jakarta.inject.Singleton;
import java.io.IOException;
import ru.itmo.grouptracking.api.model.LocationData;

@Singleton
public class JsonConfiguration implements ObjectMapperCustomizer {
    @Override
    public void customize(ObjectMapper mapper) {
        mapper.addMixIn(LocationData.class, LocationFields.class);
    }

    @JsonSerialize(using = LocationSerializer.class)
    abstract static class LocationFields {}

    public static class LocationSerializer extends JsonSerializer<LocationData> {
        @Override
        public void serialize(LocationData data, JsonGenerator json, SerializerProvider provider)
                throws IOException {
            json.writeStartObject();
            json.writeObjectField("latitude", data.getLatitude());
            json.writeObjectField("longitude", data.getLongitude());
            writeOptional(json, "accuracy_m", data.getAccuracyM());
            writeOptional(json, "altitude_m", data.getAltitudeM());
            writeOptional(json, "speed_mps", data.getSpeedMps());
            writeOptional(json, "bearing_deg", data.getBearingDeg());
            writeOptional(json, "battery_percent", data.getBatteryPercent());

            for (var entry : data.entrySet()) {
                json.writeObjectField(entry.getKey(), entry.getValue());
            }

            json.writeEndObject();
        }

        private void writeOptional(JsonGenerator json, String name, Object value)
                throws IOException {
            if (value != null) json.writeObjectField(name, value);
        }
    }
}
