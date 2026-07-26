import type { MatchResult, Recommendation, CategoryScore, ActionableItem, MatchExplanation } from '@careeros/ai';
import { toJsonInput, toNullableJsonInput, fromNullableJsonInput } from '../json.js';

interface PrismaMatchResult {
  id: string;
  overallScore: number;
  confidence: number;
  recommendation: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  requiredSkills: string[];
  missingSkills: string[];
  seniorityEstimation: string;
  remotePolicy: string;
  salaryObservations: string | null;
  inputHash: string;
  salaryFitScore: number;
  salaryFitConfidence: number;
  salaryFitReasoning: string;
  locationFitScore: number;
  locationFitConfidence: number;
  locationFitReasoning: string;
  experienceFitScore: number;
  experienceFitConfidence: number;
  experienceFitReasoning: string;
  careerGrowthFitScore: number;
  careerGrowthFitConfidence: number;
  careerGrowthFitReasoning: string;
  reasoning: string;
  model: string;
  provider: string;
  promptVersion: string;
  promptId: string;
  matchingAlgorithmVersion: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  estimatedCostUsd: number;
  generatedAt: Date;
  userId: string;
  vacancyId: string;
  resumeId: string | null;
  searchProfileId: string;
  categoryScores: unknown;
  actionableItems: unknown;
  explanation: unknown;
}

export class MatchResultMapper {
  static toDomain(record: PrismaMatchResult): MatchResult {
    return {
      id: record.id,
      searchProfileId: record.searchProfileId,
      resumeId: record.resumeId ?? undefined,
      vacancyId: record.vacancyId,
      userId: record.userId,
      overallScore: record.overallScore,
      confidence: record.confidence,
      recommendation: record.recommendation as Recommendation,
      summary: record.summary,
      strengths: [...record.strengths],
      weaknesses: [...record.weaknesses],
      requiredSkills: [...record.requiredSkills],
      missingSkills: [...record.missingSkills],
      seniorityEstimation: record.seniorityEstimation,
      remotePolicy: record.remotePolicy,
      salaryObservations: record.salaryObservations,
      salaryFit: {
        score: record.salaryFitScore,
        confidence: record.salaryFitConfidence,
        reasoning: record.salaryFitReasoning,
      },
      locationFit: {
        score: record.locationFitScore,
        confidence: record.locationFitConfidence,
        reasoning: record.locationFitReasoning,
      },
      experienceFit: {
        score: record.experienceFitScore,
        confidence: record.experienceFitConfidence,
        reasoning: record.experienceFitReasoning,
      },
      careerGrowthFit: {
        score: record.careerGrowthFitScore,
        confidence: record.careerGrowthFitConfidence,
        reasoning: record.careerGrowthFitReasoning,
      },
      reasoning: record.reasoning,
      categoryScores: Array.isArray(record.categoryScores) ? (record.categoryScores as CategoryScore[]) : [],
      actionableItems: Array.isArray(record.actionableItems) ? (record.actionableItems as ActionableItem[]) : [],
      explanation: fromNullableJsonInput<MatchExplanation>(record.explanation),
      generatedAt: record.generatedAt,
      model: record.model,
      provider: record.provider,
      promptVersion: record.promptVersion,
      promptId: record.promptId,
      matchingAlgorithmVersion: record.matchingAlgorithmVersion,
      inputHash: record.inputHash,
      tokenUsage: {
        promptTokens: record.promptTokens,
        completionTokens: record.completionTokens,
        totalTokens: record.totalTokens,
      },
      latencyMs: record.latencyMs,
      estimatedCostUsd: record.estimatedCostUsd,
    };
  }

  static toPersistence(matchResult: MatchResult): {
    id: string;
    overallScore: number;
    confidence: number;
    recommendation: Recommendation;
    summary: string;
    strengths: string[];
    weaknesses: string[];
    requiredSkills: string[];
    missingSkills: string[];
    seniorityEstimation: string;
    remotePolicy: string;
    salaryObservations: string | null;
    inputHash: string;
    salaryFitScore: number;
    salaryFitConfidence: number;
    salaryFitReasoning: string;
    locationFitScore: number;
    locationFitConfidence: number;
    locationFitReasoning: string;
    experienceFitScore: number;
    experienceFitConfidence: number;
    experienceFitReasoning: string;
    careerGrowthFitScore: number;
    careerGrowthFitConfidence: number;
    careerGrowthFitReasoning: string;
    reasoning: string;
    categoryScores: ReturnType<typeof toJsonInput>;
    actionableItems: ReturnType<typeof toJsonInput>;
    explanation: ReturnType<typeof toNullableJsonInput>;
    model: string;
    provider: string;
    promptVersion: string;
    promptId: string;
    matchingAlgorithmVersion: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    latencyMs: number;
    estimatedCostUsd: number;
    generatedAt: Date;
    userId: string;
    vacancyId: string;
    resumeId: string | null;
    searchProfileId: string;
  } {
    return {
      id: matchResult.id,
      overallScore: matchResult.overallScore,
      confidence: matchResult.confidence,
      recommendation: matchResult.recommendation,
      summary: matchResult.summary,
      strengths: [...matchResult.strengths],
      weaknesses: [...matchResult.weaknesses],
      requiredSkills: [...matchResult.requiredSkills],
      missingSkills: [...matchResult.missingSkills],
      seniorityEstimation: matchResult.seniorityEstimation,
      remotePolicy: matchResult.remotePolicy,
      salaryObservations: matchResult.salaryObservations,
      inputHash: matchResult.inputHash,
      salaryFitScore: matchResult.salaryFit.score,
      salaryFitConfidence: matchResult.salaryFit.confidence,
      salaryFitReasoning: matchResult.salaryFit.reasoning,
      locationFitScore: matchResult.locationFit.score,
      locationFitConfidence: matchResult.locationFit.confidence,
      locationFitReasoning: matchResult.locationFit.reasoning,
      experienceFitScore: matchResult.experienceFit.score,
      experienceFitConfidence: matchResult.experienceFit.confidence,
      experienceFitReasoning: matchResult.experienceFit.reasoning,
      careerGrowthFitScore: matchResult.careerGrowthFit.score,
      careerGrowthFitConfidence: matchResult.careerGrowthFit.confidence,
      careerGrowthFitReasoning: matchResult.careerGrowthFit.reasoning,
      reasoning: matchResult.reasoning,
      categoryScores: toJsonInput([...matchResult.categoryScores]),
      actionableItems: toJsonInput([...matchResult.actionableItems]),
      explanation: toNullableJsonInput(matchResult.explanation),
      model: matchResult.model,
      provider: matchResult.provider,
      promptVersion: matchResult.promptVersion,
      promptId: matchResult.promptId,
      matchingAlgorithmVersion: matchResult.matchingAlgorithmVersion,
      promptTokens: matchResult.tokenUsage.promptTokens,
      completionTokens: matchResult.tokenUsage.completionTokens,
      totalTokens: matchResult.tokenUsage.totalTokens,
      latencyMs: matchResult.latencyMs,
      estimatedCostUsd: matchResult.estimatedCostUsd,
      generatedAt: matchResult.generatedAt,
      userId: matchResult.userId,
      vacancyId: matchResult.vacancyId,
      resumeId: matchResult.resumeId ?? null,
      searchProfileId: matchResult.searchProfileId,
    };
  }
}
