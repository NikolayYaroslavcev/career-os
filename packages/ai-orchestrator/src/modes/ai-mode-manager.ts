import type { AIFeature, AIMode } from '../orchestrator-config.js';

export interface ModeCheckResult {
  readonly allowed: boolean;
  readonly reason?: string;
}

export interface SmartModeConfig {
  readonly highPriorityThreshold?: number;
  readonly watchedCompaniesOnly?: boolean;
  readonly minScoreThreshold?: number;
}

export class AIModeManager {
  private currentMode: AIMode;
  private smartConfig: SmartModeConfig;

  constructor(mode: AIMode = 'manual', smartConfig?: SmartModeConfig) {
    this.currentMode = mode;
    this.smartConfig = smartConfig ?? {};
  }

  getMode(): AIMode {
    return this.currentMode;
  }

  setMode(mode: AIMode): void {
    this.currentMode = mode;
  }

  async canExecute(
    feature: AIFeature,
    context?: {
      isHighPriority?: boolean;
      isWatchedCompany?: boolean;
      score?: number;
      isNewVacancy?: boolean;
      isChangedVacancy?: boolean;
    }
  ): Promise<ModeCheckResult> {
    switch (this.currentMode) {
      case 'manual':
        return this.checkManualMode(feature);

      case 'smart':
        return this.checkSmartMode(feature, context);

      case 'automatic':
        return this.checkAutomaticMode(feature, context);

      default:
        return { allowed: false, reason: `Unknown mode: ${this.currentMode}` };
    }
  }

  private checkManualMode(feature: AIFeature): ModeCheckResult {
    // Manual mode: only explicit user actions are allowed
    const manualFeatures: AIFeature[] = [
      'analyze_vacancy',
      'tailor_resume',
      'cover_letter',
      'interview_prep',
      'salary_analysis',
      'company_analysis',
      'resume_improvement',
      'career_advice',
    ];

    if (manualFeatures.includes(feature)) {
      return { allowed: true };
    }

    return { allowed: false, reason: 'Manual mode: only explicit user actions are allowed' };
  }

  private checkSmartMode(
    feature: AIFeature,
    context?: {
      isHighPriority?: boolean;
      isWatchedCompany?: boolean;
      score?: number;
      isNewVacancy?: boolean;
      isChangedVacancy?: boolean;
    }
  ): ModeCheckResult {
    // Smart mode: allow explicit actions + background for high-priority items
    const manualFeatures: AIFeature[] = [
      'tailor_resume',
      'cover_letter',
      'interview_prep',
      'salary_analysis',
      'company_analysis',
      'resume_improvement',
      'career_advice',
    ];

    if (manualFeatures.includes(feature)) {
      return { allowed: true };
    }

    // Background analysis for smart mode
    if (feature === 'analyze_vacancy' && context) {
      if (context.isHighPriority) {
        return { allowed: true };
      }
      if (context.isWatchedCompany) {
        return { allowed: true };
      }
      if (context.score !== undefined && this.smartConfig.minScoreThreshold !== undefined && context.score >= this.smartConfig.minScoreThreshold) {
        return { allowed: true };
      }
    }

    return { allowed: false, reason: 'Smart mode: feature not eligible for background processing' };
  }

  private checkAutomaticMode(
    feature: AIFeature,
    context?: {
      isNewVacancy?: boolean;
      isChangedVacancy?: boolean;
    }
  ): ModeCheckResult {
    // Automatic mode: analyze everything
    if (feature === 'analyze_vacancy') {
      // Only analyze new or changed vacancies, skip duplicates and unchanged
      if (context?.isNewVacancy || context?.isChangedVacancy) {
        return { allowed: true };
      }
      if (!context?.isNewVacancy && !context?.isChangedVacancy) {
        return { allowed: false, reason: 'Automatic mode: skipping duplicate/unchanged vacancy' };
      }
    }

    return { allowed: true };
  }
}
