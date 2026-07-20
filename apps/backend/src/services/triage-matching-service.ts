import type { Resume, Vacancy, ExperienceLevel, Location } from '@careeros/career';
import { calculateRelevanceScore } from './relevance-filter.js';

export interface TriageConfig {
  readonly topN: number;
  readonly minScore: number;
}

export interface TriageResult {
  readonly vacancy: Vacancy;
  readonly score: number;
  readonly passed: boolean;
  /**
   * Only set when `passed` is false — distinguishes "will never be analyzed
   * this snapshot" (below minScore) from "ranked below the cut, but eligible
   * for a later continuation batch" (outside_top_n). Drives EPIC-17's
   * continuous background processing (see AiBatchBacklog) and search
   * diagnostics' per-vacancy exclusion reasons.
   */
  readonly rejectionReason?: 'low_relevance' | 'outside_top_n';
}

export interface TriageOutcome {
  readonly results: readonly TriageResult[];
  readonly passed: readonly Vacancy[];
  readonly rejected: readonly Vacancy[];
  readonly stats: TriageStats;
}

export interface TriageStats {
  readonly total: number;
  readonly passed: number;
  readonly rejected: number;
  readonly avgScore: number;
  readonly durationMs: number;
}

const DEFAULT_CONFIG: TriageConfig = {
  topN: 15,
  minScore: 0,
};

/**
 * Level 1: Cheap, local triage scoring.
 * No AI calls. Uses keyword/technology overlap to estimate vacancy relevance.
 * Returns scored vacancies; caller decides which go to Level 2 (AI).
 */
export class TriageMatchingService {
  private readonly config: TriageConfig;

  constructor(config?: Partial<TriageConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  triage(params: {
    readonly resume: Resume;
    readonly vacancies: readonly Vacancy[];
    readonly searchProfileTechnologies?: readonly string[];
    readonly resumeText?: string;
    readonly desiredPositions?: readonly string[];
    readonly experienceLevel?: ExperienceLevel;
    readonly isRemoteOnly?: boolean;
    readonly desiredLocations?: readonly Location[];
  }): TriageOutcome {
    const startedAt = Date.now();

    let candidates = params.vacancies;
    const remoteFiltered: Vacancy[] = [];

    if (params.isRemoteOnly) {
      const kept: Vacancy[] = [];
      for (const v of candidates) {
        if (v.location.isRemote) {
          kept.push(v);
        } else {
          remoteFiltered.push(v);
        }
      }
      candidates = kept;
    }

    const resumeTechnologies = params.resume.technologies.map((t) => t.name);
    const resumeSkills = params.resume.skills.map((s) => s.name);

    const scored: TriageResult[] = candidates.map((vacancy) => {
      const score = calculateRelevanceScore({
        vacancy,
        resumeTechnologies,
        resumeSkills,
        searchProfileTechnologies: params.searchProfileTechnologies,
        resumeText: params.resumeText,
        desiredPositions: params.desiredPositions,
        experienceLevel: params.experienceLevel,
        desiredLocations: params.desiredLocations,
      });

      return { vacancy, score, passed: false };
    });

    // Extension point (EPIC-17 Part 7, not implemented — see
    // apps/backend/src/services/ranking/vacancy-ranker.ts and ADR-027): a
    // future semantic ranking stage re-scores/re-orders `scored` right here,
    // before the topN cut below. Doing so would make this method async (a
    // real VacancyRanker implementation calls an embeddings API), which is
    // a small, contained change scoped to this file and its direct callers.
    scored.sort((a, b) => b.score - a.score);

    const withPassFlag = scored.map((entry, index) => {
      const passed = index < this.config.topN && entry.score >= this.config.minScore;
      const rejectionReason = passed
        ? undefined
        : entry.score < this.config.minScore
          ? ('low_relevance' as const)
          : ('outside_top_n' as const);
      return { ...entry, passed, rejectionReason };
    });

    const passed = withPassFlag.filter((r) => r.passed).map((r) => r.vacancy);
    const rejectedIds = new Set(withPassFlag.filter((r) => !r.passed).map((r) => r.vacancy.id));
    const rejected = [
      ...remoteFiltered,
      ...candidates.filter((v) => rejectedIds.has(v.id)),
    ];

    const avgScore = scored.length > 0
      ? scored.reduce((sum, r) => sum + r.score, 0) / scored.length
      : 0;

    return {
      results: withPassFlag,
      passed,
      rejected,
      stats: {
        total: params.vacancies.length,
        passed: passed.length,
        rejected: rejected.length,
        avgScore,
        durationMs: Date.now() - startedAt,
      },
    };
  }
}
