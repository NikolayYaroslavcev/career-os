export interface ProviderComparison {
  readonly providerA: string;
  readonly providerB: string;
  readonly metrics: ComparisonMetrics;
  readonly winner: string | null;
  readonly confidenceLevel: number;
}

export interface ModelComparison {
  readonly modelA: string;
  readonly modelB: string;
  readonly provider: string;
  readonly metrics: ComparisonMetrics;
  readonly winner: string | null;
  readonly confidenceLevel: number;
}

export interface PromptComparison {
  readonly promptId: string;
  readonly versionA: string;
  readonly versionB: string;
  readonly metrics: ComparisonMetrics;
  readonly winner: string | null;
  readonly confidenceLevel: number;
}

export interface ComparisonMetrics {
  readonly avgScore: number;
  readonly avgConfidence: number;
  readonly avgLatencyMs: number;
  readonly avgCostUsd: number;
  readonly totalRequests: number;
  readonly successRate: number;
  readonly scoreDistribution: ScoreDistribution;
}

export interface ScoreDistribution {
  readonly p50: number;
  readonly p90: number;
  readonly p99: number;
}

export interface EvaluationExperiment {
  readonly id: string;
  readonly name: string;
  readonly type: 'provider' | 'model' | 'prompt';
  readonly variants: readonly ExperimentVariant[];
  readonly sampleSize: number;
  readonly startDate: Date;
  readonly endDate?: Date;
  readonly status: 'pending' | 'running' | 'completed' | 'cancelled';
}

export interface ExperimentVariant {
  readonly id: string;
  readonly name: string;
  readonly config: Record<string, unknown>;
  readonly trafficPercentage: number;
}

export interface ExperimentResult {
  readonly experimentId: string;
  readonly variantResults: readonly VariantResult[];
  readonly winner: string | null;
  readonly statisticallySignificant: boolean;
  readonly pValue: number;
}

export interface VariantResult {
  readonly variantId: string;
  readonly sampleSize: number;
  readonly metrics: ComparisonMetrics;
}

export interface AIEvaluator {
  compareProviders(providerA: string, providerB: string, sampleSize?: number): Promise<ProviderComparison>;
  compareModels(modelA: string, modelB: string, provider: string, sampleSize?: number): Promise<ModelComparison>;
  comparePrompts(promptId: string, versionA: string, versionB: string, sampleSize?: number): Promise<PromptComparison>;
  createExperiment(experiment: Omit<EvaluationExperiment, 'id' | 'status'>): EvaluationExperiment;
  getExperimentResult(experimentId: string): Promise<ExperimentResult | null>;
}
