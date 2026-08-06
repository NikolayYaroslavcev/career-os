import type { TokenUsage } from './ai-types.js';
import type { ExtractedVacancyFields } from '../extraction/social-message-extraction-schema.js';

/**
 * Mirrors packages/database/prisma/schema.prisma's `ExtractionStatus` enum.
 * Named `MessageExtractionStatus` here (not `ExtractionStatus`) to avoid
 * colliding with @careeros/career's unrelated `ExtractionStatus` (resume
 * extraction lifecycle: 'pending'|'completed'|'failed').
 */
export const MessageExtractionStatus = {
  SUCCESS: 'SUCCESS',
  PARSE_ERROR: 'PARSE_ERROR',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
  SPAM: 'SPAM',
} as const;

export type MessageExtractionStatus = (typeof MessageExtractionStatus)[keyof typeof MessageExtractionStatus];

export interface MessageExtraction {
  readonly id: string;
  readonly messageId: string;

  // Reproducibility — enough to exactly replay this extraction later.
  readonly provider: string;
  readonly model: string;
  readonly promptId: string;
  readonly promptVersion: string;
  readonly promptChecksum: string;
  readonly temperature?: number;
  readonly maxTokens?: number;

  // Full structured result — the source of truth.
  readonly extractedFields: ExtractedVacancyFields;
  /** Denormalized from SocialMessage.language at extraction time, not AI-derived — kept alongside the extraction row purely for query convenience. */
  readonly language?: string;

  readonly deterministicConfidence: number;
  readonly aiSelfReportedConfidence?: number;
  readonly missingFields: readonly string[];
  readonly status: MessageExtractionStatus;
  readonly errorMessage?: string;

  readonly tokenUsage: TokenUsage;
  readonly estimatedCostUsd: number;
  readonly latencyMs: number;

  readonly contentHash: string;
  readonly fromCache: boolean;
  readonly createdAt: Date;
}

export interface MessageExtractionInput {
  readonly id?: string;
  readonly messageId: string;
  readonly provider: string;
  readonly model: string;
  readonly promptId: string;
  readonly promptVersion: string;
  readonly promptChecksum: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly extractedFields: ExtractedVacancyFields;
  readonly language?: string;
  readonly deterministicConfidence: number;
  readonly aiSelfReportedConfidence?: number;
  readonly missingFields?: readonly string[];
  readonly status: MessageExtractionStatus;
  readonly errorMessage?: string;
  readonly tokenUsage: TokenUsage;
  readonly estimatedCostUsd: number;
  readonly latencyMs: number;
  readonly contentHash: string;
  readonly fromCache: boolean;
}

export function createMessageExtraction(input: MessageExtractionInput): MessageExtraction {
  return {
    ...input,
    id: input.id ?? crypto.randomUUID(),
    missingFields: input.missingFields ?? [],
    createdAt: new Date(),
  };
}
