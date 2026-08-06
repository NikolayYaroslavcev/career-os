import { describe, it, expect, vi } from 'vitest';
import { createMessageExtraction, MessageExtractionStatus, extractedVacancyFieldsSchema } from '@careeros/ai';
import type { PrismaSocialMessageRepository, PrismaMessageExtractionRepository } from '@careeros/database';
import { createTelegramDiscoveryFilter } from '../container.js';

function makeVacancy(overrides: Partial<{ sourceId: string; source: string; title: string; companyName: string }> = {}) {
  return {
    source: 'telegram',
    sourceId: 'frontend_jobs:100',
    title: 'Senior Backend Engineer',
    companyName: 'Acme Corp',
    ...overrides,
  } as never;
}

function makeExtraction(overrides: Partial<{ status: MessageExtractionStatus; deterministicConfidence: number; company: string | null; links: string[] }> = {}) {
  const status = overrides.status ?? MessageExtractionStatus.SUCCESS;
  const deterministicConfidence = overrides.deterministicConfidence ?? 80;
  return createMessageExtraction({
    messageId: 'msg-1',
    provider: 'openai',
    model: 'gpt-4o-mini',
    promptId: 'message-extraction',
    promptVersion: '1.0.0',
    promptChecksum: 'checksum',
    extractedFields: extractedVacancyFieldsSchema.parse({
      company: overrides.company === undefined ? 'Acme Corp' : overrides.company,
      title: 'Senior Backend Engineer',
      links: overrides.links ?? ['https://acmecorp.example/careers'],
    }),
    deterministicConfidence,
    status,
    tokenUsage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
    estimatedCostUsd: 0.001,
    latencyMs: 100,
    contentHash: 'hash-1',
    fromCache: false,
  });
}

function fakeRepos(extraction: ReturnType<typeof makeExtraction> | null) {
  const socialMessageRepository = {
    findBySourceAndExternalId: vi.fn().mockResolvedValue(extraction ? { id: 'msg-1' } : null),
  } as unknown as PrismaSocialMessageRepository;
  const messageExtractionRepository = {
    findLatestByMessageId: vi.fn().mockResolvedValue(extraction),
  } as unknown as PrismaMessageExtractionRepository;
  return { socialMessageRepository, messageExtractionRepository };
}

describe('createTelegramDiscoveryFilter', () => {
  it('returns a VacancyForDiscovery for a high-confidence SUCCESS extraction with a company and an external link', async () => {
    const { socialMessageRepository, messageExtractionRepository } = fakeRepos(makeExtraction({ deterministicConfidence: 85 }));
    const filter = createTelegramDiscoveryFilter(socialMessageRepository, messageExtractionRepository);

    const result = await filter(makeVacancy());

    expect(result).toEqual({ companyName: 'Acme Corp', companyUrl: 'https://acmecorp.example/careers', title: 'Senior Backend Engineer' });
  });

  it('returns undefined when there is no extraction yet', async () => {
    const { socialMessageRepository, messageExtractionRepository } = fakeRepos(null);
    const filter = createTelegramDiscoveryFilter(socialMessageRepository, messageExtractionRepository);

    expect(await filter(makeVacancy())).toBeUndefined();
  });

  it('returns undefined when status is not SUCCESS', async () => {
    const { socialMessageRepository, messageExtractionRepository } = fakeRepos(
      makeExtraction({ status: MessageExtractionStatus.LOW_CONFIDENCE, deterministicConfidence: 85 })
    );
    const filter = createTelegramDiscoveryFilter(socialMessageRepository, messageExtractionRepository);

    expect(await filter(makeVacancy())).toBeUndefined();
  });

  it('returns undefined when confidence clears vacancy-creation SUCCESS but not the stricter discovery threshold', async () => {
    const { socialMessageRepository, messageExtractionRepository } = fakeRepos(
      makeExtraction({ status: MessageExtractionStatus.SUCCESS, deterministicConfidence: 50 })
    );
    const filter = createTelegramDiscoveryFilter(socialMessageRepository, messageExtractionRepository);

    expect(await filter(makeVacancy())).toBeUndefined();
  });

  it('returns undefined when the extraction has no company name', async () => {
    const { socialMessageRepository, messageExtractionRepository } = fakeRepos(
      makeExtraction({ deterministicConfidence: 85, company: null })
    );
    const filter = createTelegramDiscoveryFilter(socialMessageRepository, messageExtractionRepository);

    expect(await filter(makeVacancy())).toBeUndefined();
  });

  it('returns undefined when the only links are Telegram/mailto (no real company URL to use)', async () => {
    const { socialMessageRepository, messageExtractionRepository } = fakeRepos(
      makeExtraction({ deterministicConfidence: 85, links: ['https://t.me/acmecorp_hr', 'mailto:hr@acmecorp.example'] })
    );
    const filter = createTelegramDiscoveryFilter(socialMessageRepository, messageExtractionRepository);

    expect(await filter(makeVacancy())).toBeUndefined();
  });

  it('returns undefined for a malformed sourceId with no channel:messageId separator', async () => {
    const { socialMessageRepository, messageExtractionRepository } = fakeRepos(makeExtraction({ deterministicConfidence: 85 }));
    const filter = createTelegramDiscoveryFilter(socialMessageRepository, messageExtractionRepository);

    expect(await filter(makeVacancy({ sourceId: 'no-separator' }))).toBeUndefined();
    expect(socialMessageRepository.findBySourceAndExternalId).not.toHaveBeenCalled();
  });
});
