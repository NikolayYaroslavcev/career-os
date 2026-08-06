// Moved to packages/ai/src/context/resume-context-fallback.ts (ADR-031) so
// apps/worker's resume-tailoring pipeline can reuse the same fallback
// context builder instead of duplicating ~200 lines of section-splitting
// logic across app boundaries. Re-exported here so existing imports in this
// app keep working unchanged.
export { buildCompactResumeContext, estimateTokens } from '@careeros/ai';
export type { ResumeSectionName } from '@careeros/ai';
