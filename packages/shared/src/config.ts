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
  // Global per-IP budget for @fastify/rate-limit (see app.ts), shared across
  // every route. 100/min is the production default; a full-stack E2E run
  // (many sequential page loads, each firing several API calls, against a
  // single-worker Playwright run sharing one client IP) can burn through
  // that budget on its own well within a minute — see docker-compose.full.yml,
  // which raises this for the E2E stack only, not production.
  RATE_LIMIT_MAX: numberField(100),

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
  AI_MODEL: z.preprocess(blankToUndefined, z.string().optional()),
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
  // Local triage-score floor (resume/profile keyword & technology overlap,
  // see relevance-filter.ts) a vacancy must clear to be considered for an AI
  // call at all — independent of the topN cut above. A vacancy with zero
  // overlap scores 0 and is rejected as 'low_relevance' regardless of topN.
  AI_MIN_TRIAGE_SCORE: numberField(2),
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
  DEEPSEEK_API_KEY: z.string().optional(),
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
  // HH_AREAS is a comma-separated list of HH area IDs to sync, sent as
  // repeated `area` query params that api.hh.ru ORs together. Defaults to
  // the CIS area IDs verified against https://api.hh.ru/areas/countries:
  // 113 Russia, 16 Belarus, 40 Kazakhstan, 97 Uzbekistan, 48 Kyrgyzstan,
  // 9 Azerbaijan, 28 Georgia, 13 Armenia, 86 Tajikistan, 62 Moldova.
  // See HH_CIS_AREA_IDS in packages/providers for the same mapping.
  // NOTE: rabota.by has NO API — Belarus jobs are accessed via api.hh.ru
  // area 16. Ukraine (area 5) is deliberately excluded — HH's Ukraine
  // operation was sold/rebranded years before 2022 and current access
  // patterns are unverified; do not add without a separate live check.
  HH_AREAS: z.string().default('113,16,40,97,48,9,28,13,86,62'),
  HH_ACCESS_TOKEN: z.string().optional(),
  ADZUNA_APP_ID: z.string().optional(),
  ADZUNA_APP_KEY: z.string().optional(),
  ADZUNA_COUNTRY: z.string().default('gb'),
  // France Travail requires OAuth2 client credentials from a free
  // francetravail.io developer registration (client_credentials grant) —
  // unlike the no-auth free providers, this can't self-register.
  FRANCE_TRAVAIL_CLIENT_ID: z.string().optional(),
  FRANCE_TRAVAIL_CLIENT_SECRET: z.string().optional(),
  // Comma-separated ROME occupation codes; defaults to M1805 (Études et
  // développement informatique) if unset — see FRANCE_TRAVAIL_DEFAULT_ROME_CODES.
  FRANCE_TRAVAIL_ROME_CODES: z.string().optional(),
  // Greenhouse is per-company (one board token per deployment, unlike HH's
  // single-endpoint-many-countries shape), but defaults to JetBrains
  // (job-boards.eu.greenhouse.io/jetbrains, live-verified) so the slot isn't
  // sitting empty — override both vars together to point at a different
  // company's board instead.
  GREENHOUSE_BOARD_TOKEN: z.preprocess(blankToUndefined, z.string().default('jetbrains')),
  GREENHOUSE_COMPANY_NAME: z.preprocess(blankToUndefined, z.string().default('JetBrains')),
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
  SMARTRECRUITERS_COMPANY: z.string().optional(),
  SMARTRECRUITERS_COMPANY_NAME: z.string().optional(),
  RECRUITEE_COMPANY: z.string().optional(),
  RECRUITEE_COMPANY_NAME: z.string().optional(),
  COMEET_TOKEN: z.string().optional(),
  COMEET_COMPANY_UID: z.string().optional(),
  COMEET_COMPANY_NAME: z.string().optional(),
  // Personio — public unauthenticated per-tenant XML feed
  // (https://{company}.jobs.personio.de/xml), see research/free-provider-expansion.
  // No default: unlike Greenhouse, there's no single well-known Personio
  // tenant worth defaulting to, so this stays opt-in per deployment.
  PERSONIO_COMPANY: z.string().optional(),
  PERSONIO_COMPANY_NAME: z.string().optional(),
  PERSONIO_LANGUAGE: z.string().optional(),
  // Workable — public unauthenticated per-tenant JSON widget endpoint
  // (https://apply.workable.com/api/v1/widget/accounts/{accountSlug}), see
  // research/free-provider-expansion. No default account, same reasoning as Personio.
  WORKABLE_ACCOUNT_SLUG: z.string().optional(),
  WORKABLE_COMPANY_NAME: z.string().optional(),
  LINKEDIN_ENABLED: z.string().optional(),
  // SuperJob — requires an X-Api-App-Id secret key for every endpoint
  // (including plain vacancy search), obtained via free self-service signup
  // at https://api.superjob.ru/register/ (create account, create app, no
  // OAuth needed for read-only search). See ADR/backend notes: the
  // registration page itself is blocked by SuperJob's WAF from some
  // datacenter IPs, so provisioning this key may require a residential/RU IP.
  SUPERJOB_API_KEY: z.string().optional(),
  // Telegram public vacancy channels — comma-separated bare usernames, no
  // `@`/`t.me/` prefix (e.g. "remoteit,frontend_jobs,it_vacancy"). Scraped via
  // each channel's public `/s/` preview page (no bot token or login needed);
  // a provider with no channels configured is skipped, same as the other
  // conditionally-registered providers above.
  TELEGRAM_CHANNELS: z.string().optional(),

  // Comma-separated workspace IDs allowed to receive scheduled provider
  // sync at boot (apps/backend/src/app.ts onReady hook). Providers like
  // Telegram/JustJoin.it/HH take no workspace parameter — the same global
  // content gets fetched and persisted once per workspace that's started,
  // so syncing every row in the Workspace table (including throwaway
  // e2e-test workspaces that never get cleaned up) fans a single sync out
  // into dozens of redundant external fetches and duplicate VacancySource
  // rows. Unset = sync all workspaces (previous, unfiltered behavior).
  SYNC_WORKSPACE_ALLOWLIST: z.string().optional(),

  // Vacancy search / matching pipeline
  // Max vacancies requested per provider per search.
  PROVIDER_SEARCH_LIMIT: numberField(50),
  // Per-provider search timeout — one slow/hung provider can't block the rest.
  PROVIDER_TIMEOUT_MS: numberField(15_000),
  // Local keyword-relevance floor a vacancy must clear to survive rule
  // filtering (before triage/AI ever sees it). A single incidental keyword
  // hit in the description alone scores 1 — kept at 2 so that lone hit isn't
  // enough on its own, while a single title or technology match still is.
  MIN_RELEVANCE_SCORE: numberField(2),
  // BullMQ vacancy-analysis worker concurrency (apps/worker).
  WORKER_CONCURRENCY: numberField(5),
  // Gates the /api/v1/diagnostics/* routes and the dashboard diagnostics page.
  // Default off so a misconfigured production deploy never exposes pipeline
  // internals by accident.
  DIAGNOSTICS_ENABLED: booleanField(false),

  // Company Discovery (ADR-035 §4) — single system workspace AUTO_APPROVED
  // candidates are auto-converted into CompanyWatch rows under. Unset means
  // auto-enrollment stops at AUTO_APPROVED and waits for a human to approve
  // it into an explicit workspace via the review queue.
  DISCOVERY_WORKSPACE_ID: z.string().optional(),

  // ADR-035 Phase 4 — bulk DiscoverySource seed config. Unauthenticated
  // GitHub API is rate-limited to 60 req/hour; DISCOVERY_GITHUB_TOKEN raises
  // this to 5,000/hour (same "conditionally registered, needs credentials"
  // pattern as FRANCE_TRAVAIL_CLIENT_ID above) — optional, not required.
  DISCOVERY_GITHUB_TOKEN: z.string().optional(),
  // Comma-separated GitHub org logins to resolve via GitHubOrgsDiscoverySource.
  DISCOVERY_GITHUB_ORG_SEEDS: z.string().optional(),
  // Comma-separated domains (no protocol) JsonLdCrawlDiscoverySource re-scans
  // for schema.org JobPosting markup — see EPIC-18's "CC-Index-seeded, not
  // standalone crawlers" note for why this needs a seed at all.
  DISCOVERY_JSONLD_SEED_DOMAINS: z.string().optional(),
  // Same shape for RssCareerFeedDiscoverySource.
  DISCOVERY_RSS_SEED_DOMAINS: z.string().optional(),
  // Web Data Commons JobPosting subset file URL — unset means the source
  // stays disabled (see WebDataCommonsJobPostingSource's doc comment: this
  // pass could not locate a directly fetchable subset URL within scope).
  DISCOVERY_WDC_SOURCE_FILE_URL: z.string().optional(),

  // AI Orchestrator
  AI_ORCHESTRATOR_MODE: z.enum(['manual', 'smart', 'automatic']).default('manual'),
  AI_CACHE_TTL_MS: numberField(86400000), // 24h default
  AI_BUDGET_CHECK_ENABLED: booleanField(true),
  AI_FEATURE_PROVIDER_MAP: z.string().optional(), // JSON: { "cover_letter": "openai", ... }
});

