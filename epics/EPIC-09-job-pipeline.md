# EPIC-09: Job Pipeline

## Status

**Complete.** `sync-scheduler-service.ts` and the BullMQ worker (`apps/worker`) run aggregation, normalization, deduplication, AI analysis, and ranking; see ADR-023 (job processing pipeline) and ADR-026/ADR-027 for the decoupled-search and diagnostics work that followed.

## Duration

4-5 days

## Dependencies

EPIC-06 (Job Providers)

## Objective

Create automated job discovery and analysis pipeline.

## Tasks

### TASK-09-01: Aggregation Worker
- [ ] Create BullMQ worker
- [ ] Schedule job aggregation
- [ ] Add error handling

### TASK-09-02: Normalization Pipeline
- [ ] Create normalization flow
- [ ] Validate job data
- [ ] Handle edge cases

### TASK-09-03: Deduplication Pipeline
- [ ] Create deduplication flow
- [ ] Compare with existing jobs
- [ ] Handle conflicts

### TASK-09-04: AI Analysis Pipeline
- [ ] Create analysis flow
- [ ] Call AI provider
- [ ] Parse results

### TASK-09-05: Ranking Logic
- [ ] Create ranking algorithm
- [ ] Sort by match score
- [ ] Apply user preferences

### TASK-09-06: Notification Triggers
- [ ] Trigger on new match
- [ ] Send high-priority notifications
- [ ] Batch low-priority notifications

### TASK-09-07: Monitoring
- [ ] Add job metrics
- [ ] Add error tracking
- [ ] Add performance monitoring

## Deliverables

- Aggregation worker running
- Normalization pipeline
- Deduplication pipeline
- AI analysis pipeline
- Ranking logic
- Notification triggers

## Acceptance Criteria

- [ ] Jobs are aggregated automatically
- [ ] Jobs are normalized correctly
- [ ] Duplicates are removed
- [ ] AI analysis works
- [ ] Rankings are accurate
- [ ] Notifications sent
