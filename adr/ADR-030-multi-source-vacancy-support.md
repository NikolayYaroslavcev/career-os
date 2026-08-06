# ADR-030: Multi-Source Vacancy Support

## Status

Accepted

## Date

2026-07-23

## Context

A single job vacancy can appear across multiple sources: an ATS (Greenhouse),
a job board (RemoteOK), community channels (HN Hiring, Telegram), and RSS
feeds. Before this ADR, each source created a separate Vacancy record,
leading to duplicates in search results, fragmented application tracking, and
inconsistent data.

## Decision

Introduce a canonical vacancy model where one Vacancy aggregate owns multiple
VacancySource records. A single canonical vacancy merges data from all its
sources using a priority-based strategy.

## Architecture

### Core Entities

```
Vacancy (canonical)
├── id: UUID (primary key)
├── title: string
├── description: string
├── companyId: FK → Company
├── location: string
├── remote: RemoteType (ONSITE | REMOTE | HYBRID | UNKNOWN)
├── employmentType: string
├── salaryMin / salaryMax / currency
├── experienceLevel: string
├── isActive: boolean
├── publishedAt: DateTime
├── sources: VacancySource[] (one-to-many)
├── mergeAudits: VacancyMergeAudit[] (one-to-many)
└── applications: Application[]
```

```
VacancySource
├── id: UUID (primary key)
├── providerType: ProviderType (ATS | JOB_BOARD | COMMUNITY | MANUAL)
├── providerId: string (e.g. "greenhouse", "remote_ok", "telegram")
├── externalId: string (ID in the source system)
├── sourceUrl: string? (link to listing)
├── applyUrl: string? (direct application link)
├── status: SourceStatus (ACTIVE | EXPIRED | REMOVED | BROKEN)
├── isPrimary: boolean
├── discoveredAt / lastSeenAt: DateTime
├── lastSuccessfulSync: DateTime?
├── lastFailedSync: DateTime?
├── failureCount: number
├── metadata: JSON?
└── vacancyId: FK → Vacancy
```

```
VacancyMergeAudit
├── id: UUID (primary key)
├── vacancyId: FK → Vacancy
├── field: string (what changed)
├── oldValue / newValue: JSON
├── sourceId / sourceName: string
├── providerType: ProviderType
├── reason: string?
└── mergedAt: DateTime
```

### Provider Types and Priority

Each provider has a numeric priority. Lower number = higher authority:

| Priority | Type       | Providers                                                          |
| -------- | ---------- | ------------------------------------------------------------------ |
| 1        | ATS        | greenhouse, lever, ashby, workday, smartrecruiters, recruitee, teamtailor |
| 2        | Job Board  | remote_ok, remotive, hh, habr_career, linkedin, wellfound, otta   |
| 3        | Community  | hn_hiring, rss_feed, company_career_page, telegram                |
| 4        | Manual     | manual                                                             |

ATS sources are treated as authoritative: their data overrides job boards
and community sources during merge.

### Canonical Matching

When a new vacancy arrives from any source, the system checks for an existing
canonical vacancy using weighted multi-field scoring:

| Field           | Weight |
| --------------- | ------ |
| title           | 0.30   |
| company         | 0.30   |
| location        | 0.15   |
| remote type     | 0.10   |
| employment type | 0.05   |
| salary overlap  | 0.10   |

A match score >= 0.75 is considered a duplicate. The existing vacancy becomes
the canonical record, and the new source is attached to it.

Title and company matching use Levenshtein similarity with normalization
(lowercase, strip punctuation, collapse whitespace).

### Source Lifecycle

```
ACTIVE ──sync success──> ACTIVE (failureCount reset)
ACTIVE ──sync failure──> ACTIVE (failureCount incremented)
ACTIVE ──3 failures───> BROKEN
ACTIVE ──absent from sync──> EXPIRED
EXPIRED ──appears again──> ACTIVE
* ──manual removal──> REMOVED
```

When a source is marked REMOVED or EXPIRED, the Vacancy remains active if
any other source is still ACTIVE. The Vacancy is only deactivated when all
sources are inactive.

### Apply URL Strategy

`applyUrl` lives on VacancySource. The canonical Vacancy exposes a computed
`primaryApplyUrl` derived from the highest-priority ACTIVE source that has
one. If no source has an `applyUrl`, falls back to `sourceUrl`. No URL
duplication occurs.

### Merge Audit

Whenever canonical Vacancy data changes because a higher-priority source
provides different values, a VacancyMergeAudit record is created:

```typescript
{
  field: "title",
  oldValue: "Software Eng",
  newValue: "Software Engineer",
  sourceId: "src-123",
  sourceName: "greenhouse",
  providerType: "ATS",
  reason: "Higher priority source override"
}
```

### Synchronization Flow

```
1. Provider adapter fetches jobs (ATS API, RSS feed, etc.)
2. NormalizationService normalizes raw data
3. DeduplicationService detects changes (new/removed/changed)
4. For each NEW_JOB event:
   a. CanonicalMatchingService checks existing vacancies
   b. If match found: attach new VacancySource to existing Vacancy
   c. If no match: create new canonical Vacancy
   d. Record merge audit if data was updated
5. SourceLifecycleService updates source status
6. Primary apply URL is recomputed
```

## Consequences

### Positive
- Unlimited sources per vacancy without duplication
- Authoritative ATS data always wins during merge
- Full audit trail for every data change
- Source health tracking enables dashboards and alerting
- Vacancy survives individual source failures

### Negative
- Slightly more complex sync pipeline
- Merge audit table grows over time (mitigated by TTL/archival)

## Update (2026-07-30)

RemoteOK, cited above as the example job-board source, was deprecated and
removed — see ADR-034. The multi-source model itself is unaffected: it was
designed to tolerate any single source disappearing.

## Testing

23 new tests covering:
- Source entity lifecycle (create, sync success/failure, BROKEN state)
- Canonical matching scoring (identical, similar, different vacancies)
- Source priority and apply URL computation
- Source health tracking
- Existing 692 tests continue to pass (no regressions)
