import { describe, it, expect, vi } from 'vitest';
import { NoopLogger } from '@careeros/providers';
import type { NormalizedVacancy } from '@careeros/providers';
import { SocialMessage, SocialPlatform, TransportType, createSocialMessageId } from '@careeros/career';
import { MessageExtractionStatus, createMessageExtraction, extractedVacancyFieldsSchema } from '@careeros/ai';
import type { MessageExtraction, ExtractedVacancyFields } from '@careeros/ai';
import { LinkedInFeedDiscoveryService, parseLinkedInFeedWorkspaceId } from '../linkedin-feed-discovery-service.js';

function buildMessage(overrides: Partial<{ platform: SocialPlatform; sourceId: string; externalMessageId: string; rawText: string; links: readonly string[] }> = {}): SocialMessage {
  return SocialMessage.create({
    id: createSocialMessageId('msg-1'),
    platform: overrides.platform ?? SocialPlatform.LINKEDIN,
    sourceId: overrides.sourceId ?? 'linkedin-feed:ws-1',
    externalMessageId: overrides.externalMessageId ?? 'urn:li:activity:555',
    publishedAt: new Date('2026-08-20T10:00:00Z'),
    rawText: overrides.rawText ?? 'We are hiring a Senior Backend Engineer, remote. Apply at https://example.com/careers/backend',
    links: overrides.links ?? [],
    contentHash: 'hash-1',
    transport: TransportType.BROWSER_EXTENSION,
  });
}

function buildFields(overrides: Partial<ExtractedVacancyFields> = {}): ExtractedVacancyFields {
  return extractedVacancyFieldsSchema.parse({
    title: 'Senior Backend Engineer',
    company: 'Acme Corp',
    technologies: ['typescript', 'node'],
    ...overrides,
  });
}

function buildExtraction(overrides: Partial<{ status: MessageExtractionStatus; fields: ExtractedVacancyFields }> = {}): MessageExtraction {
  return createMessageExtraction({
    messageId: 'msg-1',
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    promptId: 'message-extraction',
    promptVersion: '1',
    promptChecksum: 'checksum',
    extractedFields: overrides.fields ?? buildFields(),
    deterministicConfidence: 80,
    status: overrides.status ?? MessageExtractionStatus.SUCCESS,
    tokenUsage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
    estimatedCostUsd: 0,
    latencyMs: 100,
    contentHash: 'hash-1',
    fromCache: false,
  });
}

describe('parseLinkedInFeedWorkspaceId', () => {
  it('extracts the workspaceId from a well-formed LinkedIn Feed sourceId', () => {
    expect(parseLinkedInFeedWorkspaceId('linkedin-feed:ws-1')).toBe('ws-1');
  });

  it('returns null for a sourceId that is not workspace-scoped LinkedIn Feed', () => {
    expect(parseLinkedInFeedWorkspaceId('frontend_jobs')).toBeNull();
    expect(parseLinkedInFeedWorkspaceId('linkedin-feed:')).toBeNull();
  });
});

