export interface AIMetricTags {
  readonly [key: string]: string;
}

export interface AIMetricsCollector {
  incrementCounter(name: string, value?: number, tags?: AIMetricTags): void;
  recordHistogram(name: string, value: number, tags?: AIMetricTags): void;
  setGauge(name: string, value: number, tags?: AIMetricTags): void;
}

export const AI_METRICS = {
  REQUEST_STARTED: 'ai.request.started',
  REQUEST_COMPLETED: 'ai.request.completed',
  REQUEST_FAILED: 'ai.request.failed',
  REQUEST_DURATION: 'ai.request.duration_ms',
  TOKENS_PROMPT: 'ai.tokens.prompt',
  TOKENS_COMPLETION: 'ai.tokens.completion',
  TOKENS_TOTAL: 'ai.tokens.total',
  COST_USD: 'ai.cost.usd',
  CACHE_HIT: 'ai.cache.hit',
  CACHE_MISS: 'ai.cache.miss',
  CACHE_SIZE: 'ai.cache.size',
  CONFIDENCE_DISTRIBUTION: 'ai.confidence.distribution',
  MATCH_SCORE_DISTRIBUTION: 'ai.match.score.distribution',
  PROVIDER_HEALTH: 'ai.provider.health',
  PROVIDER_LATENCY: 'ai.provider.latency_ms',
  PROVIDER_FAILURE: 'ai.provider.failure',
  PROVIDER_SUCCESS: 'ai.provider.success',
  MODEL_REQUEST: 'ai.model.request',
  GUARDRAIL_EVIDENCE_CHECK: 'ai.guardrail.evidence_check',
  GUARDRAIL_CONFIDENCE_VALIDATED: 'ai.guardrail.confidence_validated',
  GUARDRAIL_HALLUCINATION_DETECTED: 'ai.guardrail.hallucination_detected',
  FEEDBACK_RECEIVED: 'ai.feedback.received',
  FEEDBACK_ACCURACY: 'ai.feedback.accuracy',
  EXTRACTION_REUSED: 'ai.extraction.reused',
} as const;

export class InMemoryAIMetricsCollector implements AIMetricsCollector {
  private counters = new Map<string, number>();
  private histograms = new Map<string, number[]>();
  private gauges = new Map<string, number>();

  incrementCounter(name: string, value: number = 1, _tags?: AIMetricTags): void {
    const current = this.counters.get(name) ?? 0;
    this.counters.set(name, current + value);
  }

  recordHistogram(name: string, value: number, _tags?: AIMetricTags): void {
    const values = this.histograms.get(name) ?? [];
    values.push(value);
    this.histograms.set(name, values);
  }

  setGauge(name: string, value: number, _tags?: AIMetricTags): void {
    this.gauges.set(name, value);
  }

  getCounter(name: string): number {
    return this.counters.get(name) ?? 0;
  }

  getHistogram(name: string): readonly number[] {
    return this.histograms.get(name) ?? [];
  }

  getGauge(name: string): number | undefined {
    return this.gauges.get(name);
  }

  reset(): void {
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
  }
}

export class NoopAIMetricsCollector implements AIMetricsCollector {
  incrementCounter(_name: string, _value?: number, _tags?: AIMetricTags): void {}
  recordHistogram(_name: string, _value: number, _tags?: AIMetricTags): void {}
  setGauge(_name: string, _value: number, _tags?: AIMetricTags): void {}
}
