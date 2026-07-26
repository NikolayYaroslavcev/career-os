import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AIBudgetRepository } from '@careeros/database';
import { BudgetEnforcer } from '../usage/budget-enforcer.js';
import type { UsageTracker } from '../usage/usage-tracker.js';

const mockBudgetRepository = {
  upsert: vi.fn(),
  findByUserAndPeriod: vi.fn(),
  findGlobalByPeriod: vi.fn(),
  update: vi.fn(),
};

const mockUsageTracker = {
  getTotalTokensToday: vi.fn(),
  getTotalTokensThisMonth: vi.fn(),
  getTotalCostThisMonth: vi.fn(),
  getTotalTokensSince: vi.fn(),
  getTotalCostSince: vi.fn(),
  getRequestCountForFeature: vi.fn(),
};

describe('BudgetEnforcer', () => {
  let enforcer: BudgetEnforcer;

  beforeEach(() => {
    vi.clearAllMocks();
    enforcer = new BudgetEnforcer(
      mockBudgetRepository as unknown as AIBudgetRepository,
      mockUsageTracker as unknown as UsageTracker,
    );
  });

  describe('checkBudget', () => {
    it('should allow when no budget is configured', async () => {
      mockBudgetRepository.findByUserAndPeriod.mockResolvedValue(null);

      const result = await enforcer.checkBudget('user-1', 'analyze_vacancy');
      expect(result.allowed).toBe(true);
    });

    it('should deny when daily token limit is reached', async () => {
      mockBudgetRepository.findByUserAndPeriod.mockImplementation((_userId, period) => {
        if (period === 'DAILY') {
          return Promise.resolve({ isEnabled: true, maxTokens: 1000, maxCost: null, maxRequestsPerFeature: null });
        }
        return Promise.resolve(null);
      });

      mockUsageTracker.getTotalTokensSince.mockResolvedValue(1000);

      const result = await enforcer.checkBudget('user-1', 'analyze_vacancy');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('token limit');
    });

    it('should deny when monthly cost limit is reached', async () => {
      mockBudgetRepository.findByUserAndPeriod.mockImplementation((_userId, period) => {
        if (period === 'MONTHLY') {
          return Promise.resolve({ isEnabled: true, maxTokens: null, maxCost: 10, maxRequestsPerFeature: null });
        }
        return Promise.resolve(null);
      });

      mockUsageTracker.getTotalCostSince.mockResolvedValue(10);

      const result = await enforcer.checkBudget('user-1', 'analyze_vacancy');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('cost limit');
    });

    it('should deny when per-feature request limit is reached', async () => {
      mockBudgetRepository.findByUserAndPeriod.mockImplementation((_userId, period) => {
        if (period === 'DAILY') {
          return Promise.resolve({
            isEnabled: true,
            maxTokens: null,
            maxCost: null,
            maxRequestsPerFeature: { cover_letter: 5 },
          });
        }
        return Promise.resolve(null);
      });

      mockUsageTracker.getRequestCountForFeature.mockResolvedValue(5);

      const result = await enforcer.checkBudget('user-1', 'cover_letter');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('request limit');
    });

    it('should allow when under all limits', async () => {
      mockBudgetRepository.findByUserAndPeriod.mockImplementation((_userId, period) => {
        if (period === 'DAILY') {
          return Promise.resolve({ isEnabled: true, maxTokens: 1000, maxCost: 10, maxRequestsPerFeature: { cover_letter: 5 } });
        }
        return Promise.resolve(null);
      });

      mockUsageTracker.getTotalTokensSince.mockResolvedValue(500);
      mockUsageTracker.getTotalCostSince.mockResolvedValue(5);
      mockUsageTracker.getRequestCountForFeature.mockResolvedValue(3);

      const result = await enforcer.checkBudget('user-1', 'cover_letter');
      expect(result.allowed).toBe(true);
    });

    it('should allow when budget is disabled', async () => {
      mockBudgetRepository.findByUserAndPeriod.mockResolvedValue({ isEnabled: false });

      const result = await enforcer.checkBudget('user-1', 'analyze_vacancy');
      expect(result.allowed).toBe(true);
    });
  });

  describe('period aggregation', () => {
    it('should query daily budgets against start-of-day, not start-of-month', async () => {
      mockBudgetRepository.findByUserAndPeriod.mockImplementation((_userId, period) => {
        if (period === 'DAILY') {
          return Promise.resolve({ isEnabled: true, maxTokens: 1000, maxCost: null, maxRequestsPerFeature: null });
        }
        return Promise.resolve(null);
      });
      mockUsageTracker.getTotalTokensSince.mockResolvedValue(100);

      await enforcer.checkBudget('user-1', 'analyze_vacancy');

      expect(mockUsageTracker.getTotalTokensSince).toHaveBeenCalledTimes(1);
      const since: Date = mockUsageTracker.getTotalTokensSince.mock.calls[0][1];
      const now = new Date();
      expect(since.getFullYear()).toBe(now.getFullYear());
      expect(since.getMonth()).toBe(now.getMonth());
      expect(since.getDate()).toBe(now.getDate());
      expect(since.getHours()).toBe(0);
    });

    it('should query monthly budgets against start-of-month, not start-of-day', async () => {
      mockBudgetRepository.findByUserAndPeriod.mockImplementation((_userId, period) => {
        if (period === 'MONTHLY') {
          return Promise.resolve({ isEnabled: true, maxTokens: 100000, maxCost: null, maxRequestsPerFeature: null });
        }
        return Promise.resolve(null);
      });
      mockUsageTracker.getTotalTokensSince.mockResolvedValue(100);

      await enforcer.checkBudget('user-1', 'analyze_vacancy');

      const since: Date = mockUsageTracker.getTotalTokensSince.mock.calls[0][1];
      expect(since.getDate()).toBe(1);
      expect(since.getHours()).toBe(0);
    });

    it('should not let a monthly token budget be bypassed by low usage today when the month total exceeds it', async () => {
      // Usage tracker reflects month-to-date totals; this simulates heavy usage earlier
      // in the month with a quiet today. The old implementation always queried "today"
      // regardless of period, so it would have under-counted this to 0 and allowed the request.
      mockBudgetRepository.findByUserAndPeriod.mockImplementation((_userId, period) => {
        if (period === 'MONTHLY') {
          return Promise.resolve({ isEnabled: true, maxTokens: 5000, maxCost: null, maxRequestsPerFeature: null });
        }
        return Promise.resolve(null);
      });
      mockUsageTracker.getTotalTokensSince.mockResolvedValue(6000);

      const result = await enforcer.checkBudget('user-1', 'analyze_vacancy');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('monthly token limit');
    });

    it('should not let a daily cost budget be inflated by prior months of spend', async () => {
      // The old implementation always queried "this month" for cost regardless of period,
      // so a daily cost cap could be tripped (or bypassed) by cost accrued outside today.
      mockBudgetRepository.findByUserAndPeriod.mockImplementation((_userId, period) => {
        if (period === 'DAILY') {
          return Promise.resolve({ isEnabled: true, maxTokens: null, maxCost: 5, maxRequestsPerFeature: null });
        }
        return Promise.resolve(null);
      });
      mockUsageTracker.getTotalCostSince.mockResolvedValue(2);

      const result = await enforcer.checkBudget('user-1', 'analyze_vacancy');

      expect(result.allowed).toBe(true);
      const since: Date = mockUsageTracker.getTotalCostSince.mock.calls[0][1];
      expect(since.getDate()).toBe(new Date().getDate());
    });
  });
});
