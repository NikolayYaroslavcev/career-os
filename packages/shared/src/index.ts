export { loadConfig, getConfig } from './config.js';
export type { Config } from './config.js';

export { createLogger, getLogger } from './logger.js';
export type { LogLevel } from './logger.js';

export { runHealthChecks } from './health.js';
export type { HealthCheckResult, HealthCheck } from './health.js';

export { getRedis, disconnectRedis, checkRedisHealth } from './redis.js';

export { VACANCY_ANALYSIS_QUEUE_NAME, VACANCY_ANALYSIS_JOB_NAME, buildVacancyAnalysisJobId } from './queues/vacancy-analysis.js';
export type { VacancyAnalysisJob } from './queues/vacancy-analysis.js';

export { RESUME_TAILORING_QUEUE_NAME, RESUME_TAILORING_JOB_NAME, buildResumeTailoringJobId } from './queues/resume-tailoring.js';
export type { ResumeTailoringJob } from './queues/resume-tailoring.js';

export {
  FOLLOW_UP_REMINDER_QUEUE_NAME,
  FOLLOW_UP_REMINDER_JOB_NAME,
  FOLLOW_UP_REMINDER_SWEEP_INTERVAL_MS,
} from './queues/follow-up-reminder.js';

export {
  COMPANY_WATCH_QUEUE,
  COMPANY_WATCH_SYNC_JOB,
  COMPANY_WATCH_SCHEDULER_QUEUE_NAME,
  COMPANY_WATCH_SCHEDULER_JOB_NAME,
  COMPANY_WATCH_SCHEDULER_SWEEP_INTERVAL_MS,
} from './queues/company-watch.js';
export type { CompanyWatchSyncJob } from './queues/company-watch.js';

export {
  DISCOVERY_SOURCE_SCHEDULER_QUEUE_NAME,
  DISCOVERY_SOURCE_SCHEDULER_JOB_NAME,
  DISCOVERY_SOURCE_SCHEDULER_SWEEP_INTERVAL_MS,
  DISCOVERY_SOURCE_RUN_QUEUE,
  DISCOVERY_SOURCE_RUN_JOB,
  DISCOVERY_SOURCE_DEFAULT_INTERVALS_MS,
} from './queues/discovery-source.js';
export type { DiscoverySourceRunJob } from './queues/discovery-source.js';

export { RedisAiBatchBacklog, InMemoryAiBatchBacklog } from './queues/ai-batch-backlog.js';
export type { AiBatchBacklog } from './queues/ai-batch-backlog.js';

export { EncryptionService, getEncryptionService, resetEncryptionService, validateEncryptionConfig } from './encryption.js';

export { normalizeForMatching, computeLevenshteinSimilarity } from './similarity.js';

export {
  parseTelegramChannelList,
  isValidTelegramChannelUsername,
  validateTelegramChannelUsername,
  InvalidTelegramChannelUsernameError,
} from './telegram-channels.js';
