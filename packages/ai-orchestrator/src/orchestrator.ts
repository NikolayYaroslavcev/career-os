import { estimateCost } from '@careeros/ai';
import type {
  AIJobRepository,
  AIUsageRepository,
} from '@careeros/database';
import type {
  AIFeature,
  AIOrchestratorConfig,
  AIOrchestratorDeps,
  ExecuteAIParams,
  ExecuteAIResult,
  UsageStats,
  DashboardData,
  JobHandler,
} from './orchestrator-config.js';
import { PersistentCache } from './cache/persistent-cache.js';
import type { CacheKeyInput } from './cache/cache-key.js';
import { UsageTracker } from './usage/usage-tracker.js';
import { BudgetEnforcer } from './usage/budget-enforcer.js';
import { getModelPricing } from './usage/pricing.js';
import { ProviderRouter } from './provider-router/provider-router.js';
import { AIModeManager } from './modes/ai-mode-manager.js';
import { AIJobQueue } from './queue/ai-job-queue.js';

const DEFAULT_LOGGER = {
  info: (msg: string, ctx?: Record<string, unknown>): void => console.log(JSON.stringify({ level: 'info', msg, ...ctx })),
  warn: (msg: string, ctx?: Record<string, unknown>): void => console.warn(JSON.stringify({ level: 'warn', msg, ...ctx })),
  error: (msg: string, err?: Error, ctx?: Record<string, unknown>): void => console.error(JSON.stringify({ level: 'error', msg, error: err?.message, ...ctx })),
  debug: (msg: string, ctx?: Record<string, unknown>): void => console.debug(JSON.stringify({ level: 'debug', msg, ...ctx })),
};

export class AIOrchestrator {
  private readonly jobRepository: AIJobRepository;
  private readonly usageRepository: AIUsageRepository;
  private readonly cache: PersistentCache;
  private readonly usageTracker: UsageTracker;
  private readonly budgetEnforcer: BudgetEnforcer;
  private readonly providerRouter: ProviderRouter;
  private readonly modeManager: AIModeManager;
  private readonly jobQueue: AIJobQueue;
  private readonly handlers: Map<AIFeature, JobHandler>;
  private readonly config: AIOrchestratorConfig;
  private readonly logger: typeof DEFAULT_LOGGER;

  constructor(deps: AIOrchestratorDeps, config: AIOrchestratorConfig, handlers: Map<AIFeature, JobHandler>) {
    this.jobRepository = deps.aiJobRepository;
    this.usageRepository = deps.aiUsageRepository;
    this.logger = deps.logger ?? DEFAULT_LOGGER;
    this.config = config;
    this.handlers = handlers;

    this.cache = new PersistentCache(deps.aiCacheRepository, {
      defaultTtlMs: config.cacheTtlMs,
    });

    this.usageTracker = new UsageTracker(deps.aiUsageRepository);
    this.budgetEnforcer = new BudgetEnforcer(deps.aiBudgetRepository, this.usageTracker);

    this.providerRouter = new ProviderRouter(
      deps.aiProviderConfigRepository,
      {
        defaultProvider: config.defaultProvider,
        defaultModel: config.defaultModel,
        featureProviderMap: config.featureProviderMap,
      },
      (_name, _providerConfig) => deps.aiProvider // Simplified: use the injected provider
    );

    this.modeManager = new AIModeManager(config.aiMode ?? 'manual');

    this.jobQueue = new AIJobQueue(
      config.redisUrl,
      deps.aiJobRepository,
      deps.aiUsageRepository,
      handlers,
      config
    );
  }

