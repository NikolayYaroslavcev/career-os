import type { MessageExtraction, MessageExtractionStatus, ExtractedVacancyFields } from '@careeros/ai';
import type { ExtractionStatus as PrismaExtractionStatus } from '@prisma/client';
import { toJsonInput, fromNullableJsonInput } from '../json.js';

interface PrismaMessageExtraction {
  id: string;
  messageId: string;
  provider: string;
  model: string;
  promptId: string;
  promptVersion: string;
  promptChecksum: string;
  temperature: number | null;
  maxTokens: number | null;
  extractedFields: unknown;
  company: string | null;
  title: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  country: string | null;
  city: string | null;
  language: string | null;
  category: string | null;
  seniority: string | null;
  remoteType: string | null;
  deterministicConfidence: number;
  aiSelfReportedConfidence: number | null;
  missingFields: unknown;
  status: string;
  errorMessage: string | null;
  tokensIn: number;
  tokensOut: number;
  totalTokens: number;
  estimatedCost: number;
  latencyMs: number;
  contentHash: string;
  fromCache: boolean;
  createdAt: Date;
}

export class MessageExtractionMapper {
  static toDomain(record: PrismaMessageExtraction): MessageExtraction {
    return {
      id: record.id,
      messageId: record.messageId,
      provider: record.provider,
      model: record.model,
      promptId: record.promptId,
      promptVersion: record.promptVersion,
      promptChecksum: record.promptChecksum,
      temperature: record.temperature ?? undefined,
      maxTokens: record.maxTokens ?? undefined,
      extractedFields: (fromNullableJsonInput<ExtractedVacancyFields>(record.extractedFields) ?? undefined) as ExtractedVacancyFields,
      language: record.language ?? undefined,
      deterministicConfidence: record.deterministicConfidence,
      aiSelfReportedConfidence: record.aiSelfReportedConfidence ?? undefined,
      missingFields: (fromNullableJsonInput<string[]>(record.missingFields) ?? []) as readonly string[],
      status: record.status as MessageExtractionStatus,
      errorMessage: record.errorMessage ?? undefined,
      tokenUsage: {
        promptTokens: record.tokensIn,
        completionTokens: record.tokensOut,
        totalTokens: record.totalTokens,
      },
      estimatedCostUsd: record.estimatedCost,
      latencyMs: record.latencyMs,
      contentHash: record.contentHash,
      fromCache: record.fromCache,
      createdAt: record.createdAt,
    };
  }

  static toPersistence(extraction: MessageExtraction): {
    id: string;
    messageId: string;
    provider: string;
    model: string;
    promptId: string;
    promptVersion: string;
    promptChecksum: string;
    temperature: number | null;
    maxTokens: number | null;
    extractedFields: ReturnType<typeof toJsonInput>;
    company: string | null;
    title: string | null;
    salaryMin: number | null;
    salaryMax: number | null;
    currency: string | null;
    country: string | null;
    city: string | null;
    language: string | null;
    category: string | null;
    seniority: string | null;
    remoteType: string | null;
    deterministicConfidence: number;
    aiSelfReportedConfidence: number | null;
    missingFields: ReturnType<typeof toJsonInput>;
    status: PrismaExtractionStatus;
    errorMessage: string | null;
    tokensIn: number;
    tokensOut: number;
    totalTokens: number;
    estimatedCost: number;
    latencyMs: number;
    contentHash: string;
    fromCache: boolean;
    createdAt: Date;
  } {
    const fields = extraction.extractedFields;
    return {
      id: extraction.id,
      messageId: extraction.messageId,
      provider: extraction.provider,
      model: extraction.model,
      promptId: extraction.promptId,
      promptVersion: extraction.promptVersion,
      promptChecksum: extraction.promptChecksum,
      temperature: extraction.temperature ?? null,
      maxTokens: extraction.maxTokens ?? null,
      extractedFields: toJsonInput(fields),
      // Projected columns mirroring the hot fields inside extractedFields (schema.prisma comment) — queryable without scanning the JSON blob.
      company: fields.company,
      title: fields.title,
      salaryMin: fields.salaryMin,
      salaryMax: fields.salaryMax,
      currency: fields.currency,
      country: fields.country,
      city: fields.city,
      language: extraction.language ?? null,
      category: fields.category,
      seniority: fields.seniority,
      remoteType: fields.remoteType,
      deterministicConfidence: extraction.deterministicConfidence,
      aiSelfReportedConfidence: extraction.aiSelfReportedConfidence ?? null,
      missingFields: toJsonInput([...extraction.missingFields]),
      status: extraction.status as PrismaExtractionStatus,
      errorMessage: extraction.errorMessage ?? null,
      tokensIn: extraction.tokenUsage.promptTokens,
      tokensOut: extraction.tokenUsage.completionTokens,
      totalTokens: extraction.tokenUsage.totalTokens,
      estimatedCost: extraction.estimatedCostUsd,
      latencyMs: extraction.latencyMs,
      contentHash: extraction.contentHash,
      fromCache: extraction.fromCache,
      createdAt: extraction.createdAt,
    };
  }
}
