// Domain
export type { AIRequest, AIResponse, TokenUsage, AICapabilities } from './domain/ai-types.js';
export { AIErrorType, AIError, AIParseError } from './domain/ai-error.js';
export { Recommendation, RECOMMENDATION_PRIORITY, compareRecommendations } from './domain/recommendation.js';
export type { MatchResult, MatchResultInput, FitAssessment } from './domain/match-result.js';
export { createMatchResult } from './domain/match-result.js';
export type { MatchResultRepository } from './domain/match-result-repository.js';
export type { AIProvider, AIProviderConfig, AIProviderFactory } from './domain/ai-provider.js';
export type {
  AIRailguards,
  AIRailguardConfig,
  EvidenceCheckInput,
  EvidenceCheckResult,
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

// Prompts
export type { PromptBuilder, BuiltPrompt } from './prompts/prompt-builder.js';
export type { PromptVersion } from './prompts/prompt-version.js';
export { createPromptVersion, verifyPromptChecksum } from './prompts/prompt-version.js';
export { VacancyAnalysisPromptBuilder } from './prompts/vacancy-analysis.js';
export { ResumeAnalysisPromptBuilder } from './prompts/resume-analysis.js';
export { SkillGapPromptBuilder } from './prompts/skill-gap.js';
export { SalaryAnalysisPromptBuilder } from './prompts/salary-analysis.js';
export { SearchProfileSuggestionPromptBuilder } from './prompts/search-profile-suggestion.js';
export type { SearchProfileSuggestionParams } from './prompts/search-profile-suggestion.js';
export { StructuredResumeExtractionPromptBuilder } from './prompts/structured-resume-extraction.js';
export type { StructuredResumeExtractionParams } from './prompts/structured-resume-extraction.js';

// Cache
export { computePromptHash } from './cache/prompt-hash.js';
export type { AICache, AICacheEntry } from './cache/ai-cache.js';
export { InMemoryAICache } from './cache/ai-cache.js';

// Cost
export type { CostTracker, CostRecord, CostSummary, ModelPricing } from './cost/cost-tracker.js';
export { estimateCost } from './cost/cost-tracker.js';
export { InMemoryCostTracker } from './cost/cost-tracker-impl.js';

// Extraction
export type { StructuredResumeExtractionResult, ResumeExtractionEngineDeps, ResumeExtractionEngineConfig } from './extraction/resume-extraction-engine.js';
export { ResumeExtractionEngine } from './extraction/resume-extraction-engine.js';

// Context
export type { ResumeContextProvider, ResumeContextProviderDeps, ResumeAIContext, ResumeExperienceContext } from './context/resume-context-provider.js';
export { ResumeContextProviderImpl } from './context/resume-context-provider.js';

// Matching
export type { ExplainabilityFactor, ExplainabilityReport } from './matching/explainability.js';
export { rankFactorsByImpact, getPositiveFactors, getNegativeFactors } from './matching/explainability.js';
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
} from './providers/create-ai-provider.js';
export {
  createAIProviderFromConfig,
  createPrimaryAIProviderFromEnv,
  resolveAIProviderName,
  resolveAIProviderApiKey,
  isSupportedAIProviderName,
  SUPPORTED_AI_PROVIDER_NAMES,
} from './providers/create-ai-provider.js';