  async execute<T = unknown>(params: ExecuteAIParams): Promise<ExecuteAIResult<T>> {
    const { feature, userId, input, inputHash, options } = params;

    // 1. Check mode
    const modeCheck = await this.modeManager.canExecute(feature);
    if (!modeCheck.allowed) {
      return {
        jobId: '',
        status: 'failed',
        cached: false,
        result: undefined,
      };
    }

    // 2. Check budget
    if (this.config.budgetCheckEnabled !== false) {
      const budgetCheck = await this.budgetEnforcer.checkBudget(userId, feature);
      if (!budgetCheck.allowed) {
        this.logger.warn('Budget limit reached', {
          feature,
          userId,
          reason: budgetCheck.reason,
        });
        return {
          jobId: '',
          status: 'failed',
          cached: false,
          result: undefined,
        };
      }
    }

    // 3. Check cache (unless skipped)
    const cacheKey: CacheKeyInput | null = options?.skipCache
      ? null
      : {
          provider: options?.provider ?? this.config.defaultProvider,
          model: options?.model ?? this.config.defaultModel ?? 'default',
          promptVersion: '1.0.0', // Will be replaced by handler
          feature,
          contentHash: inputHash,
          userId,
        };

    if (cacheKey) {
      const cached = await this.cache.get<T>(cacheKey);
      if (cached) {
        this.logger.info('Cache hit', { feature, userId });

        // Track usage as cache hit, using the real usage recorded when this
        // entry was first cached (not zeros).
        await this.usageTracker.track({
          userId,
          provider: cached.provider,
          model: cached.model,
          feature,
          tokensIn: cached.tokensIn,
          tokensOut: cached.tokensOut,
          totalTokens: cached.tokensIn + cached.tokensOut,
          estimatedCost: cached.estimatedCost,
          latencyMs: 0,
          cacheHit: true,
          cacheMiss: false,
        });

        return {
          jobId: '',
          status: 'cached',
          result: cached.response,
          cached: true,
        };
      }
    }

    // 4. Create job record
    const job = await this.jobRepository.create({
      userId,
      feature,
      inputHash,
      cacheKey: inputHash,
      priority: options?.priority ?? 0,
      input,
      maxRetries: this.config.maxRetries ?? 3,
    });

    this.logger.info('Job created', { jobId: job.id, feature, userId });

    // 5. Execute synchronously (for now - can be made async with queue)
    const startTime = Date.now();
    try {
      const handler = this.handlers.get(feature);
      if (!handler) {
        throw new Error(`No handler registered for feature: ${feature}`);
      }

      const provider = await this.providerRouter.resolveProvider(feature, userId, {
        provider: options?.provider,
        model: options?.model,
      });

      await this.jobRepository.update(job.id, {
        status: 'PROCESSING',
        provider: provider.name,
        model: provider.defaultModel,
        startedAt: new Date(),
      });

      const { result, usage } = await handler.execute(input, provider);
      const latencyMs = Date.now() - startTime;

      const tokensIn = usage.promptTokens;
      const tokensOut = usage.completionTokens;
      const totalTokens = usage.totalTokens;
      const estimatedCost = estimateCost(usage, getModelPricing(provider.name, provider.defaultModel));

      await this.jobRepository.update(job.id, {
        status: 'COMPLETED',
        result,
        latencyMs,
        completedAt: new Date(),
      });

      // Track usage
      await this.usageTracker.track({
        userId,
        jobId: job.id,
        provider: provider.name,
        model: provider.defaultModel,
        feature,
        tokensIn,
        tokensOut,
        totalTokens,
        estimatedCost,
        latencyMs,
        cacheHit: false,
        cacheMiss: true,
      });

      if (cacheKey) {
        await this.cache.set(cacheKey, result, { tokensIn, tokensOut, estimatedCost }, options?.cacheTtlMs);
      }

      return {
        jobId: job.id,
        status: 'completed',
        result: result as T,
        cached: false,
        usage: {
          provider: provider.name,
          model: provider.defaultModel,
          tokensIn,
          tokensOut,
          estimatedCost,
          latencyMs,
        },
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      await this.jobRepository.update(job.id, {
        status: 'FAILED',
        error: errorMessage,
        latencyMs,
        completedAt: new Date(),
      });

      this.logger.error('Job failed', error instanceof Error ? error : new Error(errorMessage), {
        jobId: job.id,
        feature,
        userId,
      });

      return {
        jobId: job.id,
        status: 'failed',
        cached: false,
      };
    }
  }

  async canExecute(feature: AIFeature, userId: string): Promise<{ allowed: boolean; reason?: string }> {
    const modeCheck = await this.modeManager.canExecute(feature);
    if (!modeCheck.allowed) {
      return { allowed: false, reason: modeCheck.reason };
    }

    if (this.config.budgetCheckEnabled !== false) {
      const budgetCheck = await this.budgetEnforcer.checkBudget(userId, feature);
      if (!budgetCheck.allowed) {
        return { allowed: false, reason: budgetCheck.reason };
      }
    }

    return { allowed: true };
  }

  async getJobStatus(jobId: string): ReturnType<AIJobRepository['findById']> {
    return this.jobRepository.findById(jobId);
  }

  async getUserJobs(userId: string, options?: { feature?: string; status?: string; limit?: number; offset?: number }): ReturnType<AIJobRepository['findByUserId']> {
    return this.jobRepository.findByUserId(userId, options);
  }

  async cancelJob(jobId: string): Promise<void> {
    await this.jobRepository.update(jobId, { status: 'CANCELLED' });
  }

  async getUsageStats(userId: string, period: 'today' | 'week' | 'month'): Promise<UsageStats> {
    switch (period) {
      case 'today':
        return this.usageTracker.getTodayUsage(userId);
      case 'week':
        return this.usageTracker.getWeekUsage(userId);
      case 'month':
        return this.usageTracker.getMonthUsage(userId);
    }
  }

  async getDashboardData(userId: string): Promise<DashboardData> {
    const [today, week, month] = await Promise.all([
      this.usageTracker.getTodayUsage(userId),
      this.usageTracker.getWeekUsage(userId),
      this.usageTracker.getMonthUsage(userId),
    ]);

    // Find most expensive and most frequent features
    const featureCosts = Object.entries(month.byFeature);
    const mostExpensiveFeature = featureCosts.length > 0
      ? featureCosts.reduce((max, [feature, data]) => data.cost > (max[1]?.cost ?? 0) ? [feature, data] : max)[0]
      : 'none';

    const featureRequests = Object.entries(month.byFeature);
    const mostFrequentFeature = featureRequests.length > 0
      ? featureRequests.reduce((max, [feature, data]) => data.requests > (max[1]?.requests ?? 0) ? [feature, data] : max)[0]
      : 'none';

    // Estimate monthly cost (extrapolate from current month)
    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const estimatedMonthlyCost = dayOfMonth > 0 ? (month.totalCost / dayOfMonth) * daysInMonth : 0;

    // Get recent jobs
    const recentJobs = await this.jobRepository.findByUserId(userId, { limit: 10 });

    return {
      today,
      week,
      month,
      estimatedMonthlyCost,
      savedTokens: week.cacheHits > 0 ? week.totalTokens * week.cacheHitRate : 0,
      mostExpensiveFeature,
      mostFrequentFeature,
      recentJobs: recentJobs.map(job => ({
        id: job.id,
        feature: job.feature,
        status: job.status,
        provider: job.provider,
        model: job.model,
        totalTokens: job.totalTokens,
        estimatedCost: job.estimatedCost,
        createdAt: job.createdAt,
      })),
    };
  }

  async getMode(): Promise<string> {
    return this.modeManager.getMode();
  }

  async setMode(mode: 'manual' | 'smart' | 'automatic'): Promise<void> {
    this.modeManager.setMode(mode);
  }

  async invalidateCache(feature?: string): Promise<number> {
    return this.cache.invalidate(feature);
  }

  async getCacheStats(): ReturnType<PersistentCache['getStats']> {
    return this.cache.getStats();
  }

  getHandlers(): Map<AIFeature, JobHandler> {
    return this.handlers;
  }
}
