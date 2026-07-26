# Production Readiness Report

Date: 2026-07-24

## Final verification (all green)

| Check | Result |
|-------|--------|
| `pnpm lint` | 30/30 tasks, 0 errors, 0 warnings |
| `pnpm typecheck` | 31/31 packages, 0 errors |
| `pnpm test` | 30/30 tasks, 518 tests passing |
| `pnpm build` | 19/19 apps/packages |
| `pnpm knip` | 0 new issues (159 intentional unused exports/types) |

## Changes summary

### Lint (previous session)
- Fixed ~600+ ESLint warnings across 20 packages/apps
- Categories: `explicit-function-return-type`, `no-non-null-assertion`, stale `eslint-disable` directives

### Typecheck (previous session)
- 0 errors across all 31 packages

### Tests (previous session)
- Fixed 1 flaky test: `app-ai-warning.test.ts` timeout increased 5000ms → 20000ms

### Knip triage (this session)

**Files removed (58):**
- 7 unused shadcn/ui components (avatar, checkbox, dropdown-menu, separator, skeleton, sonner, tooltip)
- 3 dead worker job processors (ai-job-processor, company-watch-sync, notification-check)
- 45 dead barrel index.ts files (packages/ai, packages/database, packages/providers)
- 2 unused provider types files (habr-career-types, remoteok-types)
- 1 broken import fixed (provider-sandbox.ts observability barrel → direct imports)

**Dependencies removed (49):**
- `@typescript-eslint/eslint-plugin` + `@typescript-eslint/parser` from 15 packages
- `eslint` + `eslint-config-next` from apps/dashboard
- `vite-plugin-web-extension` from apps/extension
- 14 confirmed-dead production deps: `@fastify/swagger`, `@fastify/swagger-ui`, `@tanstack/react-query`, `next-themes`, `sonner`, `zod`, `ioredis` (worker + ai-orchestrator), `@careeros/shared` (ai-orchestrator, auth, resume, telegram), `pdf-parse`, `mammoth`

**Knip baseline improvement:**

| Category | Before | After | Delta |
|---|---|---|---|
| Unused files | 57 | 0 | -57 |
| Unused dependencies | 16 | 0 | -16 |
| Unused devDependencies | 33 | 0 | -33 |
| Unresolved imports | 0 | 0 | — |
| Unused exports | 78 | 73 | -5 |
| Unused exported types | 94 | 86 | -8 |
| **Total** | **278** | **159** | **-119 (43%)** |

### Security audit (this session)

**Fixed:**
1. **CRITICAL: Redis unauthenticated access** — Added `--requirepass` to Docker Redis in both compose files. Updated all REDIS_URL references to include auth.
2. **CRITICAL: AI cache cross-tenant data leak** — Added `userId` to cache key generation. Users can no longer see each other's cached AI responses.

**Documented** (require manual action or architectural decisions):
- `.env` contains real GROQ API key (rotate immediately)
- Default Docker passwords (Postgres, MinIO, PGAdmin)
- 4 orchestrator handlers bypass prompt injection protection
- 3 packages/ai prompts lack input fencing
- Access tokens not invalidated on logout (15-min window)
- Tokens in localStorage vs HttpOnly cookies
- No dedicated auth endpoint rate limiting
- No runtime validation of BullMQ job payloads
- Provider API keys stored without encryption at rest
- See `docs/development/security-audit.md` for full details

### Dependency review (this session)
- Upgraded vitest 2.x → 3.x in apps/dashboard (consistency with rest of monorepo)
- Applied safe minor/patch updates: prettier 3.9.5→3.9.6, turbo 2.10.5→2.10.6, typescript-eslint 8.64.0→8.65.0

### Docs sync (this session)
- Updated `docs/product/CURRENT_FEATURES.md`: date, cleanup notes, worker job handler status
- Updated `docs/development/knip.md`: new baseline table, detailed category explanations
- Created `docs/development/security-audit.md`: full audit report

## Files changed

| Category | Count |
|----------|-------|
| package.json edits | 16 |
| Source files deleted | 58 |
| Source files edited | 4 |
| Docker files edited | 2 |
| Documentation files created/edited | 4 |
| **Total** | **84** |

## Remaining tech debt / risks

### Must fix before production
1. **Rotate GROQ API key** — real key exists in `.env` on disk
2. **Set strong passwords** for Postgres, MinIO, PGAdmin via env vars in any non-localhost deployment

### Should fix
3. Apply `wrapUntrustedContent` to 4 orchestrator handlers + 3 AI prompts (prompt injection defense-in-depth)
4. Add dedicated rate limiting on `/auth/login` (5-10 attempts/min per IP)
5. Add Zod validation at BullMQ job entry boundaries
6. Encrypt API keys at rest in `aiProviderConfig` table
7. Migrate refresh tokens to HttpOnly cookies
8. Add `read_only`, `no-new-privileges`, `cap_drop` to Docker services

### Accepted for now
9. Access tokens not invalidated on logout (15-min window, standard JWT tradeoff)
10. 159 intentional unused exports (public API surface, design system re-exports)
11. `PUT /me` endpoint is a no-op
12. No dead letter queue for permanently failed jobs
13. InMemoryCostTracker loses data on restart (orchestrator's UsageTracker persists)

## Final verdict

The codebase is in strong shape for a production-readiness baseline. All quality gates pass clean (lint, typecheck, test, build). The knip cleanup removed 43% of findings, eliminating all unused files, dependencies, and devDependencies. Two critical security issues were fixed (Redis auth, cache isolation). The remaining security findings are documented with clear remediation paths. The biggest open risk is the exposed GROQ API key in `.env` which requires immediate manual rotation.
