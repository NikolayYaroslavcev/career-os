# ADR-005: BullMQ with Redis for Job Queues

## Status

Accepted

## Date

2026-01-15

## Context

CareerOS has background work:
- Job aggregation from multiple sources (runs daily)
- AI analysis of vacancies (CPU/IO intensive)
- Follow-up reminder scheduling
- Notification sending
- Resume processing

These tasks cannot run in the HTTP request cycle. We need:
- Reliable job execution
- Delayed/scheduled jobs
- Retry logic
- Concurrency control
- Monitoring

## Decision

BullMQ as the job queue library, Redis as the backend.

## BullMQ over Alternatives

### over Bull (v3)
- Better TypeScript support
- Modern API
- Active maintenance
- Better Redis compatibility

### over Agenda
- MongoDB-based (we use PostgreSQL)
- Less reliable at scale

### over RabbitMQ
- Simpler setup
- Redis already in stack
- Less infrastructure overhead
- Good enough for our scale

### over AWS SQS
- Vendor lock-in
- Additional cost
- More complex local development

### over pg-boss
- PostgreSQL-based (could work)
- Redis better for queue use cases
- BullMQ more mature

## Queue Design

### Queues

| Queue | Purpose | Concurrency |
|-------|---------|-------------|
| job-aggregation | Fetch jobs from providers | 1 |
| job-matching | AI analysis of vacancies | 3 |
| follow-up-check | Check for due follow-ups | 1 |
| notification | Send notifications | 5 |
| resume-processing | Parse and analyze resumes | 2 |

### Job Types

```typescript
// packages/shared/src/queues/job-types.ts
interface JobAggregationJob {
  providerName: string;
  searchCriteria: SearchCriteria;
}

interface JobMatchingJob {
  jobId: string;
  userId: string;
  resumeId: string;
}

interface FollowUpCheckJob {
  applicationId: string;
}

interface NotificationJob {
  userId: string;
  channel: NotificationChannel;
  type: NotificationType;
  title: string;
  body: string;
}
```

### Scheduling

```typescript
// Aggregation: daily at 6 AM
await queue.add('aggregate', { providerName: 'HH' }, {
  repeat: { cron: '0 6 * * *' },
});

// Follow-up check: every hour
await queue.add('check-follow-ups', {}, {
  repeat: { cron: '0 * * * *' },
});
```

## Consequences

### Positive
- Reliable job execution with retries
- Delayed jobs for follow-up scheduling
- Concurrency control per queue
- Job progress tracking
- Redis already in stack

### Negative
- Redis becomes critical infrastructure
- Job state in Redis (not PostgreSQL)
- Monitoring requires additional tooling

### Mitigations
- Redis persistence configured
- Bull Board for queue monitoring
- Health checks include Redis connectivity

## Worker Architecture

```typescript
// apps/worker/src/worker.ts
import { Worker } from 'bullmq';

const jobAggregationWorker = new Worker(
  'job-aggregation',
  async (job) => {
    const provider = providerRegistry.get(job.data.providerName);
    const jobs = await provider.fetchJobs(job.data.searchCriteria);
    // Process and store jobs
  },
  { connection: redis, concurrency: 1 }
);
```

## Retry Strategy

| Queue | Retries | Backoff |
|-------|---------|---------|
| job-aggregation | 3 | exponential, 60s base |
| job-matching | 2 | exponential, 30s base |
| follow-up-check | 1 | fixed, 5min |
| notification | 3 | exponential, 10s base |

## Alternatives Considered

1. **pg-boss**: Considered. BullMQ chosen for Redis synergy.
2. **Agenda**: Rejected. MongoDB dependency.
3. **Custom scheduler**: Rejected. Re-inventing the wheel.
