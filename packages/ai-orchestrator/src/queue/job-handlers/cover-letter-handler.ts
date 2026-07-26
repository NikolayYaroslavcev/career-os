import type { AIProvider } from '@careeros/ai';
import { CoverLetterPromptBuilder } from '@careeros/ai';
import type { JobHandler, JobHandlerResult } from '../../orchestrator-config.js';

export interface CoverLetterInput {
  readonly vacancyId: string;
  readonly vacancyTitle: string;
  readonly vacancyDescription: string;
  readonly companyName: string;
  readonly companyIndustry?: string;
  readonly companySize?: string;
  readonly technologies: string[];
  readonly experienceLevel?: string;
  readonly location?: string;
  readonly resumeId: string;
  readonly resumeText: string;
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
  };
}

export interface CoverLetterResult {
  readonly coverLetter: string;
  readonly tone: 'formal' | 'conversational' | 'technical';
  readonly keyPoints: string[];
}

export class CoverLetterHandler implements JobHandler<CoverLetterInput, CoverLetterResult> {
  readonly feature = 'cover_letter' as const;
  private readonly promptBuilder = new CoverLetterPromptBuilder();

  async execute(input: CoverLetterInput, provider: AIProvider): Promise<JobHandlerResult<CoverLetterResult>> {
    const prompt = this.promptBuilder.build({
      vacancyTitle: input.vacancyTitle,
      vacancyDescription: input.vacancyDescription,
      companyName: input.companyName,
      companyIndustry: input.companyIndustry,
      companySize: input.companySize,
      technologies: input.technologies,
      experienceLevel: input.experienceLevel,
      location: input.location,
      resumeSummary: input.structuredResume?.summary ?? input.resumeText,
      resumeExperience: input.structuredResume?.experience ?? [],
      resumeSkills: input.structuredResume?.skills ?? [],
      resumeTechnologies: input.structuredResume?.technologies ?? [],
    });

    const response = await provider.complete({
      systemPrompt: prompt.system,
      prompt: prompt.user,
      model: provider.defaultModel,
      temperature: 0.8,
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

    const tone = String(parsed.tone || 'formal');
    const validTones = ['formal', 'conversational', 'technical'] as const;

    return {
      result: {
        coverLetter: String(parsed.coverLetter || ''),
        tone: validTones.includes(tone as typeof validTones[number]) ? tone as 'formal' | 'conversational' | 'technical' : 'formal',
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.map(String) : [],
      },
      usage: response.usage,
    };
  }
}
