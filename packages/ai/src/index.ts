// Domain
export type { AIRequest, AIResponse, TokenUsage, AICapabilities } from './domain/ai-types.js';
export { AIErrorType, AIError, AIParseError } from './domain/ai-error.js';
export { Recommendation, RECOMMENDATION_PRIORITY, compareRecommendations } from './domain/recommendation.js';
export type { MatchResult, MatchResultInput, FitAssessment } from './domain/match-result.js';
export { createMatchResult } from './domain/match-result.js';
export type { CategoryScore, ActionableItem, MatchExplanation } from './domain/match-category.js';
export { MatchCategory, MATCH_CATEGORY_LABELS, ALL_MATCH_CATEGORIES } from './domain/match-category.js';
export type { MatchResultRepository } from './domain/match-result-repository.js';
export type { AIProvider, AIProviderConfig, AIProviderFactory } from './domain/ai-provider.js';
export type {
  AIRailguards,
  AIRailguardConfig,
  EvidenceCheckInput,
  EvidenceCheckResult,
  EvidenceClaim,
  EvidenceClaimResult,
  EvidenceCheckBatchInput,
  EvidenceCheckBatchResult,
  ConfidenceValidationInput,
  ConfidenceValidationResult,
  HallucinationCheckInput,
  HallucinationCheckResult,
  FlaggedEntity,
} from './domain/ai-guardrails.js';
export type {
  AIEvaluator,
  ProviderComparison,
  ModelComparison,
  PromptComparison,
  ComparisonMetrics,
  ScoreDistribution,
  EvaluationExperiment,
  ExperimentVariant,
  ExperimentResult,
  VariantResult,
} from './domain/ai-evaluation.js';
export { MatchFeedbackAction } from './domain/match-feedback.js';
export type {
  MatchFeedback,
  MatchFeedbackInput,
  MatchFeedbackSummary,
  MatchFeedbackRepository,
} from './domain/match-feedback.js';
export { MessageExtractionStatus, createMessageExtraction } from './domain/message-extraction.js';
export type { MessageExtraction, MessageExtractionInput } from './domain/message-extraction.js';
export type { MessageExtractionRepository } from './domain/message-extraction-repository.js';

// Prompts
export type { PromptBuilder, BuiltPrompt } from './prompts/prompt-builder.js';
export type { PromptVersion } from './prompts/prompt-version.js';
export { createPromptVersion, verifyPromptChecksum } from './prompts/prompt-version.js';
export { wrapUntrustedContent, UNTRUSTED_CONTENT_SYSTEM_RULE } from './prompts/untrusted-content.js';
export { VacancyAnalysisPromptBuilder } from './prompts/vacancy-analysis.js';
export { ResumeAnalysisPromptBuilder } from './prompts/resume-analysis.js';
export { SkillGapPromptBuilder } from './prompts/skill-gap.js';
export { SalaryAnalysisPromptBuilder } from './prompts/salary-analysis.js';
export { SearchProfileSuggestionPromptBuilder } from './prompts/search-profile-suggestion.js';
export type { SearchProfileSuggestionParams } from './prompts/search-profile-suggestion.js';
export { StructuredResumeExtractionPromptBuilder } from './prompts/structured-resume-extraction.js';
export type { StructuredResumeExtractionParams } from './prompts/structured-resume-extraction.js';
export { ResumeTailoringPromptBuilder } from './prompts/resume-tailoring.js';
export type { ResumeTailoringParams, ResumeTailoringExperienceInput } from './prompts/resume-tailoring.js';
export { CoverLetterPromptBuilder } from './prompts/cover-letter.js';
export type { CoverLetterParams } from './prompts/cover-letter.js';
export { VacancyRequirementsPromptBuilder } from './prompts/vacancy-requirements-extraction.js';
export type {
  VacancyRequirementsExtractionParams,
  VacancyRequirementsResult,
} from './prompts/vacancy-requirements-extraction.js';
export { TailoringReviewPromptBuilder } from './prompts/resume-tailoring-review.js';
export type {
  TailoringReviewParams,
  TailoringReviewResult,
  TailoringReviewOriginalJob,
  TailoringReviewBullet,
} from './prompts/resume-tailoring-review.js';
export { MessageExtractionPromptBuilder } from './prompts/message-extraction.js';
export type { MessageExtractionPromptParams } from './prompts/message-extraction.js';