describe('LinkedInFeedDiscoveryService', () => {
  function buildService(ingestVacancyForWorkspace: ReturnType<typeof vi.fn>) {
    return new LinkedInFeedDiscoveryService({ ingestVacancyForWorkspace }, new NoopLogger());
  }

  it('creates a VacancySource for a vacancy-like LinkedIn post', async () => {
    const ingestVacancyForWorkspace = vi.fn().mockResolvedValue(true);
    const service = buildService(ingestVacancyForWorkspace);

    const result = await service.discoverFromMessage(buildMessage(), buildExtraction());

    expect(result).toEqual({ created: true });
    expect(ingestVacancyForWorkspace).toHaveBeenCalledTimes(1);
    const [normalized, workspaceId] = ingestVacancyForWorkspace.mock.calls[0] as [NormalizedVacancy, string];
    expect(workspaceId).toBe('ws-1');
    expect(normalized.source).toBe('linkedin_feed');
    expect(normalized.title).toBe('Senior Backend Engineer');
    expect(normalized.companyName).toBe('Acme Corp');
  });

  it('does not create a VacancySource for an ordinary post with no title or company extracted', async () => {
    const ingestVacancyForWorkspace = vi.fn();
    const service = buildService(ingestVacancyForWorkspace);

    const result = await service.discoverFromMessage(
      buildMessage({ rawText: 'Great conference today, met so many people!' }),
      buildExtraction({ fields: buildFields({ title: null, company: null }) }),
    );

    expect(result).toEqual({ created: false, reason: 'insufficient-fields' });
    expect(ingestVacancyForWorkspace).not.toHaveBeenCalled();
  });

  it('does not create a VacancySource when extraction status is LOW_CONFIDENCE', async () => {
    const ingestVacancyForWorkspace = vi.fn();
    const service = buildService(ingestVacancyForWorkspace);

    const result = await service.discoverFromMessage(buildMessage(), buildExtraction({ status: MessageExtractionStatus.LOW_CONFIDENCE }));

    expect(result).toEqual({ created: false, reason: 'extraction-status-low_confidence' });
    expect(ingestVacancyForWorkspace).not.toHaveBeenCalled();
  });

  it('does not create a VacancySource when extraction status is SPAM', async () => {
    const ingestVacancyForWorkspace = vi.fn();
    const service = buildService(ingestVacancyForWorkspace);

    const result = await service.discoverFromMessage(buildMessage(), buildExtraction({ status: MessageExtractionStatus.SPAM }));

    expect(result).toEqual({ created: false, reason: 'extraction-status-spam' });
    expect(ingestVacancyForWorkspace).not.toHaveBeenCalled();
  });

  it('does not create a VacancySource when the AI extraction itself failed (PROVIDER_ERROR)', async () => {
    const ingestVacancyForWorkspace = vi.fn();
    const service = buildService(ingestVacancyForWorkspace);

    const result = await service.discoverFromMessage(
      buildMessage(),
      buildExtraction({ status: MessageExtractionStatus.PROVIDER_ERROR, fields: extractedVacancyFieldsSchema.parse({}) }),
    );

    expect(result).toEqual({ created: false, reason: 'extraction-status-provider_error' });
    expect(ingestVacancyForWorkspace).not.toHaveBeenCalled();
  });

  it('is a strict no-op for a non-LinkedIn SocialMessage (Telegram is unaffected)', async () => {
    const ingestVacancyForWorkspace = vi.fn();
    const service = buildService(ingestVacancyForWorkspace);

    const result = await service.discoverFromMessage(buildMessage({ platform: SocialPlatform.TELEGRAM }), buildExtraction());

    expect(result).toEqual({ created: false, reason: 'not-linkedin' });
    expect(ingestVacancyForWorkspace).not.toHaveBeenCalled();
  });

  it('prefers a link the extension read from the DOM (message.links) over the AI-extracted text link', async () => {
    const ingestVacancyForWorkspace = vi.fn().mockResolvedValue(true);
    const service = buildService(ingestVacancyForWorkspace);

    await service.discoverFromMessage(
      buildMessage({ links: ['https://www.linkedin.com/jobs/view/4457912173/'] }),
      buildExtraction({ fields: buildFields({ links: ['https://example.com/careers/backend-engineer'] }) }),
    );

    const [normalized] = ingestVacancyForWorkspace.mock.calls[0] as [NormalizedVacancy];
    expect(normalized.url).toBe('https://www.linkedin.com/jobs/view/4457912173/');
  });

  it('falls back to the AI-extracted text link when the DOM scrape found no links', async () => {
    const ingestVacancyForWorkspace = vi.fn().mockResolvedValue(true);
    const service = buildService(ingestVacancyForWorkspace);

    await service.discoverFromMessage(
      buildMessage({ links: [] }),
      buildExtraction({ fields: buildFields({ links: ['https://example.com/careers/backend-engineer', 'https://example.com/about'] }) }),
    );

    const [normalized] = ingestVacancyForWorkspace.mock.calls[0] as [NormalizedVacancy];
    expect(normalized.url).toBe('https://example.com/careers/backend-engineer');
  });

  // LinkedIn's SDUI feed markup exposes no real post permalink (confirmed
  // live 2026-08-26 — a postId-derived URL 404s), so when neither the DOM
  // scrape nor the AI extraction found a link, no URL is fabricated.
  it('leaves the vacancy url undefined rather than fabricating a LinkedIn post permalink', async () => {
    const ingestVacancyForWorkspace = vi.fn().mockResolvedValue(true);
    const service = buildService(ingestVacancyForWorkspace);

    await service.discoverFromMessage(
      buildMessage({ externalMessageId: 'urn:li:activity:777', links: [] }),
      buildExtraction({ fields: buildFields({ links: [] }) }),
    );

    const [normalized] = ingestVacancyForWorkspace.mock.calls[0] as [NormalizedVacancy];
    expect(normalized.url).toBeUndefined();
  });

  it('skips a message whose sourceId is not a workspace-scoped LinkedIn Feed source', async () => {
    const ingestVacancyForWorkspace = vi.fn();
    const service = buildService(ingestVacancyForWorkspace);

    const result = await service.discoverFromMessage(buildMessage({ sourceId: 'not-linkedin-feed-shaped' }), buildExtraction());

    expect(result).toEqual({ created: false, reason: 'unparseable-source' });
    expect(ingestVacancyForWorkspace).not.toHaveBeenCalled();
  });
});
