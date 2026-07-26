# ADR-024: Structured Resume Extraction Layer

## Status

Draft

## Date

2026-07-16

## Context

Today, resume text reaches AI use cases in two different, inconsistent ways, and no use case works from a shared structured representation:

- **`Resume.rawText`** is not a database column. It lives inside the untyped `parsedData: Json` blob (`packages/database/prisma/schema.prisma:287-302`) and is read/written through `ResumeMapper.toDomain`/`toPersistence` (`packages/database/src/mappers/resume-mapper.ts:36-81`). The domain entity (`packages/career/src/domain/entities/resume.ts`) exposes it as `Resume.rawText: string | undefined`, alongside already-structured (but client-submitted, never AI-extracted) fields: `summary`, `skills`, `technologies`, `experience`, `education`.
- **`SearchProfileSuggestionService.suggest()`** (`apps/backend/src/services/search-profile-suggestion-service.ts:93-141`) reads `resume.rawText` and compacts it with `buildCompactResumeContext(rawText, maxTokens, maxChars)` from `apps/backend/src/services/resume-context-builder.ts` — a hand-rolled, section-aware, keyword-based (English/Russian) token-budget splitter. The budget itself is hardcoded: `MAX_RESUME_CONTEXT_TOKENS = 1800`, explicitly commented as tuned to "Groq's free tier... 6000 TPM" — i.e. reverse-engineered from one specific provider and applied unconditionally, regardless of which provider is actually configured.
- **`AiMatchingService` / `IntelligenceWorkflowService`** (vacancy matching) do **not** use `resume-context-builder.ts` at all. `resume.rawText` is passed straight through, unbounded, into `VacancyMatchingPromptBuilder` (`packages/ai/src/prompts/vacancy-matching.ts:64`), with no token estimate and no truncation.
- **`ResumeAnalysisPromptBuilder`** (`packages/ai/src/prompts/resume-analysis.ts`) exists and is exported, but is never wired to any service, route, or container entry — it's dead code today, representing an unimplemented "Resume Analysis" use case.
- **`AIProvider.getCapabilities()`** (`packages/ai/src/domain/ai-provider.ts`) returns `AICapabilities { supportsStreaming, supportsVision, maxTokens, supportedModels }` (`packages/ai/src/domain/ai-types.ts:28-33`). This `maxTokens` is populated per-provider with values that read as **context-window sizes** (Groq 32768, OpenAI 128000, Anthropic 200000, Gemini 1000000, OpenRouter 200000 — see `packages/ai/src/providers/*.ts:18`), yet every provider's `complete()` treats a *different*, request-level `maxTokens` (`request.maxTokens ?? config.maxTokens ?? 4000`) as the completion budget. `getCapabilities()` is never consulted by any prompt- or context-building code — it is dead weight for budgeting purposes today, and its naming is actively misleading.
- The one instance of provider-aware behavior that exists, `createSuggestionAIProvider()` (`apps/backend/src/container.ts:112-123`), is a hand-wired special case ("use a cheaper Groq model for suggestions so it doesn't share vacancy-matching's rate limit") rather than a general capability/budget abstraction.

Net effect: two AI consumers of the same resume, two different (one nonexistent) context-budgeting strategies, magic numbers instead of provider-derived limits, and a third planned use case (Resume Analysis) with no data source to build from. Every consumer that *does* look at the resume re-derives its own view of it from `rawText` on every call.

We previously discussed `ResumeContextBuilder` (the `resume-context-builder.ts` module) as a *temporary* layer — useful because it's cheap and keeps `rawText` untouched, but not a long-term architecture, because it re-parses raw text per call, per use case, with no persistence, no shared structure, and no real provider awareness.

This ADR defines the target architecture — a persisted **Structured Resume Extraction** layer sitting between `Resume.rawText` and all AI use cases — and a step-by-step migration plan that keeps the current MVP working at every stage.

## Decision

