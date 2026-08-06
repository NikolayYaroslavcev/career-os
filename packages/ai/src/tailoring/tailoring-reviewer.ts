import type { AIProvider } from '../domain/ai-provider.js';
import type { AIRequest, TokenUsage } from '../domain/ai-types.js';
import { TailoringReviewPromptBuilder, type TailoringReviewOriginalJob, type TailoringReviewBullet } from '../prompts/resume-tailoring-review.js';
import { extractJsonObject, tailoringReviewResultSchema } from './schemas.js';

export interface TailoringDraftBullet {
  readonly bulletIndex: number;
  readonly text: string;
  readonly sourceBulletIndex: number;
}

export interface TailoringDraftJob {
  readonly jobIndex: number;
  readonly company: string;
  readonly position: string;
  readonly technologies: readonly string[];
  readonly relevanceScore: number;
  readonly bullets: readonly TailoringDraftBullet[];
}

export interface TailoringDraft {
  readonly optimizedSummary: string;
  readonly experience: readonly TailoringDraftJob[];
  readonly emphasizedSkills: readonly string[];
  readonly keywordOptimizations: readonly string[];
}

export interface TailoringOriginalEvidence {
  readonly summary: string;
  readonly experience: readonly { jobIndex: number; company: string; position: string; bullets: readonly string[] }[];
  readonly skills: readonly string[];
  readonly technologies: readonly string[];
  readonly education: readonly string[];
  readonly certifications: readonly string[];
}

export interface TailoringChange {
  readonly section: string;
  readonly description: string;
}

export interface TailoringRejectedChange {
  readonly text: string;
  readonly reason: string;
}

export interface TailoringHallucinationCheck {
  readonly flaggedEntities: ReadonlyArray<{ readonly text: string; readonly type: string; readonly reason: string }>;
  readonly overallRisk: 'low' | 'medium' | 'high';
}

export interface TailoringReviewOutcome {
  readonly correctedExperience: readonly TailoringDraftJob[];
  readonly changesApplied: readonly TailoringChange[];
  readonly changesRejected: readonly TailoringRejectedChange[];
  readonly hallucinationCheck: TailoringHallucinationCheck;
  readonly confidence: number;
  readonly usage: TokenUsage;
  readonly latencyMs: number;
  /** True when more than a third of bullets were unsupported — the pipeline may regenerate once before falling back to reverting. */
  readonly retryRecommended: boolean;
}

const RETRY_THRESHOLD_RATIO = 1 / 3;

/**
 * Second-pass reviewer implementing the Zero Hallucination Policy (ADR-031
 * Phase 4/7): one batch LLM call (TailoringReviewPromptBuilder) checks every
 * generated bullet against the specific original bullet it cites, plus a
 * whole-output scan for fabricated entities. This is a tailoring-specific
 * concrete implementation of the evidence-checking concept in
 * packages/ai/src/domain/ai-guardrails.ts (AIRailguards) — it does not
 * literally `implements AIRailguards` because that interface's per-call
 * shapes (one claim per checkEvidence call, a separate detectHallucinations
 * call) don't fit a single combined batch call, and splitting this into two
 * LLM calls would double the cost for no benefit here.
 */
export class TailoringReviewer {
  private readonly promptBuilder = new TailoringReviewPromptBuilder();

  constructor(private readonly provider: AIProvider) {}

