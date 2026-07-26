import type { AIProvider } from '@careeros/ai';
import { SalaryAnalysisPromptBuilder } from '@careeros/ai';
import type { JobHandler, JobHandlerResult } from '../../orchestrator-config.js';

export interface SalaryAnalysisInput {
  readonly jobTitle: string;
  readonly company?: string;
  readonly location: string;
  readonly technologies: string[];
  readonly experienceLevel: string;
  readonly providedSalaryMin?: number;
  readonly providedSalaryMax?: number;
  readonly candidateExperienceYears?: number;
  readonly candidateSkills?: string[];
}

export interface SalaryAnalysisResult {
  readonly estimatedRange: {
    readonly min: number;
    readonly max: number;
    readonly median: number;
    readonly currency: string;
  };
  readonly marketPosition: string;
  readonly factors: string[];
  readonly recommendations: string[];
}

export class SalaryAnalysisHandler implements JobHandler<SalaryAnalysisInput, SalaryAnalysisResult> {
  readonly feature = 'salary_analysis' as const;
  private readonly promptBuilder = new SalaryAnalysisPromptBuilder();

  async execute(input: SalaryAnalysisInput, provider: AIProvider): Promise<JobHandlerResult<SalaryAnalysisResult>> {
    const prompt = this.promptBuilder.build({
      jobTitle: input.jobTitle,
      company: input.company,
      location: input.location,
      technologies: input.technologies,
      experienceLevel: input.experienceLevel,
      providedSalaryMin: input.providedSalaryMin,
      providedSalaryMax: input.providedSalaryMax,
      candidateExperienceYears: input.candidateExperienceYears ?? 0,
      candidateSkills: input.candidateSkills ?? [],
    });

    const response = await provider.complete({
      systemPrompt: prompt.system,
      prompt: prompt.user,
      model: provider.defaultModel,
      temperature: 0.3,
      maxTokens: 1500,
      promptId: this.promptBuilder.promptId,
      promptVersion: this.promptBuilder.currentVersion,
      promptChecksum: prompt.version.checksum,
    });

    const content = response.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response as JSON');
    }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const range = (parsed.estimatedRange ?? {}) as Record<string, unknown>;

    return {
      result: {
        estimatedRange: {
          min: Number(range.min) || 0,
          max: Number(range.max) || 0,
          median: Number(range.median) || 0,
          currency: String(range.currency || 'USD'),
        },
        marketPosition: String(parsed.marketPosition || ''),
        factors: Array.isArray(parsed.factors) ? parsed.factors.map(String) : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.map(String) : [],
      },
      usage: response.usage,
    };
  }
}
