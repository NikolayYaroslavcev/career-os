# ADR Index

## Active ADR location

**`/adr/`** (this directory, repo root) is the active, current set of
Architecture Decision Records. It is the only ADR directory receiving new
entries and the only one with commit history behind it (e.g. `ADR-025`,
`ADR-026`, `ADR-027` were added alongside the features they describe —
see `git log -- adr/ADR-025-ai-provider-resilience.md`).

Numbering: `ADR-0NN-short-title.md`, sequential, never reused. Highest
number currently in use: **ADR-030**. The next new ADR is **ADR-031**.

### Known naming inconsistency

`adr/008-browser-extension-implementation-plan.md` doesn't follow the
`ADR-0NN-` prefix (missing the `ADR-` prefix) and its number `008` collides
with `ADR-008-provider-architecture.md` in this same directory. It was left
as-is by this documentation pass per instructions not to rewrite ADR
content or restructure files — noted here so it isn't mistaken for the
"real" ADR-008. If it's ever renumbered, use the next free number (031+),
not 008.

## Historical ADR location

**`/docs/adr/`** is a smaller, earlier, abandoned parallel set (9 files,
`ADR-001` through `ADR-010` with `ADR-009` missing). It covers similar
early-architecture ground under different titles and numbering than this
directory (e.g. its `ADR-001-monorepo.md` vs. this directory's
`ADR-001-monorepo-architecture.md`) and was superseded by `/adr/` at the
repo root. It stops at `ADR-010-company-watch.md` and was never brought
current with the rest of the project's evolution — do not treat it as
authoritative, and do not add new files there.

It has not been deleted or reconciled with `/adr/` as part of this
documentation-consistency pass (that would mean rewriting or removing ADR
content, which was explicitly out of scope). If you're deciding what a past
architectural decision actually was and the two directories disagree,
`/adr/` (here) wins.

## Where to create new ADRs

Add new files directly to **`/adr/`** (repo root), using the next sequential
number (**ADR-031** as of this writing) and the `ADR-0NN-short-title.md`
naming pattern used by `ADR-001` through `ADR-030`. Do not add to
`/docs/adr/`.
