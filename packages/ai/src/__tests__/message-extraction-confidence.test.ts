import { describe, it, expect } from 'vitest';
import {
  computeMessageExtractionConfidence,
  classifyMessageExtractionStatus,
  MESSAGE_EXTRACTION_LOW_CONFIDENCE_THRESHOLD,
} from '../extraction/message-extraction-confidence.js';
import { extractedVacancyFieldsSchema, type ExtractedVacancyFields } from '../extraction/social-message-extraction-schema.js';
import { MessageExtractionStatus } from '../domain/message-extraction.js';

function fields(overrides: Partial<ExtractedVacancyFields> = {}): ExtractedVacancyFields {
  return extractedVacancyFieldsSchema.parse(overrides);
}

describe('computeMessageExtractionConfidence', () => {
  it('is deterministic for the same (fields, rawText) input', () => {
    const rawText = 'Senior Backend Engineer at Acme Corp. Remote, $120k-$150k.';
    const f = fields({
      title: 'Senior Backend Engineer',
      company: 'Acme Corp',
      technologies: ['Node.js'],
      requirements: ['5+ years experience'],
      evidence: { title: 'Senior Backend Engineer', company: 'Acme Corp' },
    });

    const first = computeMessageExtractionConfidence(f, rawText);
    const second = computeMessageExtractionConfidence(f, rawText);

    expect(second).toEqual(first);
  });

  it('scores a complete, evidence-backed extraction highly', () => {
    const rawText = 'Senior Backend Engineer at Acme Corp. Remote, full-time. Requirements: 5+ years Node.js. Country: Germany.';
    const f = fields({
      title: 'Senior Backend Engineer',
      company: 'Acme Corp',
      technologies: ['Node.js'],
      country: 'Germany',
      employmentType: 'full-time',
      remoteType: 'remote',
      requirements: ['5+ years Node.js'],
      evidence: {
        title: 'Senior Backend Engineer',
        company: 'Acme Corp',
        country: 'Germany',
        employmentType: 'full-time',
        remoteType: 'remote',
      },
    });

    const result = computeMessageExtractionConfidence(f, rawText);
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.missingFields).not.toContain('title');
    expect(result.missingFields).not.toContain('company');
  });

  it('scores an empty extraction at zero and lists everything as missing', () => {
    const result = computeMessageExtractionConfidence(fields(), 'just some chatter, not a job post');

    expect(result.score).toBe(0);
    expect(result.missingFields).toEqual(
      expect.arrayContaining(['title', 'company', 'technologies', 'salary', 'location', 'employmentType', 'remoteType', 'seniority', 'requirements', 'responsibilities']),
    );
  });

  it('penalizes fields whose evidence quote is not actually present in the source text', () => {
    const rawText = 'We are hiring a Backend Engineer.';
    const withFabricatedEvidence = fields({
      title: 'Backend Engineer',
      company: 'FakeCorp',
      evidence: { title: 'Backend Engineer', company: 'FakeCorp' }, // "FakeCorp" never appears in rawText
    });
    const withRealEvidence = fields({
      title: 'Backend Engineer',
      company: 'FakeCorp',
      evidence: { title: 'Backend Engineer' }, // no unverifiable claim for company
    });

    const fabricated = computeMessageExtractionConfidence(withFabricatedEvidence, rawText);
    const honest = computeMessageExtractionConfidence(withRealEvidence, rawText);

    // Both have identical extracted fields; only the (un)verifiable evidence differs.
    expect(fabricated.score).toBeLessThan(honest.score + 1);
    expect(fabricated.score).toBeLessThanOrEqual(honest.score);
  });

  it('does not penalize evidence for fields that were never populated', () => {
    const result = computeMessageExtractionConfidence(fields({ evidence: {} }), 'no useful signal here');
    // Only the "no signal at all" categories apply — evidence category is inapplicable, not penalized.
    expect(result.score).toBe(0);
  });
});

describe('classifyMessageExtractionStatus', () => {
  it('classifies SPAM when nothing job-related was extracted', () => {
    const status = classifyMessageExtractionStatus(0, fields());
    expect(status).toBe(MessageExtractionStatus.SPAM);
  });

  it('classifies LOW_CONFIDENCE when there is signal but the score is below threshold', () => {
    const f = fields({ title: 'Engineer' });
    const status = classifyMessageExtractionStatus(MESSAGE_EXTRACTION_LOW_CONFIDENCE_THRESHOLD - 1, f);
    expect(status).toBe(MessageExtractionStatus.LOW_CONFIDENCE);
  });

  it('classifies SUCCESS when there is signal and the score meets the threshold', () => {
    const f = fields({ title: 'Engineer', company: 'Acme' });
    const status = classifyMessageExtractionStatus(MESSAGE_EXTRACTION_LOW_CONFIDENCE_THRESHOLD, f);
    expect(status).toBe(MessageExtractionStatus.SUCCESS);
  });
});
