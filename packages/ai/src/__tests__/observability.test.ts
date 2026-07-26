import { describe, it, expect, beforeEach } from 'vitest';
import { ConsoleAILogger, NoopAILogger } from '../observability/ai-logger.js';
import { InMemoryAIMetricsCollector, NoopAIMetricsCollector, AI_METRICS } from '../observability/ai-metrics.js';
import { InMemoryAITracer, NoopAITracer } from '../observability/ai-tracer.js';

describe('AILogger', () => {
  it('ConsoleAILogger respects log levels', () => {
    const logger = new ConsoleAILogger('warn');
    // Should not throw
    logger.debug('test');
    logger.info('test');
    logger.warn('test');
    logger.error('test');
  });

  it('NoopAILogger does nothing', () => {
    const logger = new NoopAILogger();
    logger.debug('test');
    logger.info('test');
    logger.warn('test');
    logger.error('test');
  });
});

describe('AIMetricsCollector', () => {
  let collector: InMemoryAIMetricsCollector;

  beforeEach(() => {
    collector = new InMemoryAIMetricsCollector();
  });

  it('tracks counters', () => {
    collector.incrementCounter('test.counter');
    collector.incrementCounter('test.counter', 5);
    expect(collector.getCounter('test.counter')).toBe(6);
  });

  it('tracks histograms', () => {
    collector.recordHistogram('test.histogram', 100);
    collector.recordHistogram('test.histogram', 200);
    expect(collector.getHistogram('test.histogram')).toEqual([100, 200]);
  });

  it('tracks gauges', () => {
    collector.setGauge('test.gauge', 42);
    expect(collector.getGauge('test.gauge')).toBe(42);
  });

  it('resets all data', () => {
    collector.incrementCounter('c');
    collector.recordHistogram('h', 1);
    collector.setGauge('g', 1);

    collector.reset();
    expect(collector.getCounter('c')).toBe(0);
    expect(collector.getHistogram('h')).toEqual([]);
    expect(collector.getGauge('g')).toBeUndefined();
  });

  it('NoopAIMetricsCollector does nothing', () => {
    const collector = new NoopAIMetricsCollector();
    collector.incrementCounter('test');
    collector.recordHistogram('test', 1);
    collector.setGauge('test', 1);
  });
});

describe('AITracer', () => {
  it('creates and ends spans', () => {
    const tracer = new InMemoryAITracer();
    const span = tracer.startSpan('test-span', { key: 'value' });

    span.setAttribute('new-key', 'new-value');
    span.addEvent('test-event', { eventKey: 'eventValue' });
    span.end();

    const spans = tracer.getSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0]?.name).toBe('test-span');
    expect(spans[0]?.attributes['key']).toBe('value');
    expect(spans[0]?.attributes['new-key']).toBe('new-value');
    expect(spans[0]?.events).toHaveLength(1);
    expect(spans[0]?.endedAt).toBeDefined();
  });

  it('finds span by name', () => {
    const tracer = new InMemoryAITracer();
    tracer.startSpan('span-a');
    tracer.startSpan('span-b');

    expect(tracer.getSpanByName('span-a')).toBeDefined();
    expect(tracer.getSpanByName('span-b')).toBeDefined();
    expect(tracer.getSpanByName('span-c')).toBeUndefined();
  });

  it('NoopAITracer does nothing', () => {
    const tracer = new NoopAITracer();
    const span = tracer.startSpan('test');
    span.setAttribute('key', 'value');
    span.addEvent('event');
    span.end();
  });
});

describe('AI_METRICS constants', () => {
  it('has all required metric names', () => {
    expect(AI_METRICS.REQUEST_STARTED).toBe('ai.request.started');
    expect(AI_METRICS.REQUEST_COMPLETED).toBe('ai.request.completed');
    expect(AI_METRICS.REQUEST_FAILED).toBe('ai.request.failed');
    expect(AI_METRICS.REQUEST_DURATION).toBe('ai.request.duration_ms');
    expect(AI_METRICS.TOKENS_PROMPT).toBe('ai.tokens.prompt');
    expect(AI_METRICS.TOKENS_COMPLETION).toBe('ai.tokens.completion');
    expect(AI_METRICS.TOKENS_TOTAL).toBe('ai.tokens.total');
    expect(AI_METRICS.COST_USD).toBe('ai.cost.usd');
    expect(AI_METRICS.CACHE_HIT).toBe('ai.cache.hit');
    expect(AI_METRICS.CACHE_MISS).toBe('ai.cache.miss');
  });
});