We introduce a **Structured Resume** as a first-class, persisted, versioned artifact derived from `Resume.rawText` via an AI extraction step, and a single `ResumeContextProvider` port that every AI use case calls instead of touching `rawText` directly. `resume-context-builder.ts` is kept permanently, demoted to an explicit **fallback** path for resumes that have no structured extraction yet (old resumes, extraction not yet run, or extraction failed). Provider-aware token budgeting is centralized in a `ContextBudgetCalculator` driven by `AIProvider.getCapabilities()`, removing hardcoded per-service constants.

`Resume.rawText` itself is never modified by this work — it remains the single source of truth that structured extraction is derived from and can be regenerated from at any time.

### 1. Structured Resume — persistence

```prisma
// packages/database/prisma/schema.prisma

model StructuredResume {
  id                     String    @id @default(uuid())
  resumeId               String    @unique
  resume                 Resume    @relation(fields: [resumeId], references: [id], onDelete: Cascade)

  // Staleness / versioning — lets us detect "rawText changed since last extraction"
  // and "extraction schema/prompt changed since this row was written" independently.
  sourceHash             String    // sha256 of Resume.rawText at extraction time
  extractionVersion      String    // prompt/schema version (bump to force re-extraction for all resumes)
  extractionModel        String?   // model that produced this row, for auditing/cost analysis
  extractionStatus       String    // 'pending' | 'completed' | 'failed'
  failureReason          String?
  extractedAt            DateTime?

  summary                String?
  seniorityLevel         String?
  totalYearsOfExperience Int?
  skills                 Json      // string[]
  technologies           Json      // string[]
  experience             Json      // StructuredResumeExperience[]
  education              Json      // StructuredResumeEducation[]

  createdAt              DateTime  @default(now())
  updatedAt              DateTime  @updatedAt

  @@index([extractionStatus])
}
```

Add the inverse relation `structuredResume StructuredResume?` to the existing `Resume` model. No existing column changes.

`sourceHash` + `extractionVersion` together answer "is this row still valid for the current `rawText` and the current extraction prompt?" without needing a background job to eagerly invalidate anything — staleness is checked lazily, at read time.

### 2. Domain layer

```typescript
// packages/career/src/domain/entities/structured-resume.ts

export interface StructuredResumeExperience {
  readonly company: string;
  readonly position: string;
  readonly startDate: Date;
  readonly endDate?: Date;
  readonly description: string;
  readonly technologies: readonly string[];
}

export interface StructuredResumeEducation {
  readonly institution: string;
  readonly degree: string;
  readonly field: string;
  readonly startDate: Date;
  readonly endDate?: Date;
}

export type ExtractionStatus = 'pending' | 'completed' | 'failed';

export interface StructuredResumeProps {
  readonly resumeId: ResumeId;
  readonly sourceHash: string;
  readonly extractionVersion: string;
  readonly extractionModel?: string;
  readonly extractionStatus: ExtractionStatus;
  readonly failureReason?: string;
  readonly extractedAt?: Date;
  readonly summary?: string;
  readonly seniorityLevel?: string;
  readonly totalYearsOfExperience?: number;
  readonly skills: readonly string[];
  readonly technologies: readonly string[];
  readonly experience: readonly StructuredResumeExperience[];
  readonly education: readonly StructuredResumeEducation[];
}

export class StructuredResume extends AggregateRoot<StructuredResumeId> {
  // .create() / .reconstitute() / getters, following the existing Resume entity pattern

  isFreshFor(currentRawTextHash: string, currentExtractionVersion: string): boolean {
    return (
      this.props.extractionStatus === 'completed' &&
      this.props.sourceHash === currentRawTextHash &&
      this.props.extractionVersion === currentExtractionVersion
    );
  }
}
```

```typescript
// packages/career/src/domain/repositories/structured-resume-repository.ts

export interface StructuredResumeRepository {
  findByResumeId(resumeId: ResumeId): Promise<StructuredResume | null>;
  upsert(structuredResume: StructuredResume): Promise<void>;
}
```

### 3. Extraction — prompt builder and engine