export type Config = z.infer<typeof configSchema>;

let config: Config | null = null;

// Values that satisfy the schema's format/length rules but are well-known
// placeholders — safe for local dev (docker-compose seeds exactly these), but
// never acceptable in production. Checked only when NODE_ENV === 'production'
// so local/test setups are unaffected.
const WEAK_JWT_SECRETS = new Set([
  'changeme',
  'change-me',
  'changeme'.repeat(4),
  'secret',
  'password',
  'test-secret-key-at-least-32-characters-long',
  'your-secret-key-here-min-32-characters',
]);
const WEAK_MINIO_VALUE = 'minioadmin';

function assertProductionSecretsAreStrong(cfg: Config): void {
  if (cfg.NODE_ENV !== 'production') return;

  const errors: string[] = [];

  const normalizedJwtSecret = cfg.JWT_SECRET.toLowerCase();
  const distinctChars = new Set(cfg.JWT_SECRET).size;
  if (WEAK_JWT_SECRETS.has(normalizedJwtSecret) || distinctChars < 8) {
    errors.push('JWT_SECRET appears to be a placeholder/low-entropy value; set a strong random secret in production.');
  }

  if (cfg.MINIO_ACCESS_KEY === WEAK_MINIO_VALUE || cfg.MINIO_SECRET_KEY === WEAK_MINIO_VALUE) {
    errors.push('MINIO_ACCESS_KEY/MINIO_SECRET_KEY are still the default "minioadmin"; set real credentials in production.');
  }

  if (errors.length > 0) {
    throw new Error(`Refusing to start in production with insecure config:\n${errors.join('\n')}`);
  }
}

export function loadConfig(): Config {
  if (config) return config;

  const result = configSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment variables:', result.error.format());
    throw new Error('Invalid environment variables');
  }

  assertProductionSecretsAreStrong(result.data);

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
