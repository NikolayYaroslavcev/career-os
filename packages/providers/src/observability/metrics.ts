export interface MetricTags {
  [key: string]: string;
}

export interface MetricsCollector {
  incrementCounter(name: string, value?: number, tags?: MetricTags): void;
  recordHistogram(name: string, value: number, tags?: MetricTags): void;
  setGauge(name: string, value: number, tags?: MetricTags): void;
}

export const PROVIDER_METRICS = {
  FETCH_DURATION: 'provider.fetch.duration_ms',
  MAP_DURATION: 'provider.map.duration_ms',
  NORMALIZE_DURATION: 'provider.normalize.duration_ms',
  PIPELINE_DURATION: 'provider.pipeline.duration_ms',
  FETCH_SUCCESS: 'provider.fetch.success',
  FETCH_FAILURE: 'provider.fetch.failure',
  VACANCIES_FETCHED: 'provider.vacancies.fetched',
  VACANCIES_MAPPED: 'provider.vacancies.mapped',
  VACANCIES_NORMALIZED: 'provider.vacancies.normalized',
  HEALTH_CHECK_DURATION: 'provider.health.duration_ms',
  RATE_LIMIT_ACQUIRED: 'provider.rate_limit.acquired',
  RATE_LIMIT_REJECTED: 'provider.rate_limit.rejected',
  RETRY_ATTEMPT: 'provider.retry.attempt',
} as const;

export class InMemoryMetricsCollector implements MetricsCollector {
  private counters = new Map<string, number>();
  private histograms = new Map<string, number[]>();
  private gauges = new Map<string, number>();

  incrementCounter(name: string, value: number = 1, _tags?: MetricTags): void {
    const current = this.counters.get(name) ?? 0;
    this.counters.set(name, current + value);
  }

  recordHistogram(name: string, value: number, _tags?: MetricTags): void {
    const values = this.histograms.get(name) ?? [];
    values.push(value);
    this.histograms.set(name, values);
  }

  setGauge(name: string, value: number, _tags?: MetricTags): void {
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

  getHistogramStats(name: string): { min: number; max: number; avg: number; count: number } | undefined {
    const values = this.histograms.get(name);
    if (!values || values.length === 0) return undefined;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return { min, max, avg, count: values.length };
  }

  reset(): void {
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
  }
}

export class NoopMetricsCollector implements MetricsCollector {
  incrementCounter(): void {}
  recordHistogram(): void {}
  setGauge(): void {}
}