```typescript
// packages/ai/src/prompts/structured-resume-extraction.ts

export interface StructuredResumeExtractionParams {
  readonly rawText: string;
}

export interface StructuredResumeExtractionResult {
  readonly summary: string;
  readonly seniorityLevel: string;
  readonly totalYearsOfExperience: number;
  readonly skills: readonly string[];
  readonly technologies: readonly string[];
  readonly experience: readonly StructuredResumeExperience[];
  readonly education: readonly StructuredResumeEducation[];
}

export class StructuredResumeExtractionPromptBuilder {
  readonly promptId = 'structured-resume-extraction';
  readonly promptVersion = 'v1';
  build(params: StructuredResumeExtractionParams): AIRequest;
}
```

```typescript
// packages/ai/src/extraction/resume-extraction-engine.ts

export interface ResumeExtractionEngineDeps {
  readonly provider: AIProvider;
  readonly promptBuilder: StructuredResumeExtractionPromptBuilder;
  readonly logger: AILogger;
  readonly metrics: AIMetricsCollector;
}

export class ResumeExtractionEngine {
  constructor(deps: ResumeExtractionEngineDeps) {}
  extract(rawText: string): Promise<StructuredResumeExtractionResult>;
}
```

This mirrors the existing `MatchingEngine` pattern (`packages/ai/src/matching/matching-engine.ts`) rather than inventing a new one.

### 4. Provider-aware budgeting

