# Production Data Quality Audit

Date: 2026-07-22
Database: local Postgres configured as `careeros` (`DATABASE_URL` masked in runtime output)
Scope: persisted `Vacancy` records by `providerId`
Active definition: vacancy `fetchedAt` within the last 30 days

## Summary

- Total imported vacancies: 680
- Providers with imported data: 9
- Providers below threshold: 7
- Providers with no imported data: 11

Thresholds used:

- Missing salaries: `> 85%`
- Missing company names: `> 1%`
- Missing apply URLs: `> 1%`
- Missing locations: `> 20%`
- Missing descriptions: `> 2%`
- Duplicate percentage: `> 1%`
- Invalid URLs: `> 1%`
- Short descriptions: `> 10%`
- Unknown company names: `> 5%`
- Mapping quality score: `< 70`

## Providers Below Acceptable Thresholds

| Provider | Imported | Active | Missing Salary | Missing Company | Missing Apply URL | Missing Location | Missing Description | Duplicate % | Invalid URLs | Avg Import Time | Failed Records | Mapping Quality | Status |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- |
| `arbeitnow` | 1 | 1 | 1 (100.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0.0% | 0 (0.0%) | 0 ms | 0 | 85 | Below threshold: missing salary |
| `hn_hiring` | 94 | 94 | 94 (100.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0.0% | 0 (0.0%) | 0 ms | 0 | 85 | Below threshold: missing salary |
| `jobicy` | 122 | 122 | 122 (100.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0.0% | 0 (0.0%) | 0 ms | 0 | 85 | Below threshold: missing salary |
| `nodesk` | 11 | 11 | 11 (100.0%) | 0 (0.0%) | 0 (0.0%) | 11 (100.0%) | 0 (0.0%) | 0.0% | 0 (0.0%) | 0 ms | 0 | 70 | Below threshold: missing salary, missing location, unknown company names |
| `remote_ok` | 309 | 309 | 298 (96.4%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0.0% | 0 (0.0%) | 0 ms | 0 | 82 | Below threshold: missing salary |
| `we_work_remotely` | 25 | 25 | 25 (100.0%) | 0 (0.0%) | 0 (0.0%) | 25 (100.0%) | 0 (0.0%) | 0.0% | 0 (0.0%) | 0 ms | 0 | 70 | Below threshold: missing salary, missing location, unknown company names |
| `working_nomads` | 43 | 43 | 43 (100.0%) | 0 (0.0%) | 0 (0.0%) | 43 (100.0%) | 0 (0.0%) | 0.0% | 0 (0.0%) | 0 ms | 0 | 70 | Below threshold: missing salary, missing location |

## Providers Within Thresholds

| Provider | Imported | Active | Missing Salary | Missing Company | Missing Apply URL | Missing Location | Missing Description | Duplicate % | Invalid URLs | Avg Import Time | Failed Records | Mapping Quality |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| `himalayas` | 40 | 40 | 25 (62.5%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0.0% | 0 (0.0%) | 0 ms | 0 | 89 |
| `remotive` | 35 | 35 | 8 (22.9%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0 (0.0%) | 0.0% | 0 (0.0%) | 0 ms | 0 | 93 |

## Providers With No Imported Data

`adzuna`, `ashby`, `comeet`, `greenhouse`, `hh`, `lever`, `linkedin`, `recruitee`, `smartrecruiters`, `teamtailor`, `workday`

## Notes

- Missing company names were `0` for all imported providers, but two providers used placeholder-style company values that degraded quality:
  - `nodesk`: unknown company names `11/11` (`100.0%`)
  - `we_work_remotely`: unknown company names `25/25` (`100.0%`)
- Invalid URLs were `0` for every imported provider.
- Stored duplicate percentage by canonical record identity was `0` for every imported provider.
- Some providers still showed title+company collisions that may deserve a manual review:
  - `remote_ok`: `19` (`6.1%`)
  - `working_nomads`: `3` (`7.0%`)
  - `himalayas`: `1` (`2.5%`)
  - `jobicy`: `1` (`0.8%`)

## Metric Caveats

- `Average import time` currently resolves to `0 ms` for all persisted records because the persisted vacancy model does not store end-to-end provider fetch/import duration per vacancy. The available value is effectively `fetchedAt - createdAt`, and new inserts are created with matching timestamps.
- `Failed records` is reported as `0` because normalization and parse failures are tracked in request-time diagnostics, not persisted historically in the database.
- `analyticsImportEvents` existed as `0` across the dataset, so historical event-based import timing could not be reconstructed from `AnalyticsEvent`.