  async review(draft: TailoringDraft, original: TailoringOriginalEvidence): Promise<TailoringReviewOutcome> {
    const originalJobs: TailoringReviewOriginalJob[] = original.experience.map((job) => ({
      jobIndex: job.jobIndex,
      company: job.company,
      position: job.position,
      bullets: job.bullets,
    }));

    const tailoredBullets: TailoringReviewBullet[] = draft.experience.flatMap((job) =>
      job.bullets.map((b) => ({
        jobIndex: job.jobIndex,
        bulletIndex: b.bulletIndex,
        text: b.text,
        sourceBulletIndex: b.sourceBulletIndex,
      })),
    );

    const prompt = this.promptBuilder.build({
      originalSummary: original.summary,
      originalExperience: originalJobs,
      originalSkills: original.skills,
      originalTechnologies: original.technologies,
      originalEducation: original.education,
      originalCertifications: original.certifications,
      tailoredSummary: draft.optimizedSummary,
      tailoredBullets,
      emphasizedSkills: draft.emphasizedSkills,
      keywordOptimizations: draft.keywordOptimizations,
    });

    const request: AIRequest = {
      prompt: prompt.user,
      systemPrompt: prompt.system,
      promptId: prompt.version.id,
      promptVersion: prompt.version.version,
      promptChecksum: prompt.version.checksum,
      model: this.provider.defaultModel,
      temperature: 0,
    };

    const response = await this.provider.complete(request);
    const parsed = tailoringReviewResultSchema.parse(extractJsonObject(response.content));

    // Structural pre-check (no LLM needed): a sourceBulletIndex out of range
    // for its job is always unsupported, regardless of what the model said.
    const structuralUnsupported = new Set<string>();
    for (const bullet of tailoredBullets) {
      const job = originalJobs.find((j) => j.jobIndex === bullet.jobIndex);
      const validIndex =
        bullet.sourceBulletIndex === -1 ||
        (job !== undefined && bullet.sourceBulletIndex >= 0 && bullet.sourceBulletIndex < job.bullets.length);
      if (!validIndex) {
        structuralUnsupported.add(`${bullet.jobIndex}:${bullet.bulletIndex}`);
      }
    }

    const unsupportedKeys = new Set(structuralUnsupported);
    const reasonByKey = new Map<string, string>();
    for (const check of parsed.bulletChecks) {
      const key = `${check.jobIndex}:${check.bulletIndex}`;
      if (!check.supported) {
        unsupportedKeys.add(key);
        reasonByKey.set(key, check.reason ?? 'No matching evidence found in the original resume.');
      }
    }
    for (const key of structuralUnsupported) {
      if (!reasonByKey.has(key)) {
        reasonByKey.set(key, 'Cited source bullet does not exist in the original resume.');
      }
    }

    const changesApplied: TailoringChange[] = [];
    const changesRejected: TailoringRejectedChange[] = [];

    const correctedExperience: TailoringDraftJob[] = draft.experience.map((job) => {
      const originalJob = originalJobs.find((j) => j.jobIndex === job.jobIndex);
      const bullets = job.bullets.map((bullet) => {
        const key = `${job.jobIndex}:${bullet.bulletIndex}`;
        if (!unsupportedKeys.has(key)) {
          changesApplied.push({
            section: `${job.position} at ${job.company}`,
            description: bullet.text,
          });
          return bullet;
        }

        const fallbackText =
          bullet.sourceBulletIndex >= 0 ? originalJob?.bullets[bullet.sourceBulletIndex] : undefined;
        changesRejected.push({
          text: bullet.text,
          reason: reasonByKey.get(key) ?? 'No matching evidence found in the original resume.',
        });

        return fallbackText !== undefined ? { ...bullet, text: fallbackText } : bullet;
      });

      return { ...job, bullets };
    });

    const totalBullets = tailoredBullets.length || 1;
    const retryRecommended = unsupportedKeys.size / totalBullets > RETRY_THRESHOLD_RATIO;

    const confidence = Math.max(0, 1 - unsupportedKeys.size / totalBullets - parsed.flaggedEntities.length * 0.1);

    return {
      correctedExperience,
      changesApplied,
      changesRejected,
      hallucinationCheck: {
        flaggedEntities: parsed.flaggedEntities,
        overallRisk: parsed.overallRisk,
      },
      confidence,
      usage: response.usage,
      latencyMs: response.latencyMs,
      retryRecommended,
    };
  }
}
