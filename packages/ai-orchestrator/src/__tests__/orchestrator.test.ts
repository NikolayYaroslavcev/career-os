import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AIProvider } from '@careeros/ai';
import { DuplicateAIJobError } from '@careeros/database';
import type {
  AIJobRepository,
  AICacheRepository,
  AIUsageRepository,
  AIProviderConfigRepository,
  AIBudgetRepository,
} from '@careeros/database';
import { AIOrchestrator } from '../orchestrator.js';
import type { AIFeature, JobHandler } from '../orchestrator-config.js';

// Mock repositories
const mockJobRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  findActiveByKey: vi.fn(),
  findByUserId: vi.fn(),
  update: vi.fn(),
  countByUserAndFeature: vi.fn(),
  countByUser: vi.fn(),
};

const mockCacheRepository = {
  create: vi.fn(),
  findByKey: vi.fn(),
  incrementHitCount: vi.fn(),
  deleteExpired: vi.fn(),
  deleteByFeature: vi.fn(),
  deleteAll: vi.fn(),
  getStats: vi.fn(),
};

const mockUsageRepository = {
  create: vi.fn(),
  findByUserId: vi.fn(),
  getUsageSummary: vi.fn(),
  getDailyUsage: vi.fn(),
  getWeeklyUsage: vi.fn(),
  getMonthlyUsage: vi.fn(),
  getTotalTokensSince: vi.fn(),
  getTotalCostSince: vi.fn(),
  getRequestCountSince: vi.fn(),
};

const mockProviderConfigRepository = {
  upsert: vi.fn(),
  findById: vi.fn(),
  findByUserAndProvider: vi.fn(),
  findByUserId: vi.fn(),
  findGlobal: vi.fn(),
  findActiveByPriority: vi.fn(),
  delete: vi.fn(),
  deleteByUserAndProvider: vi.fn(),
};

const mockBudgetRepository = {
  upsert: vi.fn(),
  findByUserAndPeriod: vi.fn(),
  findGlobalByPeriod: vi.fn(),
  update: vi.fn(),
};

const mockProvider = {
  name: 'test-provider',
  defaultModel: 'test-model',
  complete: vi.fn(),
  getCapabilities: vi.fn(),
  validateConfig: vi.fn(),
};

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

const MOCK_USAGE = { promptTokens: 100, completionTokens: 50, totalTokens: 150 };

function createMockHandler(feature: AIFeature): JobHandler {
  return {
    feature,
    execute: vi.fn().mockResolvedValue({ result: 'test', usage: MOCK_USAGE }),
  };
}

