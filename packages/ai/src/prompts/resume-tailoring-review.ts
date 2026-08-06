import type { PromptBuilder, BuiltPrompt } from './prompt-builder.js';
import { createPromptVersion, type PromptVersion } from './prompt-version.js';
import { wrapUntrustedContent, UNTRUSTED_CONTENT_SYSTEM_RULE } from './untrusted-content.js';

export interface TailoringReviewOriginalJob {
  readonly jobIndex: number;
  readonly company: string;
  readonly position: string;
  readonly bullets: readonly string[];
}

export interface TailoringReviewBullet {
  readonly jobIndex: number;
  readonly bulletIndex: number;
  readonly text: string;
  readonly sourceBulletIndex: number;
}

export interface TailoringReviewParams {
  readonly originalSummary: string;
  readonly originalExperience: readonly TailoringReviewOriginalJob[];
  readonly originalSkills: readonly string[];
  readonly originalTechnologies: readonly string[];
  readonly originalEducation: readonly string[];
  readonly originalCertifications: readonly string[];

  readonly tailoredSummary: string;
  readonly tailoredBullets: readonly TailoringReviewBullet[];
  readonly emphasizedSkills: readonly string[];
  readonly keywordOptimizations: readonly string[];
}

export interface TailoringReviewResult {
  readonly bulletChecks: ReadonlyArray<{
    readonly jobIndex: number;
    readonly bulletIndex: number;
    readonly supported: boolean;
    readonly reason?: string;
  }>;
  readonly flaggedEntities: ReadonlyArray<{
    readonly text: string;
    readonly type: string;
    readonly reason: string;
  }>;
  readonly overallRisk: 'low' | 'medium' | 'high';
}

/**
 * Second-pass reviewer (ADR-031 Phase 7 / Zero Hallucination Policy):
 * a single batch call comparing every generated bullet against the specific
 * original bullet it claims to derive from, plus a whole-output scan for
 * fabricated companies/technologies/certifications/education not present
 * anywhere in the source resume. One call for the whole tailored resume
 * rather than one call per bullet — implements AIRailguards.checkEvidenceBatch.
 */
const SYSTEM_PROMPT = `You are a strict fact-checker reviewing an AI-tailored resume against the candidate's original resume. Your only job is to catch fabrication — you do not judge writing quality.

You must respond with a JSON object matching this exact schema:
{
  "bulletChecks": [
    { "jobIndex": <int>, "bulletIndex": <int>, "supported": <bool>, "reason": "<required if supported is false: what was added/changed that has no basis in the source bullet>" }
  ],
  "flaggedEntities": [
    { "text": "<the fabricated term>", "type": "<technology|company|certification|education|metric|employer|other>", "reason": "<why this has no basis in the original resume>" }
  ],
  "overallRisk": "<low|medium|high>"
}

Rules:
- For each item under "Rewritten bullets to check", compare it ONLY against its cited "Source bullet". Mark supported=false if the rewritten text adds a number, tool, scope, employer, or claim not present in that specific source bullet — even if the same fact appears elsewhere in the candidate's resume, it does not make that mismatch acceptable; the citation must be honest.
- If a rewritten bullet only rephrases, reorders, or condenses its cited source bullet without adding new factual content, mark supported=true.
- flaggedEntities is a separate, document-wide scan: list any company, technology, certification, degree, or metric that appears in the tailored summary/bullets/skills/keywords but does NOT appear anywhere in the candidate's original resume data provided below. Do not flag something that legitimately appears in the original data.
- overallRisk = "high" if any flaggedEntities are found or more than a third of bulletChecks are unsupported; "medium" if some bulletChecks are unsupported but no flaggedEntities; "low" otherwise.
- Do not comment on style, tone, or quality — only factual support.
${UNTRUSTED_CONTENT_SYSTEM_RULE}`;

function buildUserPrompt(params: TailoringReviewParams): string {
  const originalJobsText = params.originalExperience
    .map((job) => {
      const bullets = job.bullets.length
        ? job.bullets.map((b, i) => `  [${i}] ${b}`).join('\n')
        : '  (none)';
      return `Job [${job.jobIndex}]: ${job.position} at ${job.company}\n${bullets}`;
    })
    .join('\n\n');

  const bulletsToCheckText = params.tailoredBullets
    .map((b) => {
      const job = params.originalExperience.find((j) => j.jobIndex === b.jobIndex);
      const sourceBullet =
        b.sourceBulletIndex >= 0 ? job?.bullets[b.sourceBulletIndex] : undefined;
      return `- jobIndex=${b.jobIndex}, bulletIndex=${b.bulletIndex}\n  Rewritten: "${b.text}"\n  Source bullet: ${sourceBullet ? `"${sourceBullet}"` : '(none cited — job had no bullets, compare against job description only)'}`;
    })
    .join('\n');

  return `## Candidate's Original Resume Data

Summary: ${wrapUntrustedContent('ORIGINAL_SUMMARY', params.originalSummary)}

Original Experience:
${wrapUntrustedContent('ORIGINAL_EXPERIENCE', originalJobsText)}

Original Skills: ${params.originalSkills.join(', ') || 'None'}
Original Technologies: ${params.originalTechnologies.join(', ') || 'None'}
Original Education: ${params.originalEducation.join('; ') || 'None'}
Original Certifications: ${params.originalCertifications.join(', ') || 'None'}

## Tailored Output To Review

Tailored Summary: ${wrapUntrustedContent('TAILORED_SUMMARY', params.tailoredSummary)}
Emphasized Skills: ${params.emphasizedSkills.join(', ') || 'None'}
Keyword Optimizations: ${params.keywordOptimizations.join(', ') || 'None'}

Rewritten bullets to check:
${wrapUntrustedContent('TAILORED_BULLETS', bulletsToCheckText)}

Review the tailored output for fabrication as instructed and respond with the JSON object.`;
}

export class TailoringReviewPromptBuilder implements PromptBuilder<TailoringReviewParams> {
  readonly promptId = 'resume-tailoring-review';
  readonly currentVersion = '1.0.0';

  build(params: TailoringReviewParams): BuiltPrompt {
    return {
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(params),
      version: this.getVersion(),
    };
  }

  getVersion(): PromptVersion {
    return createPromptVersion(this.promptId, this.currentVersion, SYSTEM_PROMPT);
  }
}
