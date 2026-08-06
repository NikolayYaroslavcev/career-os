import type { ExtractedVacancyFields } from './social-message-extraction-schema.js';
import { MessageExtractionStatus, type MessageExtractionStatus as MessageExtractionStatusType } from '../domain/message-extraction.js';

/**
 * Below this deterministicConfidence score, a MessageExtraction is classified
 * LOW_CONFIDENCE (ADR-032: gates the future SocialMessageNormalizer — rows
 * below threshold never reach NormalizedVacancy). A plain, versionable
 * constant rather than a magic number scattered across call sites.
 */
export const MESSAGE_EXTRACTION_LOW_CONFIDENCE_THRESHOLD = 40;

/**
 * A stricter, separate bar than MESSAGE_EXTRACTION_LOW_CONFIDENCE_THRESHOLD
 * above — that one gates whether a Telegram message is allowed to become a
 * Vacancy at all; this one additionally gates whether a Vacancy is trusted
 * enough to create a CompanyCandidate (ADR-035's Company Discovery bridge).
 * Creating a company candidate is a heavier-weight action than creating a
 * vacancy (it can eventually auto-enroll a CompanyWatch), so it deliberately
 * requires a higher score than merely clearing SUCCESS — never lowers the
 * vacancy-creation bar, only raises the bar for this one additional action.
 */
export const MESSAGE_EXTRACTION_DISCOVERY_MIN_CONFIDENCE = 70;

export interface MessageExtractionConfidenceResult {
  /** 0-100 integer, rubric-based — never blended with the AI's own self-reported confidence. */
  readonly score: number;
  readonly missingFields: readonly string[];
}

/**
 * Scalar fields the prompt asks the model to cite verbatim evidence for.
 * Array fields (technologies, requirements, ...) are excluded — verifying an
 * evidence quote per list item isn't worth the prompt complexity, and the
 * scalar fields (title/company/salary/location/...) are exactly the ones a
 * hallucination would matter most for.
 */
const SCALAR_EVIDENCE_FIELDS: ReadonlyArray<keyof ExtractedVacancyFields> = [
  'title', 'company', 'seniority', 'salaryMin', 'salaryMax', 'currency',
  'country', 'city', 'employmentType', 'remoteType', 'contact', 'recruiter', 'category',
];

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isPopulated(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

interface ScoredCategory {
  readonly weight: number;
  readonly score: number;
  readonly applicable: boolean;
}

/**
 * Computes MessageExtraction.deterministicConfidence entirely in code — the
 * AI's own "confidence" field (aiSelfReportedConfidence) is stored separately
 * and never feeds this number. Same (fields, rawText) input always produces
 * the same score: no randomness, no model call. Weighted-category rubric
 * mirrors computeAtsScore's "applicable" pattern (packages/ai/src/ats/
 * ats-scoring-engine.ts) — a category with nothing to check (e.g. no scalar
 * field populated at all) is excluded from the denominator rather than
 * penalizing an otherwise-good extraction.
 */
export function computeMessageExtractionConfidence(
  fields: ExtractedVacancyFields,
  rawText: string,
): MessageExtractionConfidenceResult {
  const normalizedRawText = normalize(rawText);

  const missingFields: string[] = [];
  if (!isPopulated(fields.title)) missingFields.push('title');
  if (!isPopulated(fields.company)) missingFields.push('company');
  if (!isPopulated(fields.technologies)) missingFields.push('technologies');
  if (!isPopulated(fields.salaryMin) && !isPopulated(fields.salaryMax)) missingFields.push('salary');
  if (!isPopulated(fields.country) && !isPopulated(fields.city)) missingFields.push('location');
  if (!isPopulated(fields.employmentType)) missingFields.push('employmentType');
  if (!isPopulated(fields.remoteType)) missingFields.push('remoteType');
  if (!isPopulated(fields.seniority)) missingFields.push('seniority');
  if (!isPopulated(fields.requirements)) missingFields.push('requirements');
  if (!isPopulated(fields.responsibilities)) missingFields.push('responsibilities');

  const populatedScalarFields = SCALAR_EVIDENCE_FIELDS.filter((key) => isPopulated(fields[key]));
  const evidenceApplicable = populatedScalarFields.length > 0;
  const verifiedCount = populatedScalarFields.filter((key) => {
    const quote = fields.evidence[key as string];
    return typeof quote === 'string' && quote.trim().length > 0 && normalizedRawText.includes(normalize(quote));
  }).length;
  const evidenceScore = evidenceApplicable ? (verifiedCount / populatedScalarFields.length) * 100 : 0;

  const categories: readonly ScoredCategory[] = [
    { weight: 20, score: isPopulated(fields.title) ? 100 : 0, applicable: true },
    { weight: 20, score: isPopulated(fields.company) ? 100 : 0, applicable: true },
    { weight: 15, score: isPopulated(fields.technologies) ? 100 : 0, applicable: true },
    { weight: 10, score: isPopulated(fields.country) || isPopulated(fields.city) ? 100 : 0, applicable: true },
    { weight: 10, score: isPopulated(fields.employmentType) || isPopulated(fields.remoteType) ? 100 : 0, applicable: true },
    { weight: 10, score: isPopulated(fields.requirements) || isPopulated(fields.responsibilities) ? 100 : 0, applicable: true },
    { weight: 15, score: evidenceScore, applicable: evidenceApplicable },
  ];

  const applicableCategories = categories.filter((c) => c.applicable);
  const totalWeight = applicableCategories.reduce((sum, c) => sum + c.weight, 0);
  const rawScore = totalWeight > 0
    ? applicableCategories.reduce((sum, c) => sum + c.score * c.weight, 0) / totalWeight
    : 0;

  return {
    score: Math.round(Math.max(0, Math.min(100, rawScore))),
    missingFields,
  };
}

/**
 * Status classification is separate from the numeric score: SPAM means the
 * extraction found nothing job-related at all (no title/company/tech/
 * requirements/responsibilities), which is a different failure mode than a
 * genuine-but-thin posting that merely scores below the confidence threshold.
 */
export function classifyMessageExtractionStatus(
  confidence: number,
  fields: ExtractedVacancyFields,
): MessageExtractionStatusType {
  const hasAnySignal = isPopulated(fields.title)
    || isPopulated(fields.company)
    || isPopulated(fields.technologies)
    || isPopulated(fields.requirements)
    || isPopulated(fields.responsibilities);

  if (!hasAnySignal) return MessageExtractionStatus.SPAM;
  if (confidence < MESSAGE_EXTRACTION_LOW_CONFIDENCE_THRESHOLD) return MessageExtractionStatus.LOW_CONFIDENCE;
  return MessageExtractionStatus.SUCCESS;
}
