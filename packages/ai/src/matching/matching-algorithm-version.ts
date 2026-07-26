/**
 * Identifies the version of the in-process matching/scoring logic (fit
 * calculations, clamping, recommendation thresholding) that produced a
 * MatchResult — independent of `promptVersion`, which only tracks the LLM
 * prompt template. Bump this whenever `MatchingEngine`'s parsing/scoring
 * behavior changes, so historical MatchResults can be grouped and compared
 * across algorithm revisions even when the prompt itself is unchanged.
 */
export const CURRENT_MATCHING_ALGORITHM_VERSION = '2.0.0';
