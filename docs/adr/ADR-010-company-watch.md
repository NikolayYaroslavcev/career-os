# ADR-010: Company Watch Subsystem

## Status

Accepted

## Date

2026-07-21

## Context

The existing provider system aggregates jobs from job boards (RemoteOK, HH, etc.). Users want to monitor specific companies directly, regardless of which ATS they use. This requires a new subsystem that:

- Manages a registry of companies
- Adapts to multiple ATS types
- Detects job changes (new, removed, changed)
- Notifies users of new opportunities

## Decision

Create a dedicated `company-watch` package with:

- Domain entities following DDD patterns
- ATS adapters implementing a common interface
- BullMQ-based scheduler for independent polling
- Integration with existing notification system

## Architecture

```
Company Registry (Prisma/PostgreSQL)
       ↓
Company Watch Scheduler (BullMQ)
       ↓
ATS Adapter (per company)
       ↓
Normalization
       ↓
Deduplication
       ↓
Notifications (Telegram)
```

## Components

### Database Models

- **CompanyWatch**: Company being monitored with ATS config
- **CompanyWatchEvent**: Events detected during sync (NEW_JOB, REMOVED_JOB, CHANGED_JOB)
- **CompanyWatchSyncLog**: Audit trail for sync operations

### ATS Adapters

**Phase 1 (Core 5):**
- Greenhouse
- Lever
- Ashby
- Workday
- Teamtailor

**Fallbacks:**
- Custom HTML (scrapes careers pages)
- JSON-LD (parses structured data)

**Phase 2 (Future):**
- SmartRecruiters
- Recruitee
- Personio
- BambooHR

### Services

- **CompanyWatchService**: Main orchestration service
- **NormalizationService**: Normalizes job data from different ATS formats
- **DeduplicationService**: Detects new/removed/changed jobs
- **CompanyDiscoveryService**: Auto-detects ATS type from URL

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/company-watch` | List watched companies |
| POST | `/api/v1/company-watch` | Add company to watch list |
| GET | `/api/v1/company-watch/:id` | Get company details |
| PUT | `/api/v1/company-watch/:id` | Update company config |
| DELETE | `/api/v1/company-watch/:id` | Remove from watch list |
| POST | `/api/v1/company-watch/:id/sync` | Trigger immediate sync |
| GET | `/api/v1/company-watch/:id/events` | List detected events |
| POST | `/api/v1/company-watch/discover` | Auto-detect ATS from URL |

### Dashboard

- Company Watch page at `/app/company-watch`
- Company list with status indicators
- Add company button (manual or via discovery)

## Consequences

### Positive

- Users can monitor specific companies, get timely notifications
- Reuses existing patterns (adapters, BullMQ, notifications)
- Core 5 ATS adapters cover ~80% of target companies
- Custom HTML + JSON-LD fallbacks for unknown ATS types

### Negative

- Adds complexity with adapter implementations
- Each ATS may have rate limits or change APIs

### Mitigations

- Adapter interface allows easy addition of new ATS types
- Per-company polling intervals respect rate limits
- Sync logs provide audit trail for debugging

## Deferred

- AI Ranking feature (will be added in a follow-up phase)
- Remaining 4 ATS adapters (SmartRecruiters, Recruitee, Personio, BambooHR)

## References

- ADR-003: Provider/Adapter Pattern for External Services
- ADR-005: Queue System (BullMQ)
- ADR-007: Notification System
