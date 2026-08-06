# ADR-031: Resume Tailoring Pipeline v2 (Evidence-Based, Async)

## Status

Accepted

## Context

Resume Tailoring is CareerOS's highest-priority feature. An architecture audit (Graphify-assisted) found the existing implementation had no safety net comparable to competitors like Jobscan, Rezi, or Teal:

1. **No ATS scoring existed anywhere in the codebase.** The only "ATS" hits in the repo were `AtsType`/`ProviderType.ATS` (Greenhouse/Lever/etc. career-page-platform detection for `packages/company-watch`) — unrelated to resume-vs-vacancy keyword matching.
2. **The hallucination-guardrail interface (`packages/ai/src/domain/ai-guardrails.ts`, `AIRailguards`) was fully typed but had zero implementations, zero call sites, and zero tests.** The only actual anti-hallucination measure was a single prompt instruction ("NEVER fabricate...") with no programmatic verification.
3. **The tailoring prompt's own "quantify achievements where possible" instruction was a hallucination vector** — it invited the model to invent metrics not present in the source resume, directly contradicting the "never fabricate" rule two lines above it.
4. **Tailoring ran synchronously on `packages/ai-orchestrator` (Stack A)**, which despite ADR-028's stated design goal ("the frontend never waits for LLM completion") executed every job inline inside the HTTP request — `AIJobQueue`/BullMQ was constructed but `enqueue()` was never called anywhere in the repo.
5. **The route logic was duplicated** across `apps/backend/src/routes/ai/ai-routes.ts` and `apps/backend/src/routes/applications/application-routes.ts` — same orchestrator call, differing only in how the vacancy was resolved.
6. **Output was a single untyped JSON blob** on the generic `AIJob.result` column — unlike `MatchResult` (the vacancy-matching pipeline's result type), there was no dedicated, queryable, versioned model for a tailored resume.
7. **`packages/ai/src/matching`** (vacancy-matching) already had the *right* pattern for this: a real BullMQ worker (`apps/worker`), a richly-typed persisted result (`MatchResult`), an idempotent upsert on a natural key, and app-level retry distinct from BullMQ's own retry. Tailoring didn't use any of it.

## Decision

Move Resume Tailoring — and only Resume Tailoring — onto a new, checkpointed, evidence-based async pipeline modeled on the vacancy-matching pattern. Cover Letter and the other 5 `ai-orchestrator` features are explicitly **not** migrated in this change; Stack A continues to serve them unchanged.

### Pipeline stages

```
Queued → Parsing Resume → Parsing Vacancy → Building Evidence → Tailoring Resume
       → ATS Scoring → Reviewer Validation → Saving Results → Completed / Failed
```

1. **Parsing Resume** — `ResumeEvidenceBuilder` wraps the existing `ResumeContextProvider` (ADR-024's structured-or-fallback resolver) and reshapes its output into bullet-indexed, per-job evidence. `StructuredResumeExperience` gained a new `bullets: string[]` field (extracted separately from the existing `description` summary) so later stages can trace a rewritten line back to a specific original sentence. `StructuredResume` also gained `certifications`/`languages` fields to support the Phase 1/2 requirement taxonomy.
2. **Parsing Vacancy** — a new `VacancyRequirementsPromptBuilder` (deliberately separate from the live `VacancyAnalysisPromptBuilder` used by recommendations, so this change can't regress that pipeline) extracts the full requirement taxonomy: seniority, required/preferred skills, responsibilities, ATS keywords, technologies, soft skills, domain, industry, education, certifications, language requirements.
3. **Building Evidence** — a deterministic `SkillMatrixEngine` (no LLM call) computes matched/missing/weak/strong skills and coverage ratios, and the ATS engine computes `atsScoreBefore` against the original resume.
4. **Tailoring Resume** — the revised `ResumeTailoringPromptBuilder`: every rewritten bullet must carry a `sourceBulletIndex` (which original bullet it was derived from) and every reordered job carries a `sourceJobIndex`. The prompt no longer emits a freeform `tailoredResume` full-text field (the old schema's second, drifting source of truth alongside `reorderedExperience`); the final text is now rendered deterministically in code. The "quantify achievements" instruction was rewritten to explicitly forbid inventing a number not present in the cited source bullet.
5. **ATS Scoring** — the same deterministic engine scores the tailored draft, producing `atsScoreAfter`.
6. **Reviewer Validation** — a new `TailoringReviewer` (implements the *concept* of `AIRailguards`, see below) makes one batch LLM call comparing every rewritten bullet against the specific original bullet it cites, plus a whole-output scan for fabricated entities. Unsupported bullets are deterministically reverted to their original text (not silently dropped) and recorded in `changesRejected` with a reason.
7. **Saving Results** — `renderTailoredResume` deterministically builds the final plain-text resume from the verified structured content.

### Zero Hallucination Policy — evidence model

- The LLM may only rewrite, reorder, compress, or clarify facts already present in the resume — never invent them. This is enforced at three layers: (a) prompt instructions, (b) the reviewer's per-bullet citation check, (c) deterministic reversion of anything the reviewer can't verify.
- Every generated bullet is traceable to a `(jobIndex, sourceBulletIndex)` pair in the original resume. A bullet with no valid citation (structurally out of range) is rejected without needing an LLM call to say so.
- `packages/ai/src/domain/ai-guardrails.ts` gained a `checkEvidenceBatch` method on `AIRailguards` to describe this batch-checking shape for future reuse. `TailoringReviewer` does not literally `implements AIRailguards`: the interface's other methods (`checkEvidence` per single claim, `detectHallucinations` as a separate call) don't fit a single combined batch call without doubling the LLM cost, so `TailoringReviewer` is a concrete, tailoring-specific implementation of the same concept, documented as such in its own file.

### ATS scoring — deterministic, not LLM-scored

- `packages/ai/src/ats/ats-scoring-engine.ts` computes the score entirely in code from structured evidence. The LLM is never given the opportunity to assign a number.
- 13 weighted categories (Required Skills, Preferred Skills, Technology, Responsibility, Experience, Seniority, Industry, Education, Certifications, Language, ATS Keyword Coverage, Resume Completeness, Formatting Quality), each reporting a raw score, weighted score, matched/missing evidence, and confidence.
- Weights live in one exported, versioned config object (`DEFAULT_ATS_WEIGHTS`, `ATS_WEIGHTS_VERSION`) — not scattered magic numbers — so the weighting scheme can evolve without touching the scoring algorithm; every result stamps the weights version it was computed under.
- Categories with no corresponding vacancy data (e.g. no stated education requirement) are marked `applicable: false` and excluded from the weighted denominator rather than penalizing the candidate for something the vacancy never asked for.
- Same (resume, vacancy) input always produces the same score — no randomness, no model call.

### Async execution and checkpointing

- One BullMQ job per `(resumeId, vacancyId)` pair (job id = `` `${resumeId}__${vacancyId}` ``, mirrors `buildVacancyAnalysisJobId`). A dedicated `TailoredResume` Prisma model (not the generic `AIJob.result` blob) persists the row, upserted on `@@unique([resumeId, vacancyId])`.
- The job handler is a checkpointed state machine, not a straight-line function: three stages make real LLM calls (Parsing Vacancy, Tailoring Resume, Reviewer Validation) and are individually skipped on retry if already checkpointed `COMPLETED` in `stageExecutions`. The other stages are cheap/deterministic and simply re-run every attempt. This means a BullMQ retry after a mid-pipeline failure resumes from the failed stage instead of rerunning the whole pipeline — without needing per-stage sub-queues.
- Every stage records its own execution metadata (status, timestamps, duration, model, provider, token counts, cost, retry count, error) in `stageExecutions`.
- An `inputHash` (sha256 of `resumeId`/`resume.updatedAt`/`vacancyId`/`vacancy.updatedAt`, mirroring `computeVacancyAnalysisInputHash`) gates reuse: an unchanged, `COMPLETED` row is returned without any LLM calls. An explicit `forceRegenerate` flag (wired to the existing "Regenerate" button) bypasses this.

### API surface (backwards-compatible)

- `POST /api/v1/ai/tailor-resume` and `POST /api/v1/applications/:id/tailor-resume` keep their existing URLs and request bodies. Both now delegate to a new shared `TailoringRequestService` instead of duplicating logic against the orchestrator directly. The response becomes `{ jobId, status: 'queued'|'cached', cached, result? }` — already valid under the pre-existing `ExecuteAIResult<T>` type (which had typed `status: 'queued'` and an optional `result` from the start; nothing previously produced that shape).
- New: `GET /api/v1/ai/tailor-resume/:id/status` — the polling target, returning stage/status/result.
- The now-orphaned Stack A path for tailoring was retired: `TailorResumeHandler` and its container registration were deleted. `'tailor_resume'` remains a valid `AIFeature` string value for historical `AIJob` rows, but nothing constructs the handler anymore.
- The dashboard's `TailorResumeTab` transitions into a 9-stage progress stepper on a `queued` response and polls the status endpoint (reusing the interval-polling idiom already used by `search-button.tsx`) — no page refresh, same single "Tailor Resume" button. The browser extension polls internally inside its background script so the content-script contract (`panel-injector.ts`) needed zero changes.

## Consequences

- Resume Tailoring now has a genuinely evidence-checked, deterministically-scored pipeline, closing the gap against Jobscan/Rezi/Teal's keyword-match scores while adding a fabrication check none of them advertise.
- The two-stack duplication (Stack A vs. Stack B) still exists for the other 6 orchestrator features — this ADR does not resolve it, only stops it from growing for tailoring.
- `ResumeContextProvider`'s fallback context builder (`buildCompactResumeContext`/`estimateTokens`) moved from `apps/backend/src/services/resume-context-builder.ts` into `packages/ai/src/context/resume-context-fallback.ts` so `apps/worker` could reuse it without duplicating ~200 lines of section-splitting logic across app boundaries (apps cannot import each other's `src`, per ADR-016) — the old app-level file is now a thin re-export.
- ATS weights are configurable in code (one exported object) but not yet runtime/admin-editable — deferred.
- `TailoredResumeVersion` history/comparison inside `career-intelligence`'s resume-version-intelligence system, DOCX/mammoth resume parsing, and migrating Cover Letter to the same pipeline are explicitly out of scope for this change.
