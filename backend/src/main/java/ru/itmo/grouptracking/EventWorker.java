package ru.itmo.grouptracking;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.nats.client.Message;
import io.quarkus.runtime.ShutdownEvent;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import java.io.IOException;
import java.sql.SQLException;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicBoolean;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

@ApplicationScoped
public class EventWorker {
    private static final Logger LOG = Logger.getLogger(EventWorker.class);
    private final EventQueue queue;
    private final EventStore store;
    private final ObjectMapper mapper;
    private final RequestValidator validator;
    private final String role;
    private final AtomicBoolean running = new AtomicBoolean();
    private Thread thread;

    public EventWorker(
            EventQueue queue,
            EventStore store,
            ObjectMapper mapper,
            RequestValidator validator,
            @ConfigProperty(name = "app.role") String role) {
        this.queue = queue;
        this.store = store;
        this.mapper = mapper;
        this.validator = validator;
        this.role = role;
    }

    void start(@Observes StartupEvent event) {
        if (!role.equals("worker")) return;

        running.set(true);
        thread = Thread.ofPlatform().name("events-writer").daemon(true).start(this::consume);
    }

    void stop(@Observes ShutdownEvent event) {
        running.set(false);

        if (thread != null) {
            thread.interrupt();

            try {
                thread.join(5000);
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
            }
        }
    }

    private void consume() {
        while (running.get()) {
            try {
                var subscription = queue.subscribe();

                while (running.get()) {
                    for (var message : subscription.fetch(1, Duration.ofSeconds(2))) {
                        process(message);
                    }
                }
            } catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                return;
            } catch (Exception exception) {
                if (running.get()) LOG.warn("queue unavailable, retrying", exception);

                try {
                    Thread.sleep(Duration.ofSeconds(2));
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    return;
                }
            }
        }
    }

    private void process(Message message) {
        QueuedBatch batch;

        try {
            batch = mapper.readValue(message.getData(), QueuedBatch.class);

            if (batch == null
                    || batch.groupHash() == null
                    || !batch.groupHash().matches("[0-9a-f]{64}")
                    || batch.receivedAt() == null
                    || batch.batch() == null
                    || batch.batch().getSenderId() == null
                    || batch.batch().getEvents() == null) {
                throw new IllegalArgumentException("invalid queued batch");
            }

            validator.validateBatch(mapper.valueToTree(batch.batch()));
        } catch (IOException | IllegalArgumentException | ApiFailure exception) {
            LOG.errorf(
                    "invalid queued message stream_sequence=%d",
                    message.metaData().streamSequence());
            message.term();
            return;
        }

        try {
            store.save(batch);
            message.ack();
        } catch (SQLException | JsonProcessingException | RuntimeException exception) {
            LOG.warnf(
                    "could not save batch stream_sequence=%d; retrying",
                    message.metaData().streamSequence());
            message.nakWithDelay(Duration.ofSeconds(30));
        }
    }
}
