export interface UsageRecorderInput {
  readonly userId: string;
  readonly provider: string;
  readonly model: string;
  readonly feature: string;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly totalTokens: number;
  readonly estimatedCost: number;
  readonly latencyMs: number;
}

/**
 * Persists usage for call sites that talk to an AIProvider directly instead of
 * going through AIOrchestrator.execute() (MatchingEngine, ResumeExtractionEngine,
 * SearchProfileSuggestionService) — without this, those requests spend real
 * provider budget but never appear in AIUsageRepository, so the AI dashboard
 * (which reads only from there) silently under-reports usage/cost.
 */
export interface UsageRecorder {
  record(input: UsageRecorderInput): Promise<void> | void;
}
