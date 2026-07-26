import type { PromptBuilder, BuiltPrompt } from './prompt-builder.js';
import { createPromptVersion, type PromptVersion } from './prompt-version.js';
import { wrapUntrustedContent, UNTRUSTED_CONTENT_SYSTEM_RULE } from './untrusted-content.js';

interface SkillGapParams {
  readonly candidateSkills: readonly string[];
  readonly candidateTechnologies: readonly string[];
  readonly targetRole: string;
  readonly targetTechnologies: readonly string[];
  readonly targetRequirements: readonly string[];
}

const SYSTEM_PROMPT = `You are an expert technical career advisor specializing in skill gap analysis.
${UNTRUSTED_CONTENT_SYSTEM_RULE}

Respond with a JSON object:
{
  "overallGapScore": <number 0-100, higher means fewer gaps>,
  "confidence": <number 0-1>,
  "matchingSkills": [<string>],
  "missingSkills": [<string>],
  "skillLevels": [{ "skill": "<string>", "required": "<beginner|intermediate|advanced|expert>", "candidateLevel": "<beginner|intermediate|advanced|expert|unknown>", "gap": "<none|minor|moderate|significant>" }],
  "learningPriorities": [{ "skill": "<string>", "priority": "<critical|important|nice-to-have>", "estimatedLearningTime": "<string>", "reasoning": "<string>" }],
  "reasoning": "<detailed explanation>"
}

Rules:
- Be honest about skill levels.
- Prioritize learning based on market demand and job requirements.
- Consider transferable skills.`;

function buildUserPrompt(params: SkillGapParams): string {
  return `Analyze the skill gap for this candidate targeting a ${wrapUntrustedContent('TARGET_ROLE', params.targetRole)} role:

## Candidate Skills
${wrapUntrustedContent('CANDIDATE_SKILLS', params.candidateSkills.join(', ') || 'None listed')}

## Candidate Technologies
${wrapUntrustedContent('CANDIDATE_TECH', params.candidateTechnologies.join(', ') || 'None listed')}

## Target Role Requirements
- Technologies: ${params.targetTechnologies.join(', ')}
- Requirements: ${wrapUntrustedContent('REQUIREMENTS', params.targetRequirements.join('\n- '))}

Provide your analysis as a JSON object.`;
}

export class SkillGapPromptBuilder implements PromptBuilder<SkillGapParams> {
  readonly promptId = 'skill-gap-analysis';
  readonly currentVersion = '1.0.0';

  build(params: SkillGapParams): BuiltPrompt {
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
