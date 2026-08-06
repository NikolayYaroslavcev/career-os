// Core
export { AIOrchestrator } from './orchestrator.js';
export type {
  AIFeature,
  AIMode,
  AIOrchestratorConfig,
  AIOrchestratorDeps,
  ExecuteAIParams,
  ExecuteAIResult,
  UsageStats,
  DashboardData,
  CacheEntry,
  JobHandler,
  JobHandlerResult,
} from './orchestrator-config.js';

// Cache
export { PersistentCache } from './cache/persistent-cache.js';
export { buildCacheKey, buildInputHash } from './cache/cache-key.js';

// Queue
export { AIJobQueue, AI_REQUESTS_QUEUE, AI_REQUEST_JOB } from './queue/ai-job-queue.js';
export type { AIJobPayload, AIJobResult } from './queue/ai-job-queue.js';

// Job Handlers
export { AnalyzeVacancyHandler } from './queue/job-handlers/analyze-vacancy-handler.js';
export type { AnalyzeVacancyInput, AnalyzeVacancyResult } from './queue/job-handlers/analyze-vacancy-handler.js';
// TailorResumeHandler removed (ADR-031) — resume tailoring moved to its own
// async pipeline (packages/ai/src/tailoring, apps/worker), not this
// synchronous orchestrator. 'tailor_resume' stays a valid AIFeature value
// for historical AIJob rows, but nothing constructs this handler anymore.
export { CoverLetterHandler } from './queue/job-handlers/cover-letter-handler.js';
export type { CoverLetterInput, CoverLetterResult } from './queue/job-handlers/cover-letter-handler.js';
export { InterviewPrepHandler } from './queue/job-handlers/interview-prep-handler.js';
export type { InterviewPrepInput, InterviewPrepResult } from './queue/job-handlers/interview-prep-handler.js';
export { SalaryAnalysisHandler } from './queue/job-handlers/salary-analysis-handler.js';
export type { SalaryAnalysisInput, SalaryAnalysisResult } from './queue/job-handlers/salary-analysis-handler.js';
export { CompanyAnalysisHandler } from './queue/job-handlers/company-analysis-handler.js';
export type { CompanyAnalysisInput, CompanyAnalysisResult } from './queue/job-handlers/company-analysis-handler.js';
export { ResumeImprovementHandler } from './queue/job-handlers/resume-improvement-handler.js';
export type { ResumeImprovementInput, ResumeImprovementResult } from './queue/job-handlers/resume-improvement-handler.js';
export { CareerAdviceHandler } from './queue/job-handlers/career-advice-handler.js';
export type { CareerAdviceInput, CareerAdviceResult } from './queue/job-handlers/career-advice-handler.js';

// Usage
export { UsageTracker } from './usage/usage-tracker.js';
export { BudgetEnforcer } from './usage/budget-enforcer.js';
export type { BudgetCheckResult } from './usage/budget-enforcer.js';
export { getModelPricing } from '@careeros/ai';

// Provider Router
export { ProviderRouter } from './provider-router/provider-router.js';

// Modes
export { AIModeManager } from './modes/ai-mode-manager.js';
export type { ModeCheckResult, SmartModeConfig } from './modes/ai-mode-manager.js';

// Notifications
export { AINotificationService } from './notifications/ai-notification-service.js';
export type { AINotification, NotifyParams } from './notifications/ai-notification-service.js';
