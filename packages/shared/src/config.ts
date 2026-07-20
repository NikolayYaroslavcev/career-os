import { z } from 'zod';

const configSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  CORS_ORIGIN: z.string().default('http://localhost:3001'),

  // Database
  DATABASE_URL: z.string(),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // MinIO
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_ACCESS_KEY: z.string().default('minioadmin'),
  MINIO_SECRET_KEY: z.string().default('minioadmin'),
  MINIO_BUCKET: z.string().default('careeros'),
  MINIO_USE_SSL: z.coerce.boolean().default(false),

  // Mailpit / SMTP
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default('CareerOS <noreply@careeros.local>'),

  // Auth
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  ARGON2_MEMORY_COST: z.coerce.number().default(65536),
  ARGON2_TIME_COST: z.coerce.number().default(3),
  ARGON2_PARALLELISM: z.coerce.number().default(4),

  // AI
  AI_PROVIDER: z.string().default('openai'),
  // Overrides the selected provider's hardcoded default model when set. Only
  // applied to the primary AI_PROVIDER — fallback providers (AI_FALLBACK_PROVIDERS)
  // use their own defaults, since model IDs aren't portable across vendors.
  AI_MODEL: z.string().optional(),
  // Overrides the 60s default every provider falls back to when unset.
  AI_TIMEOUT_MS: z.coerce.number().optional(),
  // Comma-separated, ordered list of provider names to fall back to when the
  // primary AI_PROVIDER fails with a retryable error, e.g. "openrouter,openai".
  AI_FALLBACK_PROVIDERS: z.string().optional(),
  // Caps concurrent in-flight AI completion calls; unset means unlimited.
  AI_MAX_CONCURRENCY: z.coerce.number().optional(),
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
