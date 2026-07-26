import type { PromptBuilder, BuiltPrompt } from './prompt-builder.js';
import { createPromptVersion, type PromptVersion } from './prompt-version.js';
import { wrapUntrustedContent, UNTRUSTED_CONTENT_SYSTEM_RULE } from './untrusted-content.js';

interface ResumeAnalysisParams {
  readonly resumeSummary: string;
  readonly skills: readonly string[];
  readonly technologies: readonly string[];
  readonly experience: ReadonlyArray<{
    readonly company: string;
    readonly position: string;
    readonly description: string;
    readonly technologies: readonly string[];
  }>;
  readonly education: ReadonlyArray<{
    readonly institution: string;
    readonly degree: string;
    readonly field: string;
  }>;
}

const SYSTEM_PROMPT = `You are an expert resume analyst. Analyze the provided resume and return a structured assessment.
${UNTRUSTED_CONTENT_SYSTEM_RULE}

Respond with a JSON object:
{
  "overallQuality": <number 0-100>,
  "confidence": <number 0-1>,
  "strengths": [<string>],
  "weaknesses": [<string>],
  "skillGaps": [<string>],
  "recommendations": [<string>],
  "marketPositioning": "<junior|mid|senior|lead>",
  "reasoning": "<detailed explanation>"
}

Rules:
- Be specific and actionable in recommendations.
- Identify skill gaps relative to current market demands.
- Consider career progression and trajectory.`;

function buildUserPrompt(params: ResumeAnalysisParams): string {
  const expBlocks = params.experience.map(
    (e) => `- ${e.position} at ${e.company}: ${e.description} (Technologies: ${e.technologies.join(', ')})`
  ).join('\n');

  const eduBlocks = params.education.map(
    (e) => `- ${e.degree} in ${e.field} from ${e.institution}`
  ).join('\n');

  return `Analyze this resume:

## Summary
${wrapUntrustedContent('RESUME_SUMMARY', params.resumeSummary)}

## Skills
${wrapUntrustedContent('SKILLS', params.skills.join(', '))}

## Technologies
${wrapUntrustedContent('TECHNOLOGIES', params.technologies.join(', '))}

## Experience
${expBlocks || 'None listed'}

## Education
${eduBlocks || 'None listed'}

Provide your analysis as a JSON object.`;
}

export class ResumeAnalysisPromptBuilder implements PromptBuilder<ResumeAnalysisParams> {
  readonly promptId = 'resume-analysis';
  readonly currentVersion = '1.0.0';

  build(params: ResumeAnalysisParams): BuiltPrompt {
    const userPrompt = buildUserPrompt(params);

    return {
      system: SYSTEM_PROMPT,
      user: userPrompt,
      version: this.getVersion(),
    };
  }

  getVersion(): PromptVersion {
    return createPromptVersion(this.promptId, this.currentVersion, SYSTEM_PROMPT);
  }
}
