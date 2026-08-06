# ADR-036: Remove Himalayas Provider, Finish DOU.ua Removal Cleanup

## Status

Accepted

## Date

2026-08-05

## Context

Product decision: stop sourcing vacancies from Himalayas (himalayas.app).
Like RemoteOK (ADR-034), Himalayas was registered unconditionally in
`apps/backend/src/container.ts` under the "Free providers — no API key
needed" block — no config required, always active. Its vacancies flowed
through `ProviderSearchService` → `VacancySource`/`Vacancy` persistence →
AI Vacancy Matching exactly like every other source, with no way to
disable it short of removing the registration.

Separately, this cleanup surfaced two already-in-progress removals that
were left half-done:

- **DOU.ua** (`dou`): its provider package source
  (`packages/providers/src/providers/dou/`) had already been deleted and
  it was already absent from `container.ts`, `source-priority.ts` (both
  copies), and the `VacancySource` enum — but a stale compiled
  `packages/providers/dist/providers/dou/` directory, a display-name map
  entry, and a `<SelectItem>` in the dashboard's search filter
  (`apps/dashboard/src/app/app/search/page.tsx`) were never cleaned up,
  and the DB still carried 419 `VacancySource` rows and a `ProviderConfig`
  row for it.
- **RemoteOK** (`remote_ok`): ADR-034 documented a full removal but only
  covered `VacancySource`/`Vacancy` cleanup, not the `ProviderConfig`
  table. A leftover `ProviderConfig` row for `remote_ok` remained, which
  is why it kept surfacing in the Provider Settings page as an
  unregistered entry with a raw, unformatted id instead of disappearing.

All three share the same failure mode: `ProviderManagementService.getAllProviders()`
unions live-registered provider ids with every `ProviderConfig.providerId`
in the database, so any provider removed from code but not from the DB
keeps appearing in the admin UI indefinitely.

## Decision

**Himalayas** — remove entirely, following the ADR-034 footprint:

- Delete `packages/providers/src/providers/himalayas/` (fetcher, mapper,
  normalizer, types, provider, tests, fixtures) and its exports from
  `packages/providers/src/index.ts`
- Unregister from `apps/backend/src/container.ts`
- Remove from `SOURCE_PRIORITY` / `inferProviderType` in
  `apps/backend/src/config/source-priority.ts`
- Remove from the `VacancySource` enum and `PROVIDER_PRIORITY` map in
  `@careeros/career` (`packages/career/src/domain/enums/`)
- Remove from sync-interval maps (`sync-scheduler-service.ts`,
  `provider-management-service.ts`) and display-name maps
  (`provider-management-service.ts`, dashboard `sync/page.tsx` and
  `search/page.tsx`, including the filter `<SelectItem>`)
- Remove from `test-providers-sync.ts`, `full-pipeline-test.ts`, and the
  `container.test.ts` mock list
- Delete `VacancySource` rows sourced from `himalayas` and the `Vacancy`
  rows left with zero remaining sources, plus its `ProviderConfig` row,
  in local dev (581 `VacancySource` rows at time of removal)

**DOU.ua** — finish the removal that was already underway:

- Remove the `dou: 'DOU.ua'` display-name entry and `<SelectItem
  value="dou">` from `apps/dashboard/src/app/app/search/page.tsx`
- Delete the stale `packages/providers/dist/providers/dou/` build output
- Delete its `ProviderConfig` row and remaining 419 `VacancySource` rows
  (plus now-orphaned `Vacancy` rows) in local dev

**RemoteOK** — close the gap ADR-034 left open:

- Delete its leftover `ProviderConfig` row in local dev so it stops
  appearing in the Provider Settings page

Combined, deleting the `himalayas`/`dou` `VacancySource` rows orphaned
992 `Vacancy` rows (no other source referenced them), which were deleted
in the same pass.

Not touched: historical migration SQL
(`20260723000000_add_vacancy_source/migration.sql`) and dated
audit/research reports/ADRs that cite Himalayas, DOU, or RemoteOK as
contemporaneous examples — those describe the state at the time they
were written, not current state (same exception ADR-034 already
established).

## Consequences

### Positive
- No more Himalayas or DOU.ua vacancies reaching AI Vacancy Matching,
  search, or recommendations
- Provider Settings page no longer shows dead/unregistered entries for
  any of the three providers — `ProviderConfig` cleanup is now part of
  the standard removal footprint, closing the gap ADR-034 left
- One fewer external dependency / sync job to maintain (Himalayas)

### Negative
- Fewer global remote listings until/unless another aggregator picks up
  the slack
- Fewer Ukraine-market listings now that DOU.ua is gone; no replacement
  Ukrainian source is currently planned
- `ProviderConfig` rows in any non-local environment are not
  automatically cleaned by this ADR (local dev only, per the same
  product decision ADR-034 made) — production/staging cleanup, if
  wanted, is a separate, explicit action
