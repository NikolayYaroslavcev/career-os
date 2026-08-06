import { describe, it, expect } from 'vitest';
import { TailoringReviewer, type TailoringDraft, type TailoringOriginalEvidence } from '../tailoring-reviewer.js';
import type { AIProvider } from '../../domain/ai-provider.js';
import type { AIRequest, AIResponse, AICapabilities } from '../../domain/ai-types.js';

function makeFakeProvider(responseContent: string): AIProvider {
  return {
    name: 'fake',
    defaultModel: 'fake-model',
    async complete(_request: AIRequest): Promise<AIResponse> {
      return {
        content: responseContent,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        model: 'fake-model',
        provider: 'fake',
        latencyMs: 10,
        confidence: 1,
        requestId: 'req-1',
      };
    },
    getCapabilities(): AICapabilities {
      return { supportsStreaming: false, supportsVision: false, maxTokens: 8000, supportedModels: ['fake-model'] };
    },
    validateConfig(): boolean {
      return true;
    },
  };
}

const originalEvidence: TailoringOriginalEvidence = {
  summary: 'Backend engineer with payments experience.',
  experience: [
    { jobIndex: 0, company: 'Acme', position: 'Engineer', bullets: ['Built a payments API', 'Wrote unit tests'] },
  ],
  skills: ['Node.js'],
  technologies: ['Node.js'],
  education: ['BS in Computer Science — MIT'],
  certifications: [],
};

function makeDraft(bullets: TailoringDraft['experience'][number]['bullets']): TailoringDraft {
  return {
    optimizedSummary: 'Backend engineer skilled in payments infrastructure.',
    experience: [
      { jobIndex: 0, company: 'Acme', position: 'Engineer', technologies: ['Node.js'], relevanceScore: 90, bullets },
    ],
    emphasizedSkills: ['Node.js'],
    keywordOptimizations: [],
  };
}

describe('TailoringReviewer', () => {
  it('accepts a bullet the model marks as supported', async () => {
    const provider = makeFakeProvider(
      JSON.stringify({
        bulletChecks: [{ jobIndex: 0, bulletIndex: 0, supported: true }],
        flaggedEntities: [],
        overallRisk: 'low',
      }),
    );
    const reviewer = new TailoringReviewer(provider);
    const draft = makeDraft([{ bulletIndex: 0, text: 'Built a scalable payments API', sourceBulletIndex: 0 }]);

    const outcome = await reviewer.review(draft, originalEvidence);

    expect(outcome.changesRejected).toHaveLength(0);
    expect(outcome.correctedExperience[0]?.bullets[0]?.text).toBe('Built a scalable payments API');
    expect(outcome.hallucinationCheck.overallRisk).toBe('low');
  });

  it('reverts a bullet to its original text when the model reports invented content (e.g. an invented technology/metric)', async () => {
    const provider = makeFakeProvider(
      JSON.stringify({
        bulletChecks: [
          { jobIndex: 0, bulletIndex: 0, supported: false, reason: 'Invented "processed 10M requests/day" — no metric in source' },
        ],
        flaggedEntities: [],
        overallRisk: 'medium',
      }),
    );
    const reviewer = new TailoringReviewer(provider);
    const draft = makeDraft([
      { bulletIndex: 0, text: 'Built a payments API processing 10M requests/day using Kubernetes', sourceBulletIndex: 0 },
    ]);

    const outcome = await reviewer.review(draft, originalEvidence);

    expect(outcome.changesRejected).toHaveLength(1);
    expect(outcome.changesRejected[0]?.reason).toContain('Invented');
    // Reverted to the original bullet text, not the fabricated one.
    expect(outcome.correctedExperience[0]?.bullets[0]?.text).toBe('Built a payments API');
  });

  it('rejects a bullet with an out-of-range sourceBulletIndex without needing the model to say so (structural check, invented employer/project scenario)', async () => {
    const provider = makeFakeProvider(
      JSON.stringify({ bulletChecks: [], flaggedEntities: [], overallRisk: 'low' }),
    );
    const reviewer = new TailoringReviewer(provider);
    // sourceBulletIndex 5 doesn't exist on the original job (only has 2 bullets) —
    // this is what an invented/fabricated bullet with no real source looks like.
    const draft = makeDraft([{ bulletIndex: 0, text: 'Led a team of 20 engineers at a startup I never worked at', sourceBulletIndex: 5 }]);

    const outcome = await reviewer.review(draft, originalEvidence);

    expect(outcome.changesRejected).toHaveLength(1);
    expect(outcome.retryRecommended).toBe(true); // 1/1 bullets unsupported > 1/3 threshold
  });

  it('surfaces flagged entities (e.g. an invented certification) and raises overallRisk', async () => {
    const provider = makeFakeProvider(
      JSON.stringify({
        bulletChecks: [{ jobIndex: 0, bulletIndex: 0, supported: true }],
        flaggedEntities: [{ text: 'AWS Certified Solutions Architect', type: 'certification', reason: 'Not present in original resume' }],
        overallRisk: 'high',
      }),
    );
    const reviewer = new TailoringReviewer(provider);
    const draft = makeDraft([{ bulletIndex: 0, text: 'Built a payments API', sourceBulletIndex: 0 }]);

    const outcome = await reviewer.review(draft, originalEvidence);

    expect(outcome.hallucinationCheck.flaggedEntities).toHaveLength(1);
    expect(outcome.hallucinationCheck.overallRisk).toBe('high');
  });

  it('recommends a retry when more than a third of bullets are unsupported', async () => {
    const provider = makeFakeProvider(
      JSON.stringify({
        bulletChecks: [
          { jobIndex: 0, bulletIndex: 0, supported: false, reason: 'fabricated' },
          { jobIndex: 0, bulletIndex: 1, supported: true },
        ],
        flaggedEntities: [],
        overallRisk: 'medium',
      }),
    );
    const reviewer = new TailoringReviewer(provider);
    const draft = makeDraft([
      { bulletIndex: 0, text: 'Fabricated achievement', sourceBulletIndex: 0 },
      { bulletIndex: 1, text: 'Wrote unit tests for the payments API', sourceBulletIndex: 1 },
    ]);

    const outcome = await reviewer.review(draft, originalEvidence);
    expect(outcome.retryRecommended).toBe(true);
  });
});
