import type { AIProvider } from '@careeros/ai';
import { VacancyAnalysisPromptBuilder } from '@careeros/ai';
import type { JobHandler, JobHandlerResult } from '../../orchestrator-config.js';

export interface AnalyzeVacancyInput {
  readonly vacancyId: string;
  readonly vacancyTitle: string;
  readonly vacancyDescription: string;
  readonly companyName: string;
  readonly technologies: string[];
  readonly experienceLevel?: string;
  readonly salaryRange?: string;
  readonly location: string;
  readonly searchProfileId: string;
  readonly desiredPositions: string[];
  readonly desiredTechnologies: string[];
  readonly desiredExperienceLevel: string;
  readonly isRemoteOnly: boolean;
  readonly desiredLocations: string[];
  readonly resume?: {
    readonly summary: string;
    readonly skills: string[];
    readonly technologies: string[];
    readonly yearsOfExperience: number;
    readonly rawText: string;
  };
}

export interface AnalyzeVacancyResult {
  readonly overallScore: number;
  readonly confidence: number;
  readonly recommendation: string;
  readonly summary: string;
  readonly strengths: string[];
  readonly weaknesses: string[];
  readonly requiredSkills: string[];
  readonly missingSkills: string[];
  readonly reasoning: string;
}

export class AnalyzeVacancyHandler implements JobHandler<AnalyzeVacancyInput, AnalyzeVacancyResult> {
  readonly feature = 'analyze_vacancy' as const;
  private readonly promptBuilder = new VacancyAnalysisPromptBuilder();

  async execute(input: AnalyzeVacancyInput, provider: AIProvider): Promise<JobHandlerResult<AnalyzeVacancyResult>> {
    const prompt = this.promptBuilder.build({
      vacancyTitle: input.vacancyTitle,
      vacancyDescription: input.vacancyDescription,
      companyName: input.companyName,
      technologies: input.technologies,
      experienceLevel: input.experienceLevel,
      salaryRange: input.salaryRange,
      location: input.location,
      desiredPositions: input.desiredPositions,
      desiredTechnologies: input.desiredTechnologies,
      desiredExperienceLevel: input.desiredExperienceLevel,
      isRemoteOnly: input.isRemoteOnly,
      desiredLocations: input.desiredLocations,
      resumeSummary: input.resume?.summary,
      resumeSkills: input.resume?.skills,
      resumeTechnologies: input.resume?.technologies,
      yearsOfExperience: input.resume?.yearsOfExperience,
      resumeRawText: input.resume?.rawText,
    });

    const response = await provider.complete({
      systemPrompt: prompt.system,
      prompt: prompt.user,
      model: provider.defaultModel,
      temperature: 0.3,
      maxTokens: 2000,
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

    return {
      result: {
        overallScore: Math.min(100, Math.max(0, Number(parsed.overallScore) || 0)),
        confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0)),
        recommendation: String(parsed.recommendation || 'Maybe'),
        summary: String(parsed.summary || ''),
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
        weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.map(String) : [],
        requiredSkills: Array.isArray(parsed.requiredSkills) ? parsed.requiredSkills.map(String) : [],
        missingSkills: Array.isArray(parsed.missingSkills) ? parsed.missingSkills.map(String) : [],
        reasoning: String(parsed.reasoning || ''),
      },
      usage: response.usage,
    };
  }
}
