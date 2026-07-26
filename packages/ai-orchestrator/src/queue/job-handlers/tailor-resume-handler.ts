import type { AIProvider } from '@careeros/ai';
import { ResumeTailoringPromptBuilder } from '@careeros/ai';
import type { JobHandler, JobHandlerResult } from '../../orchestrator-config.js';

export interface TailorResumeInput {
  readonly vacancyId: string;
  readonly vacancyTitle: string;
  readonly vacancyDescription: string;
  readonly companyName: string;
  readonly technologies: string[];
  readonly resumeId: string;
  readonly resumeText: string;
  readonly requirements?: string[];
  readonly structuredResume?: {
    readonly summary: string;
    readonly skills: string[];
    readonly technologies: string[];
    readonly experience: Array<{
      readonly company: string;
      readonly position: string;
      readonly description: string;
      readonly technologies: string[];
    }>;
    readonly education?: Array<{
      readonly institution: string;
      readonly degree: string;
      readonly field: string;
    }>;
  };
}

export interface TailorResumeResult {
  readonly optimizedSummary: string;
  readonly reorderedExperience: Array<{
    readonly company: string;
    readonly position: string;
    readonly description: string;
    readonly technologies: string[];
    readonly relevanceScore: number;
  }>;
  readonly emphasizedSkills: string[];
  readonly keywordOptimizations: string[];
  readonly tailoredResume: string;
}

export class TailorResumeHandler implements JobHandler<TailorResumeInput, TailorResumeResult> {
  readonly feature = 'tailor_resume' as const;
  private readonly promptBuilder = new ResumeTailoringPromptBuilder();

  async execute(input: TailorResumeInput, provider: AIProvider): Promise<JobHandlerResult<TailorResumeResult>> {
    const prompt = this.promptBuilder.build({
      vacancyTitle: input.vacancyTitle,
      vacancyDescription: input.vacancyDescription,
      companyName: input.companyName,
      technologies: input.technologies,
      requirements: input.requirements,
      resumeSummary: input.structuredResume?.summary ?? input.resumeText,
      resumeExperience: input.structuredResume?.experience ?? [],
      resumeSkills: input.structuredResume?.skills ?? [],
      resumeTechnologies: input.structuredResume?.technologies ?? [],
      resumeEducation: input.structuredResume?.education ?? [],
    });

    const response = await provider.complete({
      systemPrompt: prompt.system,
      prompt: prompt.user,
      model: provider.defaultModel,
      temperature: 0.7,
      maxTokens: 4000,
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
        optimizedSummary: String(parsed.optimizedSummary || ''),
        reorderedExperience: Array.isArray(parsed.reorderedExperience)
          ? parsed.reorderedExperience.map((exp: Record<string, unknown>) => ({
              company: String(exp.company || ''),
              position: String(exp.position || ''),
              description: String(exp.description || ''),
              technologies: Array.isArray(exp.technologies) ? exp.technologies.map(String) : [],
              relevanceScore: Number(exp.relevanceScore) || 0,
            }))
          : [],
        emphasizedSkills: Array.isArray(parsed.emphasizedSkills) ? parsed.emphasizedSkills.map(String) : [],
        keywordOptimizations: Array.isArray(parsed.keywordOptimizations) ? parsed.keywordOptimizations.map(String) : [],
        tailoredResume: String(parsed.tailoredResume || ''),
      },
      usage: response.usage,
    };
  }
}
