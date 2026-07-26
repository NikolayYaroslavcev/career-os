import { BaseAIProvider } from '@careeros/ai';
import type { AIRequest, AIResponse, AICapabilities, AIProviderConfig } from '@careeros/ai';

/**
 * Deterministic, network-free AIProvider used by tests and the demo script.
 * Scores are derived from technology overlap between the vacancy and the
 * candidate (both embedded in the prompt text by VacancyAnalysisPromptBuilder),
 * so different fixtures produce different — but reproducible — match results.
 */
export class MockAIProvider extends BaseAIProvider {
  readonly name = 'mock';
  readonly defaultModel = 'mock-model';
  lastRequest: AIRequest | undefined;

  constructor(config: AIProviderConfig = { apiKey: 'mock' }) {
    super(config);
  }

  getCapabilities(): AICapabilities {
    return {
      supportsStreaming: false,
      supportsVision: false,
      maxTokens: 8000,
      supportedModels: ['mock-model'],
    };
  }

  protected async doComplete(request: AIRequest): Promise<Omit<AIResponse, 'latencyMs' | 'provider'>> {
    this.lastRequest = request;
    const content = JSON.stringify(this.buildAnalysis(request.prompt));

    return {
      content,
      usage: { promptTokens: 120, completionTokens: 180, totalTokens: 300 },
      model: this.defaultModel,
      confidence: 0.85,
      requestId: crypto.randomUUID(),
    };
  }

  private buildAnalysis(prompt: string): Record<string, unknown> {
    const techLines = [...prompt.matchAll(/- Technologies: (.*)/g)].map((m) => m[1] ?? '');
    const vacancyTechs = parseList(techLines[0]);
    const resumeTechs = parseList(techLines[1]);

    const overlap = vacancyTechs.filter((t) => resumeTechs.includes(t));
    const missing = vacancyTechs.filter((t) => !resumeTechs.includes(t));
    const overlapRatio = vacancyTechs.length > 0 ? overlap.length / vacancyTechs.length : 0.5;

    const overallScore = Math.round(30 + overlapRatio * 70);
    const recommendation =
      overallScore >= 80 ? 'StrongApply' : overallScore >= 60 ? 'Apply' : overallScore >= 40 ? 'Maybe' : 'Skip';

    return {
      overallScore,
      confidence: 0.85,
      recommendation,
      summary: `Mock analysis summary: ${overlap.length}/${vacancyTechs.length || 1} technologies matched.`,
      strengths: overlap.length > 0 ? overlap.map((t) => `Proficient in ${t}`) : ['Relevant general experience'],
      weaknesses: missing.length > 0 ? missing.map((t) => `Limited exposure to ${t}`) : ['No significant gaps identified'],
      requiredSkills: vacancyTechs,
      missingSkills: missing,
      seniorityEstimation: 'Middle (mock)',
      remotePolicy: 'Remote (mock)',
      salaryObservations: null,
      salaryFit: { score: 70, confidence: 0.6, reasoning: 'Salary expectations not explicitly compared in mock mode.' },
      locationFit: { score: 80, confidence: 0.7, reasoning: 'Remote-friendly role assumed compatible.' },
      experienceFit: { score: overallScore, confidence: 0.75, reasoning: 'Derived from technology overlap heuristic.' },
      careerGrowthFit: { score: 65, confidence: 0.5, reasoning: 'Generic growth assessment in mock mode.' },
      reasoning: `Mock analysis: ${overlap.length}/${vacancyTechs.length || 1} required technologies matched the candidate profile.`,
    };
  }
}

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}
