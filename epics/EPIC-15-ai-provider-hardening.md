# EPIC-15: AI Provider Layer Hardening

## Status

**Implemented.** See [ADR-025](../adr/ADR-025-ai-provider-resilience.md) for the accepted design as built.

One deliberate deviation from "all existing tests must pass unmodified"
(below): `apps/backend/src/__tests__/container.test.ts`'s AI-provider-selection
tests asserted on which concrete provider constructor (`OpenAIProvider`,
`AnthropicProvider`, `GroqProvider`) the container called directly. TASK-15-01
moves that call out of the container into the shared
`createPrimaryAIProviderFromEnv` factory, so the container no longer touches
those constructors itself — the old assertions were testing an implementation
detail that legitimately moved. The tests were updated to assert on the new
call boundary (that the container delegates to the shared factory with the
right config) instead of deleted; behavior — which provider ends up
constructed for a given `AI_PROVIDER`/API key — is unchanged and still
covered, now at the `packages/ai` unit-test level
(`create-ai-provider.test.ts`) plus this delegation check.

## Duration

3-4 days

## Dependencies

EPIC-05 (AI Layer), ADR-009 (AI Provider Abstraction).

## Objective

Harden the existing `AIProvider` layer — reliability, configurability, and observability — without touching business logic, prompts, `MatchingEngine`, or the public `AIProvider` contract. This is operational hardening of what's already built, not a new abstraction.

## Non-Goals (explicit constraints)

- No business logic changes.
- No prompt changes.
- No `MatchingEngine` changes.
- No changes to public interfaces (`AIProvider`, `AIProviderConfig`, `AIRequest`, `AIResponse`) unless a specific task below calls out why it's strictly necessary.
- Preserve backwards compatibility — `AI_PROVIDER=openai` with no other config set must behave exactly as it does today.
- All existing tests must keep passing unmodified.

## Current State (what already exists — don't rebuild this)

- `AIProvider` / `BaseAIProvider` / five concrete providers (openai, anthropic, groq, gemini, openrouter) — [ai-provider.ts](../packages/ai/src/domain/ai-provider.ts), [base-provider.ts](../packages/ai/src/providers/base-provider.ts).
- A shared factory, `createAIProviderFromConfig` — [create-ai-provider.ts](../packages/ai/src/providers/create-ai-provider.ts) — already supports all five provider names.
- Observability primitives already exist and are wired into the backend container: `AILogger`/`ConsoleAILogger`, `AIMetricsCollector`/`InMemoryAIMetricsCollector` with an `AI_METRICS` key registry that **already defines** `PROVIDER_HEALTH`, `PROVIDER_LATENCY`, `PROVIDER_FAILURE`, `PROVIDER_SUCCESS`, `TOKENS_PROMPT/COMPLETION/TOTAL`, `COST_USD`, and `AITracer`/`InMemoryAITracer` — see [ai-metrics.ts](../packages/ai/src/observability/ai-metrics.ts). **None of these metric keys are currently emitted by any provider** — the registry exists, nothing calls it yet.
- `AIError`/`AIErrorType` with `retryable` classification already exists in `BaseAIProvider.classifyError()` — but nothing currently retries; the flag is computed and discarded.

## Gaps found (concrete, verified against current code)

1. `apps/backend/src/container.ts:215-224` has its own inline `createAIProvider` switch that **duplicates** and **diverges** from `createAIProviderFromConfig` — it doesn't support `gemini`/`openrouter` at all, and only ever passes `{ apiKey }`, never `model`, `timeoutMs`, etc. `apps/worker/src/container.ts:65-76` has a second, differently-scoped duplicate with the same `model`-dropping problem.
2. `AI_MODEL` has no env var today — `AIProviderConfig.model` exists on the type but nothing in either container ever sets it, so it's currently impossible to pick a model via configuration; each provider silently falls back to its hardcoded `defaultModel`.
3. `GEMINI_API_KEY` and `OPENROUTER_API_KEY` are not in `packages/shared/src/config.ts`'s schema at all, so those two already-implemented providers cannot actually be selected via env today despite the factory supporting them.
4. There is no fallback mechanism in `packages/ai` — ADR-009 sketches a `FallbackAIProvider` illustratively, but it was never implemented.
5. There is no retry/backoff for AI calls. `packages/providers` (job providers, a different package) has a `RetryPolicy` with exponential backoff + jitter that's a reasonable pattern reference, but it operates on that package's `ProviderResult`/`ProviderErrorType`, not `AIError` — it can inform the design, not be imported directly.
6. There is no AI-specific health monitor (job providers again has `ProviderHealthMonitor` as a pattern reference, same caveat — different domain types).
7. There is no concurrency limiting anywhere in the AI call path.
8. `timeoutMs` is read per-provider (`this.config.timeoutMs ?? 60_000`) but there's no env var wiring it, so every provider silently uses a hardcoded 60s regardless of environment.

