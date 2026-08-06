/**
 * ADR-035 §12. Mirrors packages/providers/src/observability/metrics.ts's
 * PROVIDER_METRICS naming convention rather than overloading it with
 * unrelated dimensions — Company Discovery is a distinct bounded context
 * (ADR-033) from the Provider/Vacancy sync pipeline. Emitted through the
 * same MetricsCollector interface (@careeros/providers) — no new metrics
 * backend.
 */
export const DISCOVERY_METRICS = {
  CANDIDATES_FOUND: 'careeros.discovery.candidates_found',
  CANDIDATES_DEDUPLICATED: 'careeros.discovery.candidates_deduplicated',
  AUTO_ENROLLED: 'careeros.discovery.auto_enrolled',
  REVIEW_QUEUE_DEPTH: 'careeros.discovery.review_queue_depth',
  REJECTED: 'careeros.discovery.rejected',
  SOURCE_RUN_DURATION: 'careeros.discovery.source_run_duration_ms',
  SOURCE_RUN_FAILURE: 'careeros.discovery.source_run_failure',
} as const;
