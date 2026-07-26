import type { Resume, Vacancy, ExperienceLevel, Location } from '@careeros/career';
import { EXPERIENCE_LEVEL_ORDER } from '@careeros/career';

const DEFAULT_MAX_CANDIDATES = 20;

const WEIGHT_RESUME_TECHNOLOGY = 3;
const WEIGHT_RESUME_SKILL = 2;
const WEIGHT_RESUME_TEXT_MENTION = 1.5;
const WEIGHT_SEARCH_PROFILE_TECHNOLOGY = 1;
const WEIGHT_TITLE_OR_DESCRIPTION_OVERLAP = 1;
const WEIGHT_DESIRED_POSITION_MATCH = 2;
const WEIGHT_EXPERIENCE_LEVEL_BONUS = 2;
const WEIGHT_LOCATION_COUNTRY_MATCH = 1;

export interface RelevanceScoreInput {
  readonly vacancy: Vacancy;
  readonly resumeTechnologies: readonly string[];
  readonly resumeSkills: readonly string[];
  readonly searchProfileTechnologies?: readonly string[];
  readonly resumeText?: string;
  readonly desiredPositions?: readonly string[];
  readonly experienceLevel?: ExperienceLevel;
  readonly desiredLocations?: readonly Location[];
}

/**
 * Cheap, local relevance score (no AI call) estimating how well a vacancy
 * overlaps with a candidate's resume and search profile preferences. Used to
 * shrink the set of vacancies sent to the AI provider without a second network
 * round-trip.
 */
export function calculateRelevanceScore(input: RelevanceScoreInput): number {
  const resumeTechSet = toLowerSet(input.resumeTechnologies);
  const resumeSkillSet = toLowerSet(input.resumeSkills);
  const profileTechSet = toLowerSet(input.searchProfileTechnologies ?? []);
  const resumeTextLower = input.resumeText?.toLowerCase();

  let score = 0;

  for (const technology of input.vacancy.technologies) {
    const tech = technology.name.trim().toLowerCase();
    if (!tech) continue;

    if (resumeTechSet.has(tech)) {
      score += WEIGHT_RESUME_TECHNOLOGY;
    } else if (resumeSkillSet.has(tech)) {
      score += WEIGHT_RESUME_SKILL;
    } else if (resumeTextLower?.includes(tech)) {
      score += WEIGHT_RESUME_TEXT_MENTION;
    } else if (profileTechSet.has(tech)) {
      score += WEIGHT_SEARCH_PROFILE_TECHNOLOGY;
    }
  }

  const vacancyText = `${input.vacancy.title} ${input.vacancy.description}`.toLowerCase();
  for (const tech of resumeTechSet) {
    if (vacancyText.includes(tech)) {
      score += WEIGHT_TITLE_OR_DESCRIPTION_OVERLAP;
    }
  }

  if (input.desiredPositions?.length) {
    const positionKeywords = extractPositionKeywords(input.desiredPositions);
    for (const keyword of positionKeywords) {
      if (vacancyText.includes(keyword)) {
        score += WEIGHT_DESIRED_POSITION_MATCH;
      }
    }
  }

  if (input.experienceLevel) {
    const profileOrder = EXPERIENCE_LEVEL_ORDER[input.experienceLevel];
    const vacancyOrder = EXPERIENCE_LEVEL_ORDER[input.vacancy.experienceLevel];
    const diff = Math.abs(profileOrder - vacancyOrder);
    if (diff === 0) {
      score += WEIGHT_EXPERIENCE_LEVEL_BONUS;
    } else if (diff === 1) {
      score += WEIGHT_EXPERIENCE_LEVEL_BONUS / 2;
    }
  }

  if (input.desiredLocations?.length) {
    const vacancyCountry = input.vacancy.location.country?.toLowerCase();
    if (vacancyCountry) {
      for (const loc of input.desiredLocations) {
        if (loc.country?.toLowerCase() === vacancyCountry) {
          score += WEIGHT_LOCATION_COUNTRY_MATCH;
          break;
        }
      }
    }
  }

  return score;
}

export interface SelectTopCandidatesParams {
  readonly resume: Resume;
  readonly vacancies: readonly Vacancy[];
  readonly searchProfileTechnologies?: readonly string[];
  readonly resumeText?: string;
  readonly desiredPositions?: readonly string[];
  readonly experienceLevel?: ExperienceLevel;
  readonly isRemoteOnly?: boolean;
  readonly desiredLocations?: readonly Location[];
  readonly limit?: number;
}

export interface SelectTopCandidatesResult {
  readonly selected: readonly Vacancy[];
  readonly skipped: readonly Vacancy[];
}

/**
 * Ranks vacancies by local relevance score and keeps only the top `limit`.
 * Skips ranking entirely (and keeps everything) when the list already fits,
 * so small result sets never pay the scoring cost or risk dropping a match.
 *
 * When `isRemoteOnly` is true, vacancies that are not remote are dropped
 * before scoring, so they never consume AI budget.
 */
export function selectTopCandidates(params: SelectTopCandidatesParams): SelectTopCandidatesResult {
  const limit = params.limit ?? DEFAULT_MAX_CANDIDATES;

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

  if (candidates.length <= limit) {
    return { selected: candidates, skipped: remoteFiltered };
  }

  const resumeTechnologies = params.resume.technologies.map((t) => t.name);
  const resumeSkills = params.resume.skills.map((s) => s.name);

  const scored = candidates.map((vacancy) => ({
    vacancy,
    score: calculateRelevanceScore({
      vacancy,
      resumeTechnologies,
      resumeSkills,
      searchProfileTechnologies: params.searchProfileTechnologies,
      resumeText: params.resumeText,
      desiredPositions: params.desiredPositions,
      experienceLevel: params.experienceLevel,
      desiredLocations: params.desiredLocations,
    }),
  }));

  scored.sort((a, b) => b.score - a.score);

  const selected = scored.slice(0, limit).map((entry) => entry.vacancy);
  const selectedIds = new Set(selected.map((v) => v.id));
  const skipped = [
    ...remoteFiltered,
    ...candidates.filter((v) => !selectedIds.has(v.id)),
  ];

  return { selected, skipped };
}

function toLowerSet(values: readonly string[]): Set<string> {
  return new Set(values.map((v) => v.trim().toLowerCase()).filter(Boolean));
}

const STOP_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);

function extractPositionKeywords(positions: readonly string[]): string[] {
  const keywords: string[] = [];
  for (const position of positions) {
    for (const word of position.split(/\s+/)) {
      const lower = word.toLowerCase();
      if (!STOP_WORDS.has(lower) && lower.length > 1) {
        keywords.push(lower);
      }
    }
  }
  return [...new Set(keywords)];
}