## Target Configuration

```bash
AI_PROVIDER=anthropic                          # existing var, same semantics
AI_MODEL=claude-sonnet-4                       # NEW — overrides the selected provider's defaultModel
AI_FALLBACK_PROVIDERS=openrouter,openai,gemini # NEW — ordered fallback chain, tried in order on retryable failure
AI_MAX_CONCURRENCY=5                           # NEW — max in-flight complete() calls across the provider chain
AI_TIMEOUT_MS=120000                           # NEW — overrides the per-provider hardcoded 60s default
GEMINI_API_KEY=...                             # NEW schema entry (provider already implemented, key was missing)
OPENROUTER_API_KEY=...                         # NEW schema entry (provider already implemented, key was missing)
```

All new vars are optional with defaults matching today's behavior (`AI_FALLBACK_PROVIDERS` unset → no fallback, single-provider behavior identical to today).

## Tasks

### TASK-15-01: Consolidate provider construction
- [x] Extend `createAIProviderFromConfig` to accept `model` and pass it through `AIProviderConfig.model` (already a supported field on every provider — just not threaded from config today).
- [x] Add `gemini`/`openrouter` cases to `apps/backend/src/container.ts`'s `createAIProvider` (or replace its inline switch with a call into `createAIProviderFromConfig`, matching the pattern `apps/worker` already partially uses). — Done via a new `createPrimaryAIProviderFromEnv`, called by both apps.
- [x] Add `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `AI_MODEL`, `AI_TIMEOUT_MS` to `packages/shared/src/config.ts`.

### TASK-15-02: Retry with exponential backoff
- [x] Add an AI-specific `AIRetryPolicy` in `packages/ai/src/providers/` (or `resilience/`) operating on `AIError`/`AIErrorType.retryable`, modeled on `packages/providers`' `RetryPolicy` (backoff multiplier, jitter, max delay, respecting `retryAfterMs` on `AIError` when present) but returning/throwing per `AIProvider.complete()`'s existing `Promise<AIResponse>` contract rather than a `Result` type.
- [x] Default config: 3 attempts, 1s base delay, 2x multiplier, jitter on — consistent with the job-providers default so behavior across the codebase isn't surprising.

### TASK-15-03: Fallback across providers
- [x] Implement a `FallbackAIProvider` (finally realizing the ADR-009 sketch) that implements `AIProvider` and wraps an ordered list of concrete providers built from `AI_FALLBACK_PROVIDERS`. On a retryable `AIError` from the current provider (after its own retry budget is exhausted), advance to the next provider in the chain; non-retryable errors propagate immediately without moving to the next provider (a bad prompt won't get materially better results shopped across vendors).
- [x] `getCapabilities()`/`validateConfig()` report the primary (first) provider's values, matching how a single-provider `AIProvider` is used today by callers that inspect capabilities before calling.

### TASK-15-04: Health monitoring
- [x] Add an AI-specific `AIProviderHealthMonitor` (pattern-adapted from `packages/providers`' `ProviderHealthMonitor`, not shared code — different domain) tracking consecutive-failure counts and rolling average latency per provider name, fed by every `complete()` call (success/failure) rather than a separate active health-check ping (there's no cheap no-op AI health-check endpoint to poll).
- [x] `FallbackAIProvider` consults health status to skip a provider that's currently flagged unhealthy (N consecutive failures) rather than paying its timeout on every call, falling back immediately to the next provider in the chain; a skipped provider gets periodically retried (half-open) rather than permanently excluded.

### TASK-15-05: Metrics wiring
- [x] Wire the **already-defined** `AI_METRICS` keys (`REQUEST_STARTED/COMPLETED/FAILED`, `REQUEST_DURATION`, `PROVIDER_LATENCY`, `PROVIDER_SUCCESS`, `PROVIDER_FAILURE`, `TOKENS_PROMPT/COMPLETION/TOTAL`) into `BaseAIProvider.complete()` (or the new fallback wrapper) via the optional `AIMetricsCollector` — this is emitting to an interface that already exists and is already injected in the backend container, not a new metrics system. — Done in the fallback wrapper, per the option this task named.
- [x] Tag emitted metrics with `provider` and `model` per `AIMetricTags`.

### TASK-15-06: Concurrency limiting
- [x] Add a small semaphore/limiter gating concurrent `complete()` calls, configured by `AI_MAX_CONCURRENCY`, applied at the `FallbackAIProvider`/factory level so it governs total AI concurrency regardless of which underlying provider ends up serving a given call. — Queues excess calls rather than rejecting (backpressure over load-shedding); see ADR-025.

### TASK-15-07: Tests
- [x] Unit tests for `AIRetryPolicy` (backoff timing, respecting `retryAfterMs`, giving up after max attempts, non-retryable short-circuit).
- [x] Unit tests for `FallbackAIProvider` (advances chain on retryable failure, does not advance on non-retryable failure, skips unhealthy providers, half-open recovery covered via the health monitor's own tests).
- [x] Unit tests for the health monitor (consecutive failure tracking, recovery).
- [x] Unit tests for the concurrency limiter (queues beyond `AI_MAX_CONCURRENCY`, releases slots on error).
- [x] Integration-style test building a provider chain from `AI_FALLBACK_PROVIDERS`-style config (`create-ai-provider.test.ts`), verifying end-to-end chain construction without hitting real APIs.
- [x] Full existing suite (`packages/ai`, `apps/backend`, `apps/worker`) passes — see the Status note above on the one legitimately-updated test file.

### TASK-15-08: Documentation
- [x] New ADR ([`adr/ADR-025-ai-provider-resilience.md`](../adr/ADR-025-ai-provider-resilience.md) — ADR-024 was already taken by structured resume extraction) documenting the retry/fallback/health/concurrency design, superseding the illustrative (never-implemented) fallback sketch in ADR-009's "Fallback Strategy" section — linked forward from ADR-009 rather than deleted.
- [x] Update `.env.example` with the new variables and a comment on default/no-op behavior when unset.
- [x] Update `docs/TECH_STACK.md` (wherever `AI_PROVIDER` is currently documented) to describe the fallback chain and new env vars.

## Deliverables

- Consolidated, config-driven provider construction (`AI_MODEL`, all five providers selectable via env in both `apps/backend` and `apps/worker`).
- `AIRetryPolicy` with exponential backoff + jitter.
- `FallbackAIProvider` implementing ordered fallback across `AI_FALLBACK_PROVIDERS`.
- `AIProviderHealthMonitor` with circuit-breaker-style skip/recover behavior.
- `AI_METRICS` actually emitting from real provider calls.
- `AI_MAX_CONCURRENCY`-governed concurrency limiting.
- New ADR + updated docs/`.env.example`.

## Acceptance Criteria

- [x] `AIProvider` interface is unchanged; `MatchingEngine` and all prompt builders require zero code changes.
- [x] With no new env vars set, behavior is bit-for-bit identical to today (single provider, no fallback, unlimited concurrency) — retry is the one intentional addition, on by default (see the Negative consequences note in ADR-025).
- [x] Setting `AI_FALLBACK_PROVIDERS` causes automatic failover on a simulated retryable failure of the primary provider, verified by a test with mock providers.
- [x] Setting `AI_MODEL` results in the selected provider's `AIRequest`/API call using that model.
- [x] Metrics collector receives latency, success/failure, and token-usage events for every `complete()` call when a metrics collector is supplied.
- [x] `AI_MAX_CONCURRENCY` measurably bounds in-flight calls in a test.
- [x] All existing tests in `packages/ai`, `apps/backend`, `apps/worker` pass — one file's AI-provider-selection tests were updated (not just left passing unmodified) because the call boundary they asserted on legitimately moved; see the Status note above.
- [x] New unit/integration tests for retry, fallback, health monitor, and concurrency limiter all pass.
