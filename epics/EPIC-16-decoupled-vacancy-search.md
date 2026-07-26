# EPIC-16: Decouple Vacancy Search from AI Matching

## Status

**Implemented.** This file did not exist when the work shipped (commit
`83392e9`); added retroactively during a documentation-consistency audit
(2026-07-23) to keep the epics index in sync with the ADR log and commit
history.

## Purpose

A real end-to-end test found `POST /api/v1/intelligence/search` hanging as
"Pending" in the browser after the AI provider (Groq) returned a `429
rate_limit_exceeded` — even though provider search, normalization,
deduplication, and persistence had already completed successfully (173
vacancies fetched and persisted, confirmed in backend logs). The request
hung *after* that. The goal was to stop AI matching failures/latency from
blocking the search response the user is waiting on.

## Implementation Summary

- `POST /intelligence/search` now returns as soon as vacancies are
  persisted, instead of waiting on AI matching to finish.
- AI matching runs independently of the search request/response cycle and
  no longer blocks it.

## Related ADRs

- [ADR-026: Decouple Vacancy Search from AI Matching](../adr/ADR-026-decoupled-vacancy-search.md) — full root-cause analysis and accepted design.
- Followed by [EPIC-17](./EPIC-17-search-pipeline-diagnostics-and-continuity.md) / [ADR-027](../adr/ADR-027-search-pipeline-diagnostics-and-continuity.md), which closed gaps this epic left open (HH provider parser bug, lack of diagnostics).
