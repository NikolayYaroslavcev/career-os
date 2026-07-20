# ADR-025: AI Provider Resilience (Fallback, Retry, Health, Concurrency)

## Status

Accepted

## Date

2026-07-20

## Context

ADR-009 established the `AIProvider` interface and per-vendor implementations
(OpenAI, Anthropic, Groq, Gemini, OpenRouter). It sketched a `FallbackAIProvider`
as an example, but that was never implemented — there was no retry, no
fallback, no health tracking, and the `AI_METRICS` key registry already
defined in `packages/ai/src/observability/ai-metrics.ts` was never actually
emitted to by any provider call.

Separately, `apps/backend` and `apps/worker` each had their own inline
`AI_PROVIDER -> AIProvider` switch, out of sync with each other: backend's
didn't support `gemini`/`openrouter` at all, and neither threaded a model
override through, so an `AI_MODEL` env var (had one existed) would have been
silently ignored.

EPIC-15 scoped hardening this layer: eliminate the duplicated factory,
make every implemented provider and model selectable via env, and add
fallback/retry/health/metrics/concurrency-limiting — without changing the
`AIProvider` public interface, prompts, or `MatchingEngine`.

## Decision

### Single source of truth for provider construction

`packages/ai/src/providers/create-ai-provider.ts` now exports
`createPrimaryAIProviderFromEnv(config, deps?)`, which:

1. Resolves the primary provider name from `AI_PROVIDER` (default `openai`,
   unchanged from before).
2. Resolves that provider's API key from the matching env var — now
   including `GEMINI_API_KEY`/`OPENROUTER_API_KEY`, previously missing from
   the config schema despite both providers being fully implemented.
3. Threads `AI_MODEL` through as the primary provider's model override
   (previously silently dropped by both apps' containers).
4. Threads `AI_TIMEOUT_MS` through as a config-driven override of the
   previously-hardcoded 60s-per-provider default.
5. Builds an ordered fallback chain from `AI_FALLBACK_PROVIDERS`
   (comma-separated), dropping any entry whose API key isn't configured,
   always keeping the primary even if unconfigured (matches historical
   behavior: it just fails at call time).

`apps/backend` and `apps/worker` each keep a one-line `createAIProvider(config)`
wrapper (per ADR-016, apps can't import another app's `src`), but both now
just delegate to the shared function instead of re-deriving the
provider/API-key mapping themselves.

### Resilience wrapper

`FallbackAIProvider` (`packages/ai/src/providers/fallback-ai-provider.ts`)
wraps an ordered `AIProvider[]` as a single `AIProvider`. It reports the
first ("primary") provider's `name`/`defaultModel`/capabilities, so a
one-element chain is behaviorally a drop-in replacement for a bare provider.
`createPrimaryAIProviderFromEnv` always returns a `FallbackAIProvider` — even
for a single-provider chain — so retry, health tracking, and metrics apply
uniformly, not just when a fallback chain is configured.

On `complete()`:

- Each provider attempt goes through an injected `AIRetryPolicy`
  (exponential backoff + jitter, honoring `AIError.retryAfterMs` when
  present — 3 attempts by default).
- Once a provider's retry budget is exhausted on a **retryable** `AIError`,
  the wrapper advances to the next provider in the chain. A **non-retryable**
  error (bad prompt, auth failure) propagates immediately — trying another
  vendor doesn't fix a malformed request.
- An `AIProviderHealthMonitor` tracks consecutive failures and rolling
  average latency per provider name from live `complete()` outcomes (there's
  no cheap no-op health-check endpoint on an LLM API to poll separately).
  A provider crossing the failure threshold is skipped (not attempted) until
  a cooldown elapses, at which point one attempt is allowed through
  (half-open recovery) rather than requiring a fixed number of successes.
- Every attempt — including retries — emits through the **already-defined**
  `AI_METRICS` keys (`REQUEST_STARTED/COMPLETED/FAILED`, `PROVIDER_LATENCY`,
  `PROVIDER_SUCCESS/FAILURE`, `TOKENS_PROMPT/COMPLETION/TOTAL`) via the
  injected `AIMetricsCollector`. This is wiring an existing, previously-unused
  registry, not a new metrics system.
- An optional `AIConcurrencyLimiter` (a FIFO-queueing semaphore, not a
  rejecting one — excess calls queue rather than error out) gates the whole
  `complete()` call, configured by `AI_MAX_CONCURRENCY`. All retries and
  fallback attempts for one logical request share a single slot; `0`/unset
  is unlimited (a no-op passthrough).

## Consequences

### Positive

- One place (`createPrimaryAIProviderFromEnv`) owns provider resolution;
  `apps/backend` and `apps/worker` can no longer drift out of sync.
- All five implemented providers, plus model and timeout, are actually
  configurable via env — previously only three providers were reachable and
  model/timeout were dead config.
- Retry/fallback/health/metrics/concurrency-limiting apply by default with
  zero config changes, with behavior identical to before when no new env
  vars are set (single provider, primary's own hardcoded default model,
  hardcoded 60s timeout, no fallback, unlimited concurrency).

### Negative

- `createPrimaryAIProviderFromEnv`'s return type is now always a
  `FallbackAIProvider`, not the bare concrete class — code that did
  `instanceof AnthropicProvider` on the container's `aiProvider` would break
  (no such usage existed at the time of this change; `AIProvider` callers
  only depend on the interface).
- A failing single-provider call now retries (up to 3 attempts with backoff)
  before surfacing an error, where previously it failed immediately. This is
  the intended reliability improvement, but call sites that assumed
  zero-retry, immediate-failure timing should be aware latency on the
  failure path increased.

### Mitigations

- `FallbackAIProvider`, `AIRetryPolicy`, `AIProviderHealthMonitor`, and
  `AIConcurrencyLimiter` are all independently unit-tested
  (`packages/ai/src/__tests__/{fallback-ai-provider,retry-policy,health-monitor,concurrency-limiter}.test.ts`),
  and `createPrimaryAIProviderFromEnv`'s env-resolution logic is tested
  separately from the resilience wrapping.

## Configuration

```bash
AI_PROVIDER=anthropic
AI_MODEL=claude-sonnet-4-5
AI_TIMEOUT_MS=120000
AI_FALLBACK_PROVIDERS=openrouter,openai,gemini
AI_MAX_CONCURRENCY=5
GEMINI_API_KEY=...
OPENROUTER_API_KEY=...
```

All new variables are optional; omitting all of them reproduces pre-ADR-025
behavior exactly.

## Related

- Supersedes the never-implemented `FallbackAIProvider` sketch in
  [ADR-009](./ADR-009-ai-provider-abstraction.md)'s "Fallback Strategy" section.
- Follows from [EPIC-15](../epics/EPIC-15-ai-provider-hardening.md).