describe('AIOrchestrator', () => {
  let orchestrator: AIOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();

    mockJobRepository.create.mockResolvedValue({
      id: 'job-1',
      userId: 'user-1',
      feature: 'analyze_vacancy',
      status: 'PENDING',
      createdAt: new Date(),
    });

    mockJobRepository.findActiveByKey.mockResolvedValue(null);
    mockCacheRepository.findByKey.mockResolvedValue(null);
    mockCacheRepository.create.mockResolvedValue({});
    mockUsageRepository.create.mockResolvedValue({});
    mockBudgetRepository.findByUserAndPeriod.mockResolvedValue(null);
    mockProviderConfigRepository.findByUserAndProvider.mockResolvedValue(null);
    mockProviderConfigRepository.findGlobal.mockResolvedValue([]);

    const handlers = new Map<AIFeature, JobHandler>();
    handlers.set('analyze_vacancy', createMockHandler('analyze_vacancy'));
    handlers.set('tailor_resume', createMockHandler('tailor_resume'));

    orchestrator = new AIOrchestrator(
      {
        aiProvider: mockProvider as unknown as AIProvider,
        aiJobRepository: mockJobRepository as unknown as AIJobRepository,
        aiCacheRepository: mockCacheRepository as unknown as AICacheRepository,
        aiUsageRepository: mockUsageRepository as unknown as AIUsageRepository,
        aiProviderConfigRepository: mockProviderConfigRepository as unknown as AIProviderConfigRepository,
        aiBudgetRepository: mockBudgetRepository as unknown as AIBudgetRepository,
        logger: mockLogger,
      },
      {
        redisUrl: 'redis://localhost:6379',
        defaultProvider: 'test-provider',
        defaultModel: 'test-model',
        budgetCheckEnabled: false,
      },
      handlers
    );
  });

  describe('execute', () => {
    it('should create a job and execute the handler', async () => {
      const result = await orchestrator.execute({
        feature: 'analyze_vacancy',
        userId: 'user-1',
        input: { vacancyId: 'v1' },
        inputHash: 'hash-1',
      });

      expect(result.status).toBe('completed');
      expect(result.cached).toBe(false);
      expect(mockJobRepository.create).toHaveBeenCalled();
      expect(mockJobRepository.update).toHaveBeenCalled();
    });

    it('should return cached result when cache hit', async () => {
      mockCacheRepository.findByKey.mockResolvedValue({
        id: 'cache-1',
        response: { cached: true },
        provider: 'test-provider',
        model: 'test-model',
        promptVersion: '1.0.0',
        tokensIn: 0,
        tokensOut: 0,
        estimatedCost: 0,
      });

      const result = await orchestrator.execute({
        feature: 'analyze_vacancy',
        userId: 'user-1',
        input: { vacancyId: 'v1' },
        inputHash: 'hash-1',
      });

      expect(result.status).toBe('cached');
      expect(result.cached).toBe(true);
      expect(result.result).toEqual({ cached: true });
    });

    it('should skip cache when skipCache is true', async () => {
      const result = await orchestrator.execute({
        feature: 'analyze_vacancy',
        userId: 'user-1',
        input: { vacancyId: 'v1' },
        inputHash: 'hash-1',
        options: { skipCache: true },
      });

      expect(result.status).toBe('completed');
      expect(mockCacheRepository.findByKey).not.toHaveBeenCalled();
    });

    it('should return the in-flight job instead of creating a new one on a duplicate submit (double-click / rapid repeat / retry after timeout)', async () => {
      mockJobRepository.findActiveByKey.mockResolvedValue({
        id: 'in-flight-job',
        userId: 'user-1',
        feature: 'analyze_vacancy',
        status: 'PROCESSING',
        createdAt: new Date(),
      });

      const handler = createMockHandler('analyze_vacancy');
      const handlers = new Map<AIFeature, JobHandler>([['analyze_vacancy', handler]]);
      const dupOrchestrator = new AIOrchestrator(
        {
          aiProvider: mockProvider as unknown as AIProvider,
          aiJobRepository: mockJobRepository as unknown as AIJobRepository,
          aiCacheRepository: mockCacheRepository as unknown as AICacheRepository,
          aiUsageRepository: mockUsageRepository as unknown as AIUsageRepository,
          aiProviderConfigRepository: mockProviderConfigRepository as unknown as AIProviderConfigRepository,
          aiBudgetRepository: mockBudgetRepository as unknown as AIBudgetRepository,
          logger: mockLogger,
        },
        { redisUrl: 'redis://localhost:6379', defaultProvider: 'test-provider', defaultModel: 'test-model', budgetCheckEnabled: false },
        handlers
      );

      const result = await dupOrchestrator.execute({
        feature: 'analyze_vacancy',
        userId: 'user-1',
        input: { vacancyId: 'v1' },
        inputHash: 'hash-1',
      });

      expect(result).toEqual({ jobId: 'in-flight-job', status: 'queued', cached: false });
      expect(mockJobRepository.create).not.toHaveBeenCalled();
      expect(handler.execute).not.toHaveBeenCalled();
    });

    it('should return the winning job instead of throwing when two parallel identical requests race past the in-flight check and the DB unique constraint rejects the second insert', async () => {
      mockJobRepository.create.mockRejectedValueOnce(new DuplicateAIJobError('winner-job'));
      mockJobRepository.findById.mockResolvedValue({
        id: 'winner-job',
        userId: 'user-1',
        feature: 'analyze_vacancy',
        status: 'PROCESSING',
        createdAt: new Date(),
      });

      const result = await orchestrator.execute({
        feature: 'analyze_vacancy',
        userId: 'user-1',
        input: { vacancyId: 'v1' },
        inputHash: 'hash-1',
      });

      expect(result).toEqual({ jobId: 'winner-job', status: 'queued', cached: false });
      expect(mockJobRepository.findById).toHaveBeenCalledWith('winner-job');
    });

    it('should return failed status when handler not found', async () => {
      const result = await orchestrator.execute({
        feature: 'unknown_feature' as AIFeature,
        userId: 'user-1',
        input: {},
        inputHash: 'hash-1',
      });

      expect(result.status).toBe('failed');
    });

    it('should persist real (non-zero) token usage and cost after a successful execution', async () => {
      const result = await orchestrator.execute({
        feature: 'analyze_vacancy',
        userId: 'user-1',
        input: { vacancyId: 'v1' },
        inputHash: 'hash-1',
      });

      expect(result.usage?.tokensIn).toBe(MOCK_USAGE.promptTokens);
      expect(result.usage?.tokensOut).toBe(MOCK_USAGE.completionTokens);
      expect(result.usage?.estimatedCost).toBeGreaterThan(0);

      expect(mockUsageRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tokensIn: MOCK_USAGE.promptTokens,
          tokensOut: MOCK_USAGE.completionTokens,
          totalTokens: MOCK_USAGE.totalTokens,
          estimatedCost: expect.any(Number),
        })
      );
      expect(mockUsageRepository.create.mock.calls[0][0].estimatedCost).toBeGreaterThan(0);
    });

    it('should persist token usage and cost on the AI job record for dashboard recent jobs', async () => {
      await orchestrator.execute({
        feature: 'analyze_vacancy',
        userId: 'user-1',
        input: { vacancyId: 'v1' },
        inputHash: 'hash-1',
      });

      expect(mockJobRepository.update).toHaveBeenCalledWith(
        'job-1',
        expect.objectContaining({
          status: 'COMPLETED',
          tokensIn: MOCK_USAGE.promptTokens,
          tokensOut: MOCK_USAGE.completionTokens,
          totalTokens: MOCK_USAGE.totalTokens,
          estimatedCost: expect.any(Number),
        })
      );
    });

    it('should write the result to the persistent cache after a non-cached execution', async () => {
      await orchestrator.execute({
        feature: 'analyze_vacancy',
        userId: 'user-1',
        input: { vacancyId: 'v1' },
        inputHash: 'hash-1',
      });

      expect(mockCacheRepository.create).toHaveBeenCalledTimes(1);
      expect(mockCacheRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tokensIn: MOCK_USAGE.promptTokens,
          tokensOut: MOCK_USAGE.completionTokens,
          estimatedCost: expect.any(Number),
        })
      );
    });

    it('should not write to cache when skipCache is set', async () => {
      await orchestrator.execute({
        feature: 'analyze_vacancy',
        userId: 'user-1',
        input: { vacancyId: 'v1' },
        inputHash: 'hash-1',
        options: { skipCache: true },
      });

      expect(mockCacheRepository.create).not.toHaveBeenCalled();
    });

    it('should block execution and skip the handler when the daily budget is exceeded', async () => {
      mockBudgetRepository.findByUserAndPeriod.mockImplementation(async (_userId: string, period: string) =>
        period === 'DAILY' ? { isEnabled: true, maxTokens: 10, maxCost: null, maxRequestsPerFeature: null } : null
      );
      mockUsageRepository.getTotalTokensSince.mockResolvedValue(100);

      const handlers = new Map<AIFeature, JobHandler>();
      const handler = createMockHandler('analyze_vacancy');
      handlers.set('analyze_vacancy', handler);

      const budgetedOrchestrator = new AIOrchestrator(
        {
          aiProvider: mockProvider as unknown as AIProvider,
          aiJobRepository: mockJobRepository as unknown as AIJobRepository,
          aiCacheRepository: mockCacheRepository as unknown as AICacheRepository,
          aiUsageRepository: mockUsageRepository as unknown as AIUsageRepository,
          aiProviderConfigRepository: mockProviderConfigRepository as unknown as AIProviderConfigRepository,
          aiBudgetRepository: mockBudgetRepository as unknown as AIBudgetRepository,
          logger: mockLogger,
        },
        {
          redisUrl: 'redis://localhost:6379',
          defaultProvider: 'test-provider',
          defaultModel: 'test-model',
          budgetCheckEnabled: true,
        },
        handlers
      );

      const result = await budgetedOrchestrator.execute({
        feature: 'analyze_vacancy',
        userId: 'user-1',
        input: { vacancyId: 'v1' },
        inputHash: 'hash-1',
      });

      expect(result.status).toBe('failed');
      expect(handler.execute).not.toHaveBeenCalled();
      expect(mockUsageRepository.create).not.toHaveBeenCalled();
      expect(mockJobRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('canExecute', () => {
    it('should return allowed for manual mode features', async () => {
      const result = await orchestrator.canExecute('analyze_vacancy', 'user-1');
      expect(result.allowed).toBe(true);
    });
  });

  describe('getJobStatus', () => {
    it('should return job status', async () => {
      mockJobRepository.findById.mockResolvedValue({
        id: 'job-1',
        status: 'COMPLETED',
      });

      const job = await orchestrator.getJobStatus('job-1');
      expect(job).toBeDefined();
      expect(job?.id).toBe('job-1');
    });
  });

  describe('getUserJobs', () => {
    it('should return user jobs', async () => {
      mockJobRepository.findByUserId.mockResolvedValue([
        { id: 'job-1', feature: 'analyze_vacancy' },
      ]);

      const jobs = await orchestrator.getUserJobs('user-1');
      expect(jobs).toHaveLength(1);
    });
  });

  describe('cancelJob', () => {
    it('should update job status to CANCELLED', async () => {
      await orchestrator.cancelJob('job-1');
      expect(mockJobRepository.update).toHaveBeenCalledWith('job-1', { status: 'CANCELLED' });
    });
  });

  describe('invalidateCache', () => {
    it('should clear cache for a feature', async () => {
      mockCacheRepository.deleteByFeature.mockResolvedValue(5);

      const deleted = await orchestrator.invalidateCache('analyze_vacancy');
      expect(deleted).toBe(5);
    });

    it('should clear all cache when no feature specified', async () => {
      mockCacheRepository.deleteAll.mockResolvedValue(10);

      const deleted = await orchestrator.invalidateCache();
      expect(deleted).toBe(10);
    });
  });

  describe('getMode', () => {
    it('should return the current mode', async () => {
      const mode = await orchestrator.getMode();
      expect(mode).toBe('manual');
    });
  });

  describe('setMode', () => {
    it('should update the mode', async () => {
      await orchestrator.setMode('automatic');
      const mode = await orchestrator.getMode();
      expect(mode).toBe('automatic');
    });
  });
});
