export interface EvidenceCheckInput {
  readonly claim: string;
  readonly sourceData: ReadonlyArray<{ readonly field: string; readonly value: string }>;
  readonly provider: string;
  readonly model: string;
}

export interface EvidenceCheckResult {
  readonly supported: boolean;
  readonly confidence: number;
  readonly unsupportedClaims: readonly string[];
  readonly evidenceSources: readonly string[];
}

export interface ConfidenceValidationInput {
  readonly score: number;
  readonly confidence: number;
  readonly recommendation: string;
  readonly contextCompleteness: number;
}

export interface ConfidenceValidationResult {
  readonly calibrated: boolean;
  readonly adjustedConfidence: number;
  readonly reason: string;
}

export interface HallucinationCheckInput {
  readonly aiOutput: string;
  readonly knownEntities: ReadonlyArray<{ readonly type: string; readonly value: string }>;
  readonly provider: string;
  readonly model: string;
}

export interface HallucinationCheckResult {
  readonly hallucinationsDetected: boolean;
  readonly flaggedEntities: readonly FlaggedEntity[];
  readonly overallRisk: 'low' | 'medium' | 'high';
}

export interface FlaggedEntity {
  readonly text: string;
  readonly type: string;
  readonly reason: string;
}

export interface AIRailguards {
  checkEvidence(input: EvidenceCheckInput): Promise<EvidenceCheckResult>;
  validateConfidence(input: ConfidenceValidationInput): ConfidenceValidationResult;
  detectHallucinations(input: HallucinationCheckInput): Promise<HallucinationCheckResult>;
}

export interface AIRailguardConfig {
  readonly enableEvidenceChecking: boolean;
  readonly enableConfidenceValidation: boolean;
  readonly enableHallucinationDetection: boolean;
  readonly minConfidenceThreshold: number;
  readonly maxHallucinationRisk: 'low' | 'medium' | 'high';
}
