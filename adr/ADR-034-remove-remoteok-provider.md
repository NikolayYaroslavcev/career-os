# ADR-034: Remove RemoteOK Provider

## Status

Accepted

## Date

2026-07-30

## Context

RemoteOK was one of the original three job providers (alongside HH and Habr
Career, see EPIC-06 / ADR-030) and was registered unconditionally in
`apps/backend/src/container.ts` — no config required, always active, same
tier as HH.

The product decision was made to stop sourcing vacancies from RemoteOK.
Because it was unconditionally registered, its vacancies had no special
handling — they flowed through `ProviderSearchService` →
`VacancySource`/`Vacancy` persistence → AI Vacancy Matching exactly like
every other source's, with no filter to disable. Removing the provider
registration (and its already-persisted rows) was the only way to stop
RemoteOK vacancies from reaching matching and search.

## Decision

Remove RemoteOK entirely rather than disable it behind a flag:

- Delete `packages/providers/src/providers/remoteok/` (fetcher, mapper,
  normalizer, sync strategy, provider, tests, fixtures) and its exports from
  `packages/providers/src/index.ts`
- Unregister it from `apps/backend/src/container.ts`
- Remove it from every config/enum layer: `source-priority` (both the
  backend config and the `@careeros/career` domain enum), `VacancySource`
  enum, sync-interval maps, provider display-name maps
- Remove it from the dashboard's provider filter UI
- Delete existing `VacancySource`/orphaned `Vacancy` rows sourced only from
  RemoteOK in local dev (1,440 `VacancySource` rows / 1,439 vacancies at
  time of removal)
- Update test fixtures that used `remote_ok` as a generic example provider
  id to use another still-live provider instead
- Update living docs (`CURRENT_FEATURES.md`, `JOB_PROVIDERS.md`, `README.md`,
  `LOCAL_DEVELOPMENT.md`, `ROADMAP.md`, `requirements.md`, `mvp-scope.md`)
  to drop RemoteOK from active/shipped provider lists

Not touched: historical migration SQL, dated audit/research reports, and
ADR prose that cites RemoteOK as a contemporaneous example of "a job board"
— those describe the state at the time they were written, not current state.

## Consequences

### Positive
- No more RemoteOK vacancies reaching AI Vacancy Matching, search, or
  recommendations
- One fewer external dependency / sync job to maintain
- No orphaned code paths — the package is deleted, not just unregistered

### Negative
- Fewer global remote listings until/unless another global aggregator
  (Remotive, Himalayas, etc. — already live) picks up the slack
- Historical `VacancySource` rows referencing `remote_ok` in any
  non-local environment are not automatically cleaned by this ADR (local
  dev only, per product decision) — production/staging cleanup, if wanted,
  is a separate, explicit action
