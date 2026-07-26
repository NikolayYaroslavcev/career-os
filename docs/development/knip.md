# Knip — unused code report

[Knip](https://knip.dev) scans the monorepo for files, dependencies, and
exports that nothing references. It runs in CI as a **non-blocking** report —
it never fails a build or gates a merge. Its job is visibility, not
enforcement.

Configuration lives in [`knip.jsonc`](../../knip.jsonc) at the repo root, with
one workspace entry per app/package in `apps/*` and `packages/*`.

## Running locally

```bash
pnpm knip
```

Exits non-zero if it finds anything, so this is convenient to run before
opening a PR if you want to check whether your change left something behind.
The same command CI runs (always exits 0, for the pipeline):

```bash
pnpm knip:ci
```

Useful flags:

```bash
pnpm knip --workspace packages/providers   # scope to one workspace
pnpm knip --include files                  # only one category
pnpm exec knip --trace-export FooBar       # why is FooBar "unused"?
```

## What the categories mean

**Unused files** — a file inside a workspace's `project` glob that is never
imported, directly or transitively, from any of that workspace's `entry`
points (or from a test file). Knip walks the real import graph, so a file can
only go dark if nothing in the reachable graph pulls it in — including
re-export barrels. If a package's own `providers/foo/index.ts` re-exports
`foo-fetcher.ts` but the *package's* top-level `src/index.ts` imports
`foo-fetcher.ts` directly instead of going through that barrel, the barrel
file itself is unreachable and gets flagged, even though the code it wraps is
very much alive.

**Unused dependencies / devDependencies** — a package listed in a
`package.json`'s `dependencies` or `devDependencies` that no source file in
that workspace imports, and that no detected plugin (ESLint, Vitest, Next.js,
Playwright, etc.) wires in implicitly. A common cause in this repo: a
dependency copy-pasted into a new package's `package.json` during scaffolding
that the package never actually ended up using.

**Unused exports / unused exported types** — a named export (function, class,
const, type, interface) that is reachable (the file itself is used) but the
specific export is never imported anywhere outside its own file. This is the
noisiest category and the easiest to get false positives from: public API
surface meant for external consumers, barrel re-exports kept for a future
caller, or types exported purely for editor/IDE convenience will all show up
here even though removing them would be premature.

## Known intentional cases

A few findings are suppressed directly in `knip.jsonc` because they are
false positives, not dead code — each has a comment explaining why:

- `postcss-load-config` — only referenced via a JSDoc `@type` import in
  `apps/dashboard/postcss.config.mjs` for editor type-checking; Next.js
  resolves it at runtime without it being a direct dependency.
- The `playwright` binary — invoked directly in `.github/workflows/ci.yml`
  (`pnpm exec playwright install ...`) rather than through an `apps/e2e`
  package.json script, so Knip can't tie the binary back to the
  `@playwright/test` devDependency that provides it.

Everything else Knip currently reports (see baseline below) has **not** been
triaged item-by-item — it's surfaced for visibility, not silently accepted as
correct. If you investigate a finding and confirm it's a false positive
(rather than actually removing the dead code), add it to `knip.jsonc` with a
comment explaining why, following the pattern above.

## Baseline (as of this writing)

Recorded so regressions and improvements are both visible over time. Get
current numbers with `pnpm knip`.

| Category | Count |
|---|---|
| Unused files | 0 |
| Unused dependencies | 0 |
| Unused devDependencies | 0 |
| Unresolved imports | 0 |
| Unused exports | 73 |
| Unused exported types | 86 |

### What the remaining findings are

The 159 remaining findings (73 exports + 86 types) are **intentional API
surface** — not dead code:

- **shadcn/ui component re-exports** (e.g. `CardFooter`, `DialogClose`,
  `SelectGroup`) — part of the design system library; kept for future use
  and consistency.
- **Dashboard API type exports** (e.g. `UsageStats`, `AIProviderConfig`,
  `FunnelStage`) — public type contracts for the dashboard's API layer;
  used for editor autocompletion and type safety even if no current
  consumer imports them by name.
- **Provider type exports** (e.g. `AdzunaLocation`, `HHKeySkill`) — part
  of the provider abstraction's public interface; intentionally exported
  for external consumers.
- **Backend service exports** (e.g. `TriageResult`, `RankingFactor`) —
  used for testing and type annotations within the service layer.

These are suppressed by knip's default behavior (they don't block CI) and
are tracked here for visibility. If any of these become truly dead (e.g.
an entire API endpoint is removed), the associated types should be cleaned
up at that point.

### Previous cleanup passes

A production-readiness pass removed 6 confirmed-dead files, broadened the
`apps/backend` entry glob so 7 legitimate one-off ops scripts stopped being
misreported, and added `vacancy-ranker.ts` to `ignore` as a documented
EPIC-17/ADR-027 extension point.

A second pass (the current one) removed 58 files total:
- 7 unused shadcn/ui component files (avatar, checkbox, dropdown-menu,
  separator, skeleton, sonner, tooltip)
- 3 dead worker job processors (ai-job-processor, company-watch-sync,
  notification-check) and their dependent deps (`@careeros/ai-orchestrator`,
  `@careeros/company-watch`)
- 45 dead barrel index.ts files across packages/ai, packages/database, and
  packages/providers (superseded by direct imports in parent index.ts)
- 2 unused provider types files (habr-career-types, remoteok-types)

It also removed 49 dependencies/devDependencies:
- `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` from
  15 packages (only the root eslint.config.js uses the `typescript-eslint`
  meta-package)
- `eslint` and `eslint-config-next` from apps/dashboard
- `vite-plugin-web-extension` from apps/extension
- 14 confirmed-dead production deps (swagger, swagger-ui, react-query,
  next-themes, sonner, zod, ioredis in worker and ai-orchestrator,
  @careeros/shared in 4 packages, pdf-parse, mammoth)
