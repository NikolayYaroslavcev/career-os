import type { AIProvider, TokenUsage } from '@careeros/ai';
import type {
  AIJobRepository,
  AICacheRepository,
  AIUsageRepository,
  AIProviderConfigRepository,
  AIBudgetRepository,
} from '@careeros/database';

export type AIFeature =
  | 'analyze_vacancy'
  | 'tailor_resume'
  | 'cover_letter'
  | 'interview_prep'
  | 'salary_analysis'
  | 'company_analysis'
  | 'resume_improvement'
  | 'career_advice'
  // Bulk/background call sites that call an AIProvider directly instead of going
  // through AIOrchestrator.execute() (no caching/job tracking needed), but still
  // need budget-check attribution — see AiMatchingService and
  // SearchProfileSuggestionService in apps/backend.
  | 'vacancy_matching'
  | 'resume_extraction'
  | 'search_profile_suggestion';

export type AIMode = 'manual' | 'smart' | 'automatic';

export interface AIOrchestratorConfig {
  readonly redisUrl: string;
  readonly defaultProvider: string;
  readonly defaultModel?: string;
  readonly fallbackProviders?: string[];
  readonly cacheTtlMs?: number;
  readonly maxRetries?: number;
  readonly budgetCheckEnabled?: boolean;
  readonly aiMode?: AIMode;
  readonly featureProviderMap?: Partial<Record<AIFeature, string>>;
}

export interface AIOrchestratorDeps {
  readonly aiProvider: AIProvider;
  readonly aiJobRepository: AIJobRepository;
  readonly aiCacheRepository: AICacheRepository;
  readonly aiUsageRepository: AIUsageRepository;
  readonly aiProviderConfigRepository: AIProviderConfigRepository;
  readonly aiBudgetRepository: AIBudgetRepository;
  readonly logger?: {
    readonly info: (msg: string, ctx?: Record<string, unknown>) => void;
    readonly warn: (msg: string, ctx?: Record<string, unknown>) => void;
    readonly error: (msg: string, err?: Error, ctx?: Record<string, unknown>) => void;
    readonly debug: (msg: string, ctx?: Record<string, unknown>) => void;
  };
}

export interface ExecuteAIParams {
  readonly feature: AIFeature;
  readonly userId: string;
  readonly input: unknown;
  readonly inputHash: string;
  readonly options?: {
    readonly provider?: string;
    readonly model?: string;
    readonly priority?: number;
    readonly cacheTtlMs?: number;
    readonly skipCache?: boolean;
    readonly timeoutMs?: number;
  };
}

export interface ExecuteAIResult<T = unknown> {
  readonly jobId: string;
  readonly status: 'cached' | 'queued' | 'completed' | 'failed';
  readonly result?: T;
  readonly cached: boolean;
  readonly usage?: {
    readonly provider: string;
    readonly model: string;
    readonly tokensIn: number;
    readonly tokensOut: number;
    readonly estimatedCost: number;
    readonly latencyMs: number;
  };
}

export interface UsageStats {
  readonly totalRequests: number;
  readonly totalTokens: number;
  readonly totalCost: number;
  readonly cacheHits: number;
  readonly cacheMisses: number;
  readonly cacheHitRate: number;
  readonly avgLatencyMs: number;
  readonly byProvider: Record<string, { requests: number; tokens: number; cost: number }>;
  readonly byModel: Record<string, { requests: number; tokens: number; cost: number }>;
  readonly byFeature: Record<string, { requests: number; tokens: number; cost: number }>;
}

export interface DashboardData {
  readonly today: UsageStats;
  readonly week: UsageStats;
  readonly month: UsageStats;
  readonly monthlyCost: number;
  readonly savedTokens: number;
  readonly mostExpensiveFeature: string;
  readonly mostFrequentFeature: string;
  readonly recentJobs: Array<{
    readonly id: string;
    readonly feature: string;
    readonly status: string;
    readonly provider: string | null;
    readonly model: string | null;
    readonly totalTokens: number;
    readonly estimatedCost: number;
    readonly createdAt: Date;
  }>;
}

export interface CacheEntry<T = unknown> {
  readonly response: T;
  readonly provider: string;
  readonly model: string;
  readonly promptVersion: string;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly estimatedCost: number;
}

export interface JobHandlerResult<TOutput = unknown> {
  readonly result: TOutput;
  readonly usage: TokenUsage;
}

export interface JobHandler<TInput = unknown, TOutput = unknown> {
  readonly feature: AIFeature;
  execute(input: TInput, provider: AIProvider): Promise<JobHandlerResult<TOutput>>;
}
