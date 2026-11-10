package ru.itmo.grouptracking;

import java.time.OffsetDateTime;
import ru.itmo.grouptracking.api.model.EventBatch;

public record QueuedBatch(String groupHash, OffsetDateTime receivedAt, EventBatch batch) {}
