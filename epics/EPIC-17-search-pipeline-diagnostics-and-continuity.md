# EPIC-17: Search Pipeline Diagnostics, Continuity, and Ranking Extension Point

## Status

**Implemented.** This file did not exist when the work shipped (commit
`823e4e9`, "stabilize search platform — HH provider, diagnostics,
continuity"); added retroactively during a documentation-consistency audit
(2026-07-23) to keep the epics index in sync with the ADR log and commit
history.

## Purpose

Close gaps left after EPIC-16 (ADR-026): the HH provider was registered and
running but returned zero vacancies, because its parser modeled a response
shape (`title`, flat `description`, `skills`) that didn't match the real
`api.hh.ru` search response (`name`, `snippet.requirement` /
`snippet.responsibility`, no top-level `skills` field). Beyond that single
bug, the search pipeline as a whole lacked diagnostics and continuity —
operators had no way to see what happened on a given search run, and there
was no extension point for future ranking strategies.

## Implementation Summary

- Fixed the HH provider parser to match the real `api.hh.ru` response
  shape (`provider-diagnostics-service.ts`, dashboard `features/diagnostics`).
- Added search-run tracing (`search-run-trace.ts`) for per-run visibility.
- Added a ranking extension point for future scoring strategies.

## Related ADRs

- [ADR-027: Search Pipeline Diagnostics, Continuity, and Ranking Extension Point](../adr/ADR-027-search-pipeline-diagnostics-and-continuity.md) — full root-cause analysis and accepted design.
- Builds on [EPIC-16](./EPIC-16-decoupled-vacancy-search.md) / [ADR-026](../adr/ADR-026-decoupled-vacancy-search.md).
