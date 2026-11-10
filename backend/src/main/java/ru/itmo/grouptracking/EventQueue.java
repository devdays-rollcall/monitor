package ru.itmo.grouptracking;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.nats.client.Connection;
import io.nats.client.JetStreamApiException;
import io.nats.client.JetStreamSubscription;
import io.nats.client.Nats;
import io.nats.client.Options;
import io.nats.client.PullSubscribeOptions;
import io.nats.client.api.AckPolicy;
import io.nats.client.api.ConsumerConfiguration;
import io.nats.client.api.RetentionPolicy;
import io.nats.client.api.StorageType;
import io.nats.client.api.StreamConfiguration;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import java.io.IOException;
import java.time.Duration;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@ApplicationScoped
public class EventQueue {
    private static final String STREAM = "GROUP_EVENTS";
    private static final String SUBJECT = "group.events.batch";
    private static final String CONSUMER = "events-writer";
    private final String url;
    private final ObjectMapper mapper;
    private Connection connection;

    public EventQueue(@ConfigProperty(name = "nats.url") String url, ObjectMapper mapper) {
        this.url = url;
        this.mapper = mapper;
    }

    public void publish(QueuedBatch batch)
            throws IOException, JetStreamApiException, InterruptedException {
        var payload = mapper.writeValueAsBytes(batch);
        connection().jetStream().publish(SUBJECT, payload);
    }

    public JetStreamSubscription subscribe()
            throws IOException, JetStreamApiException, InterruptedException {
        var config =
                ConsumerConfiguration.builder()
                        .durable(CONSUMER)
                        .ackPolicy(AckPolicy.Explicit)
                        .ackWait(Duration.ofSeconds(30))
                        .maxDeliver(-1)
                        .build();
        var options =
                PullSubscribeOptions.builder().stream(STREAM)
                        .durable(CONSUMER)
                        .configuration(config)
                        .build();

        return connection().jetStream().subscribe(SUBJECT, options);
    }

    private synchronized Connection connection()
            throws IOException, InterruptedException, JetStreamApiException {
        if (connection != null && connection.getStatus() == Connection.Status.CONNECTED) {
            return connection;
        }

        if (connection != null && connection.getStatus() != Connection.Status.CLOSED) {
            throw new IOException("NATS is reconnecting");
        }

        var options =
                new Options.Builder()
                        .server(url)
                        .connectionTimeout(Duration.ofSeconds(2))
                        .reconnectWait(Duration.ofSeconds(2))
                        .maxReconnects(-1)
                        .build();
        var opened = Nats.connect(options);

        try {
            var management = opened.jetStreamManagement();

            try {
                management.getStreamInfo(STREAM);
            } catch (JetStreamApiException exception) {
                if (exception.getApiErrorCode() != 10059) throw exception;

                var config =
                        StreamConfiguration.builder()
                                .name(STREAM)
                                .subjects(SUBJECT)
                                .storageType(StorageType.File)
                                .retentionPolicy(RetentionPolicy.WorkQueue)
                                .maxAge(Duration.ofHours(24))
                                .build();

                try {
                    management.addStream(config);
                } catch (JetStreamApiException conflict) {
                    management.getStreamInfo(STREAM);
                }
            }

            var stream = management.getStreamInfo(STREAM).getConfiguration();

            if (stream.getRetentionPolicy() != RetentionPolicy.WorkQueue
                    || !Duration.ofHours(24).equals(stream.getMaxAge())) {
                throw new IOException("GROUP_EVENTS has incompatible retention settings");
            }

            connection = opened;
            return connection;
        } catch (IOException | JetStreamApiException | RuntimeException exception) {
            opened.close();
            throw exception;
        }
    }

    @PreDestroy
    public synchronized void close() {
        if (connection == null) return;

        try {
            connection.close();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }
    }
}
