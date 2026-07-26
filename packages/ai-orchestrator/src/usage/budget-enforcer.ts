import type { AIBudgetRepository } from '@careeros/database';
import type { AIFeature } from '../orchestrator-config.js';
import type { UsageTracker } from './usage-tracker.js';

export interface BudgetCheckResult {
  readonly allowed: boolean;
  readonly reason?: string;
  readonly currentTokens?: number;
  readonly maxTokens?: number;
  readonly currentCost?: number;
  readonly maxCost?: number;
  readonly currentRequests?: number;
  readonly maxRequests?: number;
}

export class BudgetEnforcer {
  private readonly budgetRepository: AIBudgetRepository;
  private readonly usageTracker: UsageTracker;

  constructor(budgetRepository: AIBudgetRepository, usageTracker: UsageTracker) {
    this.budgetRepository = budgetRepository;
    this.usageTracker = usageTracker;
  }

  async checkBudget(
    userId: string,
    feature: AIFeature
  ): Promise<BudgetCheckResult> {
    // Check daily budget
    const dailyBudget = await this.budgetRepository.findByUserAndPeriod(userId, 'DAILY');
    if (dailyBudget?.isEnabled) {
      const dailyCheck = await this.checkPeriodBudget(userId, feature, dailyBudget, 'daily');
      if (!dailyCheck.allowed) return dailyCheck;
    }

    // Check monthly budget
    const monthlyBudget = await this.budgetRepository.findByUserAndPeriod(userId, 'MONTHLY');
    if (monthlyBudget?.isEnabled) {
      const monthlyCheck = await this.checkPeriodBudget(userId, feature, monthlyBudget, 'monthly');
      if (!monthlyCheck.allowed) return monthlyCheck;
    }

    return { allowed: true };
  }

  private async checkPeriodBudget(
    userId: string,
    feature: AIFeature,
    budget: { maxTokens: number | null; maxCost: number | null; maxRequestsPerFeature: unknown },
    period: 'daily' | 'monthly'
  ): Promise<BudgetCheckResult> {
    const since = period === 'daily' ? this.getStartOfDay() : this.getStartOfMonth();

    // Check token limit
    if (budget.maxTokens) {
      const currentTokens = await this.usageTracker.getTotalTokensSince(userId, since);
      if (currentTokens >= budget.maxTokens) {
        return {
          allowed: false,
          reason: `${period} token limit reached`,
          currentTokens,
          maxTokens: budget.maxTokens,
        };
      }
    }

    // Check cost limit
    if (budget.maxCost) {
      const currentCost = await this.usageTracker.getTotalCostSince(userId, since);
      if (currentCost >= budget.maxCost) {
        return {
          allowed: false,
          reason: `${period} cost limit reached`,
          currentCost,
          maxCost: budget.maxCost,
        };
      }
    }

    // Check per-feature request limit
    const featureLimits = budget.maxRequestsPerFeature as Record<string, number> | null;
    if (featureLimits?.[feature]) {
      const maxRequests = featureLimits[feature];
      const currentRequests = await this.usageTracker.getRequestCountForFeature(userId, feature, since);
      if (currentRequests >= maxRequests) {
        return {
          allowed: false,
          reason: `${period} request limit for ${feature} reached`,
          currentRequests,
          maxRequests,
        };
      }
    }

    return { allowed: true };
  }

  private getStartOfDay(): Date {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }

  private getStartOfMonth(): Date {
    const now = new Date();
    now.setDate(1);
    now.setHours(0, 0, 0, 0);
    return now;
  }
}
