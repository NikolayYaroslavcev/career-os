import { z } from 'zod';

// z.coerce.number() runs `Number(value)` — for the empty string that's `0`,
// not NaN, so a blank-but-present line in `.env` (e.g. `AI_TIMEOUT_MS=`, which
// .env.example uses throughout to mean "unset, use the default") would
// silently coerce to 0 instead of falling through to .default()/.optional().
// For AI_TIMEOUT_MS specifically that means AbortSignal.timeout(0) — every AI
// call aborts instantly. Normalizing '' to undefined before coercion makes a
// blank value behave the same as an absent one.
const blankToUndefined = (v: unknown) => (v === '' ? undefined : v);

function numberField(defaultValue: number) {
  return z.preprocess(blankToUndefined, z.coerce.number().default(defaultValue));
}

function optionalNumberField() {
  return z.preprocess(blankToUndefined, z.coerce.number().optional());
}

// z.coerce.boolean() runs `Boolean(value)`, which is true for any non-empty
// string — including the literal string "false". A `.env` line like
// `AI_ENABLED=false` would silently coerce to `true`. Parse "true"/"1" as
// true and everything else (including blank) as false/default explicitly.
function booleanField(defaultValue: boolean) {
  return z.preprocess((v) => {
    if (typeof v !== 'string') return v;
    if (v === '') return undefined;
    return v.toLowerCase() === 'true' || v === '1';
  }, z.boolean().default(defaultValue));
}

const configSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: numberField(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  CORS_ORIGIN: z.string().default('http://localhost:3001'),
  // apps/worker's own HTTP health server (it has no other HTTP interface).
  WORKER_HEALTH_PORT: numberField(3002),

  // Database
  DATABASE_URL: z.string(),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // MinIO
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: numberField(9000),
  MINIO_ACCESS_KEY: z.string().default('minioadmin'),
  MINIO_SECRET_KEY: z.string().default('minioadmin'),
  MINIO_BUCKET: z.string().default('careeros'),
  MINIO_USE_SSL: z.coerce.boolean().default(false),

  // Mailpit / SMTP
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: numberField(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('CareerOS <noreply@careeros.local>'),

  // Auth
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  ARGON2_MEMORY_COST: numberField(65536),
  ARGON2_TIME_COST: numberField(3),
  ARGON2_PARALLELISM: numberField(4),

  // AI
  // When false, the backend skips AI matching and the vacancy-analysis queue
  // entirely — search returns persisted vacancies with no scores. Useful for
  // local development, UI testing, and provider debugging without burning
  // AI provider quota.
  AI_ENABLED: booleanField(true),
  AI_PROVIDER: z.string().default('openai'),
  // Overrides the selected provider's hardcoded default model when set. Only
  // applied to the primary AI_PROVIDER — fallback providers (AI_FALLBACK_PROVIDERS)
  // use their own defaults, since model IDs aren't portable across vendors.
  AI_MODEL: z.string().optional(),
  // Overrides the 60s default every provider falls back to when unset.
  AI_TIMEOUT_MS: optionalNumberField(),
  // Comma-separated, ordered list of provider names to fall back to when the
  // primary AI_PROVIDER fails with a retryable error, e.g. "openrouter,openai".
  AI_FALLBACK_PROVIDERS: z.string().optional(),
  // Caps concurrent in-flight AI completion calls; unset means unlimited.
  AI_MAX_CONCURRENCY: optionalNumberField(),
  // How many triage-ranked vacancies get an AI call per search profile per
  // batch. Also used as TriageMatchingService's topN (the two were always the
  // same number, just hardcoded in two places).
  AI_MAX_CANDIDATES: numberField(15),
  // Fan-out for AiMatchingService's concurrent AI calls within a batch.
  AI_MATCHING_CONCURRENCY: numberField(5),
  // Size of each auto-continuation batch drawn from the backlog once a batch
  // finishes (see AiBatchBacklog) — how many more candidates get enqueued at
  // a time until the full candidate pool for a search profile is processed.
  AI_BATCH_SIZE: numberField(15),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  // Cheaper/faster Groq model for low-stakes suggestions (e.g. search profile
  // suggestion), kept separate from the model used for vacancy matching so the
  // two features don't share the same Groq rate limit budget.
  GROQ_SUGGESTION_MODEL: z.string().default('llama-3.1-8b-instant'),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_URL: z.string().optional(),

  // Job providers — each is optional; a provider is only registered when its
  // required identifiers are present, so an unconfigured board is silently
  // skipped rather than failing backend startup.
  // HH (HeadHunter) is the exception: it needs no key to search, so it's
  // always registered. An access token is optional and only raises rate limits.
  HH_ACCESS_TOKEN: z.string().optional(),
  GREENHOUSE_BOARD_TOKEN: z.string().optional(),
  GREENHOUSE_COMPANY_NAME: z.string().optional(),
  LEVER_COMPANY: z.string().optional(),
  LEVER_COMPANY_NAME: z.string().optional(),
  ASHBY_JOB_BOARD_NAME: z.string().optional(),
  ASHBY_COMPANY_NAME: z.string().optional(),
  WORKDAY_TENANT: z.string().optional(),
  WORKDAY_SITE: z.string().optional(),
  WORKDAY_COMPANY_NAME: z.string().optional(),
  WORKDAY_HOST: z.string().optional(),
  TEAMTAILOR_API_KEY: z.string().optional(),
  TEAMTAILOR_COMPANY_NAME: z.string().optional(),

  // Vacancy search / matching pipeline
  // Max vacancies requested per provider per search.
  PROVIDER_SEARCH_LIMIT: numberField(50),
  // Per-provider search timeout — one slow/hung provider can't block the rest.
  PROVIDER_TIMEOUT_MS: numberField(15_000),
  // Local keyword-relevance floor a vacancy must clear to survive rule
  // filtering (before triage/AI ever sees it).
  MIN_RELEVANCE_SCORE: numberField(1),
  // BullMQ vacancy-analysis worker concurrency (apps/worker).
  WORKER_CONCURRENCY: numberField(5),
  // Gates the /api/v1/diagnostics/* routes and the dashboard diagnostics page.
  // Default off so a misconfigured production deploy never exposes pipeline
  // internals by accident.
  DIAGNOSTICS_ENABLED: booleanField(false),
});

export type Config = z.infer<typeof configSchema>;

let config: Config | null = null;

export function loadConfig(): Config {
  if (config) return config;

  const result = configSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment variables:', result.error.format());
    throw new Error('Invalid environment variables');
  }

  config = result.data;
  return config;
}

export function getConfig(): Config {
  if (!config) {
    throw new Error('Config not loaded. Call loadConfig() first.');
  }
  return config;
}

// For testing only
export function resetConfig(): void {
  config = null;
}