// Cache
export { computePromptHash } from './cache/prompt-hash.js';
export type { AICache, AICacheEntry } from './cache/ai-cache.js';
export { InMemoryAICache } from './cache/ai-cache.js';

// Cost
export type { CostTracker, CostRecord, CostSummary, ModelPricing } from './cost/cost-tracker.js';
export { estimateCost } from './cost/cost-tracker.js';
export { InMemoryCostTracker } from './cost/cost-tracker-impl.js';
export { getModelPricing } from './cost/pricing.js';
export type { UsageRecorder, UsageRecorderInput } from './cost/usage-recorder.js';

// Extraction
export type { StructuredResumeExtractionResult, ResumeExtractionEngineDeps, ResumeExtractionEngineConfig } from './extraction/resume-extraction-engine.js';
export { ResumeExtractionEngine } from './extraction/resume-extraction-engine.js';
export { extractedVacancyFieldsSchema } from './extraction/social-message-extraction-schema.js';
export type { ExtractedVacancyFields } from './extraction/social-message-extraction-schema.js';
export { computeMessageExtractionCacheKey } from './extraction/message-extraction-cache-key.js';
export type { MessageExtractionCacheKeyInput } from './extraction/message-extraction-cache-key.js';
export {
  computeMessageExtractionConfidence,
  classifyMessageExtractionStatus,
  MESSAGE_EXTRACTION_LOW_CONFIDENCE_THRESHOLD,
  MESSAGE_EXTRACTION_DISCOVERY_MIN_CONFIDENCE,
} from './extraction/message-extraction-confidence.js';
export type { MessageExtractionConfidenceResult } from './extraction/message-extraction-confidence.js';
export type {
  MessageExtractionEngineConfig,
  MessageExtractionEngineDeps,
  MessageExtractionOutcome,
} from './extraction/message-extraction-engine.js';
export { MessageExtractionEngine } from './extraction/message-extraction-engine.js';

// Context
export type {
  ResumeContextProvider,
  ResumeContextProviderDeps,
  ResumeAIContext,
  ResumeExperienceContext,
  ResumeEducationContext,
} from './context/resume-context-provider.js';
export { ResumeContextProviderImpl } from './context/resume-context-provider.js';
export type { ResumeSectionName } from './context/resume-context-fallback.js';
export { buildCompactResumeContext, estimateTokens } from './context/resume-context-fallback.js';

// Matching
export type { ExplainabilityFactor, ExplainabilityReport } from './matching/explainability.js';
export { rankFactorsByImpact, getPositiveFactors, getNegativeFactors, categoryScoreToExplainabilityFactor, buildExplainabilityReport } from './matching/explainability.js';
export type { MatchingEngineConfig, MatchingEngineDeps, MatchParams } from './matching/matching-engine.js';
export { MatchingEngine } from './matching/matching-engine.js';
export { CURRENT_MATCHING_ALGORITHM_VERSION } from './matching/matching-algorithm-version.js';
export type { VacancyAnalysisHashInput } from './matching/vacancy-analysis-hash.js';
export { computeVacancyAnalysisInputHash } from './matching/vacancy-analysis-hash.js';
export type {
  VacancyAnalysisTarget,
  VacancyAnalysisProfile,
  VacancyAnalysisResume,
  VacancyAnalysisDeps,
  VacancyAnalysisOutcome,
} from './matching/vacancy-analysis-orchestrator.js';
export { analyzeVacancyForSearchProfile } from './matching/vacancy-analysis-orchestrator.js';

// ATS scoring (ADR-031)
export type { AtsCategoryId, AtsWeights } from './ats/ats-weights-config.js';
export { ATS_CATEGORY_LABELS, ATS_WEIGHTS_VERSION, DEFAULT_ATS_WEIGHTS } from './ats/ats-weights-config.js';
export type { AtsResumeEvidence, AtsVacancyRequirements, AtsCategoryScore, AtsScoreResult } from './ats/ats-scoring-engine.js';
export { computeAtsScore } from './ats/ats-scoring-engine.js';