`AICapabilities` gains an explicit, correctly-named context-window field. The existing `maxTokens` field is **kept as-is** for this migration (nothing outside the providers' own `complete()` reads it today, but removing it isn't necessary to ship this ADR — it's cut in the cleanup stage instead):

```typescript
// packages/ai/src/domain/ai-types.ts

export interface AICapabilities {
  readonly supportsStreaming: boolean;
  readonly supportsVision: boolean;
  /** @deprecated ambiguous — see contextWindowTokens. Removed in a later cleanup stage. */
  readonly maxTokens: number;
  readonly contextWindowTokens: number; // total input+output tokens the model supports
  readonly supportedModels: readonly string[];
}
```

```typescript
// packages/ai/src/budget/context-budget-calculator.ts

export interface ContextBudgetInput {
  readonly capabilities: AICapabilities;
  readonly systemPromptTokens: number;
  readonly reservedCompletionTokens: number;
  readonly safetyMarginRatio?: number; // default 0.1
}

export interface ContextBudgetCalculator {
  calculateResumeContextBudget(input: ContextBudgetInput): number; // tokens available for resume context
}
```

`calculateResumeContextBudget` = `(contextWindowTokens - systemPromptTokens - reservedCompletionTokens) * (1 - safetyMarginRatio)`, floored at a sane minimum. This is what replaces `MAX_RESUME_CONTEXT_TOKENS = 1800` and gives vacancy matching a real, provider-derived budget for the first time instead of none at all.

### 5. Shared consumer interface — `ResumeContextProvider`

This is the piece all three AI use cases (Search Profile Suggestion, Resume Analysis, Vacancy Matching) call, so none of them re-analyzes `rawText` independently:

```typescript
// packages/ai/src/context/resume-context-provider.ts

export interface ResumeExperienceContext {
  readonly company: string;
  readonly position: string;
  readonly description: string;
  readonly technologies: readonly string[];
}

export interface ResumeAIContext {
  readonly source: 'structured' | 'fallback_raw';
  readonly summary: string;
  readonly skills: readonly string[];
  readonly technologies: readonly string[];
  readonly experience: readonly ResumeExperienceContext[];
  readonly totalYearsOfExperience: number;
  readonly promptText: string;      // ready-to-interpolate, budgeted text block
  readonly estimatedTokens: number;
}

export interface ResumeContextProvider {
  getContext(resumeId: ResumeId, budgetTokens: number): Promise<ResumeAIContext>;
}
```

Implementation logic (`ResumeContextProviderImpl`):

1. Load `Resume` and `StructuredResume` (if any) for `resumeId`.
2. If `StructuredResume` exists and `isFreshFor(hash(resume.rawText), currentExtractionVersion)` → serialize the structured fields into `promptText` within `budgetTokens`, `source: 'structured'`.
3. Otherwise → call the existing `buildCompactResumeContext(resume.rawText, budgetTokens, ...)` from `resume-context-builder.ts` unchanged, `source: 'fallback_raw'`.

This is the concrete mechanism by which `resume-context-builder.ts` becomes the fallback, exactly as required — it is not deleted or rewritten, only demoted to step 3.

### Data flow after migration

```
Resume.rawText (unchanged)
      │
      ├─► ResumeStructuringService.ensureExtracted(resumeId)   [async, triggered on create/update/backfill]
      │         │
      │         ▼
      │   ResumeExtractionEngine ──► StructuredResumeRepository.upsert()
      │
      └─► ResumeContextProvider.getContext(resumeId, budget)
                │
                ├─ StructuredResume fresh?  ──yes──► serialize structured fields (budgeted)
                │
                └─ no / missing / failed   ────────► buildCompactResumeContext(rawText, budget)  [fallback]
                                │
                                ▼
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                      ▼
  SearchProfileSuggestion   VacancyMatching       ResumeAnalysis
       Service              (AiMatchingService)    (new, uses the
                                                    already-defined but
                                                    unused ResumeAnalysis-
                                                    PromptBuilder)
```

## Migration Plan

Every stage below is independently shippable and additive-only until explicitly noted otherwise. No stage requires removing or breaking an existing code path before its replacement is proven; the fallback (`resume-context-builder.ts`) means every consumer migration is reversible by construction.

| Stage | What ships | Touches production behavior? | Reversible? |
|---|---|---|---|
| 1 | `StructuredResume` Prisma model + migration, domain entity, repository (Prisma-backed), container wiring (unused) | No | Trivial — drop table |
| 2 | `contextWindowTokens` on `AICapabilities` (all 5 providers), `ContextBudgetCalculator` + unit tests | No | Trivial — unused code |
| 3 | `StructuredResumeExtractionPromptBuilder`, `ResumeExtractionEngine`, `ResumeStructuringService`, manual/flagged trigger, shadow-mode extraction on a sample of resumes | Additive (flag off by default) | Flip flag off |
| 4 | `ResumeContextProvider` + `ResumeContextProviderImpl` (structured-or-fallback), full unit tests for both branches | No (not wired to real services yet) | N/A |
| 5 | Migrate `SearchProfileSuggestionService` to `ResumeContextProvider`; remove `MAX_RESUME_CONTEXT_TOKENS`/`MAX_RESUME_CONTEXT_CHARS` constants | Yes — smallest blast radius consumer | Feature-flagged; falls back to old behavior automatically when structured data absent |
| 6 | Migrate `AiMatchingService` / `VacancyMatchingPromptBuilder` / `IntelligenceWorkflowService` to `ResumeContextProvider` | Yes — highest value (currently fully unbounded), highest risk | Feature-flagged; monitor `aiMetrics`/cost tracker before/after |
| 7 | BullMQ backfill job for existing resumes; hook extraction into resume create/update (async, non-blocking) | Yes, but async/best-effort | Job can be paused; no synchronous dependency |
| 8 (cleanup) | Wire `ResumeAnalysisPromptBuilder` to `ResumeContextProvider` (delivers "Resume Analysis" use case); remove deprecated `AICapabilities.maxTokens`; re-evaluate `createSuggestionAIProvider`'s hardcoded Groq special-case now that budget-aware model selection exists | Yes (new feature) / No (pure cleanup) | N/A |

Stages 1–4 can be built and merged immediately with no coordination risk. Stages 5–6 are where we'll want before/after comparison on suggestion quality, match quality, latency, and AI cost (using the existing `InMemoryCostTracker`/`aiMetrics` already in `container.ts`) before removing the flag. Stage 7 is what makes structured data available proactively instead of lazily on first AI call. Stage 8 is explicitly out of scope for "don't break the MVP" and can slip.

## Consequences

### Positive

- All three AI use cases converge on one persisted, typed representation of a resume instead of three ad hoc views of `rawText`.
- Vacancy matching — currently the only consumer with **zero** context budgeting — gets a real, provider-derived budget for the first time.
- Token/char budgets are derived from `AIProvider.getCapabilities()` instead of hardcoded, provider-specific magic numbers baked into business logic.
- `resume-context-builder.ts` keeps working unmodified and gets an explicit, permanent role (fallback for old/stale/failed-extraction resumes) instead of being a hidden single-purpose utility.
- `Resume.rawText` and its existing storage (inside `parsedData`) are untouched — no risk to existing resume upload/parsing flows (ADR-014).
- Enables the previously-planned but never-wired "Resume Analysis" use case at low incremental cost (prompt builder already exists).
- Structured, queryable resume data opens the door to future features (resume search/filtering, analytics) without new schema work.

### Negative

- New table, new repository, new service, new prompt builder, new engine — real surface area added to a codebase that currently solves this with one ~200-line function.
- Extraction is an AI call with its own latency/cost/failure modes; every resume now has an implicit "is my structured data fresh" question.
- Two representations of resume content (`rawText` fallback path vs. structured path) must be kept behaviorally reconcilable — a prompt built from structured data and one built from `buildCompactResumeContext` will not be byte-identical, which is acceptable but should be monitored during Stage 5/6 rollout.
- `sourceHash`/`extractionVersion` staleness checks add a small amount of conceptual overhead every AI consumer needs to understand (though it's fully encapsulated in `ResumeContextProviderImpl`).

### Mitigations

- Stages 1–4 ship with zero production behavior change, de-risking the bulk of the new code before any consumer switches over.
- Stage 3 runs extraction in shadow mode first (flagged, sampled) to validate extraction quality/cost before any consumer depends on it.
- Fallback path is the existing, already-shipped `resume-context-builder.ts` — Stage 5/6 rollout risk is bounded to "structured data was wrong," never "no context was built at all."
- Reuses existing `aiMetrics`/`InMemoryCostTracker` for before/after comparison rather than building new observability.

## Alternatives Considered

### 1. Store structured fields inside the existing `Resume.parsedData` JSON blob

No new table; extend the existing `ParsedData` shape in `resume-mapper.ts`.

**Rejected because:** `parsedData` is already untyped and already conflates `rawText` with derived fields; adding extraction status/versioning/staleness tracking to an unindexed JSON blob makes the "is this stale" check either impossible or requires reading and hashing the blob on every access. A dedicated table with an index on `extractionStatus` and a unique `resumeId` constraint is a small addition that keeps the concerns separated.

### 2. Extract structure synchronously at resume upload time only

Run extraction inline during resume create/update, block the request until it completes.

**Rejected because:** couples resume ingestion latency and availability to AI provider latency/cost/rate limits, and gives no path to backfill resumes created before this ADR. Async extraction (Stage 3/7) decouples ingestion from AI availability and naturally supports backfill.

### 3. Skip the structured layer; just add provider-aware budgeting to `resume-context-builder.ts`

Keep one function, make its token budget come from `AIProvider.getCapabilities()`, wire it into vacancy matching too.

**Rejected because:** it fixes the budgeting gap (requirement 6) but not the core problem (requirements 2–4) — every AI use case would still re-parse and re-analyze `rawText` on every call, with no shared, queryable, persisted structure, and no foundation for the Resume Analysis use case or future structured-data features.

## References

- ADR-006: Prisma ORM (schema conventions)
- ADR-009: AI Provider Abstraction — note: its `AIProvider` interface (`analyzeVacancy`/`generateResume`) does not match the current `packages/ai/src/domain/ai-provider.ts` implementation; this ADR takes the real interface as ground truth.
- ADR-014: Resume Parsing Strategy — describes an AI-extraction pipeline that was never built; this ADR is the concrete follow-through for the "structured extraction" half of that vision, scoped specifically to AI-consumption use cases rather than parsing/ingestion.
- ADR-023: Job Processing Pipeline — Stage 7's backfill job follows the same BullMQ-backed, idempotent job pattern.
