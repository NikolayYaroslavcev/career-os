/**
 * Structured HTTP failure from an ATS transport. Carries `status`/`statusText`
 * rather than a pre-formatted message so each consumer can compose its own
 * existing message format (`providers` uses `HTTP {status}: {statusText}`,
 * `company-watch` uses `{ats} API error: {status} {statusText}`) and keep
 * classifying errors (e.g. 429 -> rate limited) exactly as it did before this
 * package existed.
 */
export class AtsHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly statusText: string,
  ) {
    super(message);
    this.name = 'AtsHttpError';
  }
}
