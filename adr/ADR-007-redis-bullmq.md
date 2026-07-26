# ADR-007: Redis + BullMQ for Queue System

## Status

Accepted

## Date

2025-01-15

## Context

We need a queue system for:

- Background job processing
- Scheduled tasks
- Rate limiting
- Caching
- Pub/Sub for events

## Decision

We will use Redis as the message broker with BullMQ for job queue management.

## Consequences

### Positive

- Redis is fast and reliable
- BullMQ provides job scheduling, retries, priorities
- Built-in rate limiting
- Caching capabilities
- Pub/Sub for event-driven architecture
- Good monitoring UI (Bull Board)

### Negative

- Redis is in-memory (data loss risk)
- Requires Redis server
- BullMQ adds complexity

### Mitigations

- Redis persistence configuration
- Docker for easy Redis setup
- BullMQ handles complexity well

## Use Cases

| Use Case | Solution |
|----------|----------|
| Job aggregation | BullMQ queue |
| AI analysis | BullMQ queue |
| Follow-up reminders | BullMQ delayed jobs |
| Notifications | BullMQ queue |
| Caching | Redis TTL |
| Rate limiting | Redis counters |
| Events | Redis Pub/Sub |

## BullMQ Features Used

- **Queues** for job types
- **Workers** for processing
- **Delayed jobs** for scheduling
- **Retries** for reliability
- **Concurrency** for parallel processing
- **Rate limiting** for API calls
- **Job priorities** for important tasks

## Configuration

```typescript
import { Queue, Worker } from 'bullmq';

const jobQueue = new Queue('jobs', {
  connection: { host: 'redis', port: 6379 },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
  },
});

const jobWorker = new Worker('jobs', async (job) => {
  // Process job
}, {
  connection: { host: 'redis', port: 6379 },
  concurrency: 5,
});
```

## Alternatives Considered

### RabbitMQ

Full-featured message broker.

**Rejected because:**
- Heavier setup
- More complex configuration
- Overkill for our needs

### SQS (AWS)

Cloud message queue.

**Rejected because:**
- Vendor lock-in
- Higher cost
- Less control

### Kafka

Event streaming platform.

**Rejected because:**
- Overkill for job processing
- Complex setup
- Higher resource usage

## References

- [BullMQ Documentation](https://docs.bullmq.io/)
- [Redis Documentation](https://redis.io/docs/)
