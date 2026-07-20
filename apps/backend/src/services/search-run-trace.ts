export interface SearchRunStage {
  readonly name: string;
  readonly input: number;
  readonly output: number;
  readonly durationMs: number;
  readonly success: boolean;
}

export type VacancyExclusionReason =
  | 'duplicate'
  | 'provider_parse_failure'
  | 'low_relevance'
  | 'outside_top_n'
  | 'cache_hit'
  | 'ai_failed';

export interface VacancyExclusion {
  readonly vacancyId: string;
  readonly reason: VacancyExclusionReason;
  readonly stage: string;
}

/**
 * One request's trip through the pipeline (Provider Fetch -> Normalization ->
 * Deduplication -> Rule Filtering -> Cache/Selection -> Keyword Ranking ->
 * Queue), plus a per-vacancy reason for every exclusion along the way. Only
 * covers what actually runs *in this request* — for the default async search
 * path (see ADR-026), Worker/LLM/Persistence happen out-of-process afterward
 * and are observed separately via the live queue/AI diagnostics endpoints,
 * not folded into a single request-scoped trace.
 */
export interface SearchRunTrace {
  readonly runId: string;
  readonly searchProfileId: string;
  readonly userId: string;
  readonly startedAt: Date;
  readonly totalDurationMs: number;
  readonly aiEnabled: boolean;
  readonly awaitedAiMatching: boolean;
  readonly stages: readonly SearchRunStage[];
  readonly exclusions: readonly VacancyExclusion[];
}

const MAX_TRACES = 50;

/** Bounded in-memory ring buffer — same pattern as InMemoryMetricsCollector/InMemoryTracer, not a new persistence layer. */
export class SearchRunTraceRecorder {
  private readonly traces: SearchRunTrace[] = [];

  record(trace: SearchRunTrace): void {
    this.traces.unshift(trace);
    if (this.traces.length > MAX_TRACES) {
      this.traces.length = MAX_TRACES;
    }
  }

  getAll(): readonly SearchRunTrace[] {
    return this.traces;
  }

  getById(runId: string): SearchRunTrace | undefined {
    return this.traces.find((trace) => trace.runId === runId);
  }
}
