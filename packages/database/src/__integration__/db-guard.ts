/**
 * Real-Postgres integration tests must never run against a shared/long-lived
 * database by accident — DATABASE_URL alone isn't a strong enough signal,
 * since local dev machines commonly have it pointed at their persistent
 * docker-compose stack. Requiring this explicit opt-in (set only by the
 * `integration-tests` CI job, against its throwaway Postgres service) means a
 * plain local `pnpm test:integration` stays inert instead of writing into
 * someone's real dev database.
 */
export function integrationTestsEnabled(): boolean {
  return process.env.RUN_DB_INTEGRATION_TESTS === 'true' && Boolean(process.env.DATABASE_URL);
}