// Resume tailoring pipeline (ADR-031)
export type { SkillMatrixResult } from './tailoring/skill-matrix-engine.js';
export { computeSkillMatrix } from './tailoring/skill-matrix-engine.js';
export type { TailoringResumeEvidence, TailoringExperienceEvidence } from './tailoring/resume-evidence-builder.js';
export { ResumeEvidenceBuilder, toAtsResumeEvidence } from './tailoring/resume-evidence-builder.js';
export type { RenderableExperience, RenderTailoredResumeInput } from './tailoring/tailored-resume-renderer.js';
export { renderTailoredResume } from './tailoring/tailored-resume-renderer.js';
export type {
  TailoringDraftBullet,
  TailoringDraftJob,
  TailoringDraft,
  TailoringOriginalEvidence,
  TailoringChange,
  TailoringRejectedChange,
  TailoringHallucinationCheck,
  TailoringReviewOutcome,
} from './tailoring/tailoring-reviewer.js';
export { TailoringReviewer } from './tailoring/tailoring-reviewer.js';
export type { TailoringHashInput } from './tailoring/tailoring-hash.js';
export { computeTailoringInputHash } from './tailoring/tailoring-hash.js';
export type { TailoringPipelineTarget, TailoringPipelineDeps } from './tailoring/tailoring-pipeline.js';
export { runTailoringPipeline, CURRENT_TAILORING_ALGORITHM_VERSION } from './tailoring/tailoring-pipeline.js';
export type {
  TailoredResume,
  TailoringStatus,
  TailoringStage,
  TailoringStageExecution,
  TailoredContent,
  TailoredContentExperience,
  TailoredContentBullet,
} from './domain/tailored-resume.js';
export { createQueuedTailoredResume } from './domain/tailored-resume.js';
export type { TailoredResumeRepository } from './domain/tailored-resume-repository.js';

// Observability
export type { AILogger, AILogContext } from './observability/ai-logger.js';
export { ConsoleAILogger, NoopAILogger } from './observability/ai-logger.js';
export type { AIMetricsCollector, AIMetricTags } from './observability/ai-metrics.js';
export { InMemoryAIMetricsCollector, NoopAIMetricsCollector, AI_METRICS } from './observability/ai-metrics.js';
export type { AITracer, AISpan, AISpanAttributes } from './observability/ai-tracer.js';
export { InMemoryAITracer, NoopAITracer } from './observability/ai-tracer.js';

// Providers
export { BaseAIProvider } from './providers/base-provider.js';
export { OpenAIProvider } from './providers/openai-provider.js';
export { AnthropicProvider } from './providers/anthropic-provider.js';
export { GeminiProvider } from './providers/gemini-provider.js';
export { OpenRouterProvider } from './providers/openrouter-provider.js';
export { GroqProvider } from './providers/groq-provider.js';
export type {
  SupportedAIProviderName,
  CreateAIProviderInput,
  AIProviderEnvConfig,
  AIProviderRuntimeDeps,
} from './providers/create-ai-provider.js';
export {
  createAIProviderFromConfig,
  createPrimaryAIProviderFromEnv,
  resolveAIProviderName,
  resolveAIProviderApiKey,
  resolveAIProviderChain,
  isSupportedAIProviderName,
  SUPPORTED_AI_PROVIDER_NAMES,
} from './providers/create-ai-provider.js';
export type { FallbackAIProviderOptions } from './providers/fallback-ai-provider.js';
export { FallbackAIProvider } from './providers/fallback-ai-provider.js';

// Resilience
export type { AIRetryConfig } from './resilience/retry-policy.js';
export { AIRetryPolicy, DEFAULT_AI_RETRY_CONFIG } from './resilience/retry-policy.js';
export type {
  AIProviderHealthConfig,
  AIProviderHealthState,
  AIProviderHealthStatus,
} from './resilience/health-monitor.js';
export { AIProviderHealthMonitor, DEFAULT_AI_PROVIDER_HEALTH_CONFIG } from './resilience/health-monitor.js';
export { AIConcurrencyLimiter } from './resilience/concurrency-limiter.js';
