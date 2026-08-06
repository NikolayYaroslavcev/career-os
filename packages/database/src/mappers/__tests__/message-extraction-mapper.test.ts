import { describe, it, expect } from 'vitest';
import { createMessageExtraction, MessageExtractionStatus, extractedVacancyFieldsSchema } from '@careeros/ai';
import { MessageExtractionMapper } from '../message-extraction-mapper.js';

describe('MessageExtractionMapper', () => {
  function makeEntity() {
    return createMessageExtraction({
      id: 'me-1',
      messageId: 'msg-1',
      provider: 'openai',
      model: 'gpt-4o-mini',
      promptId: 'message-extraction',
      promptVersion: '1.0.0',
      promptChecksum: 'abc123',
      extractedFields: extractedVacancyFieldsSchema.parse({
        company: 'Acme Corp',
        title: 'Senior Backend Engineer',
        technologies: ['Node.js'],
        salaryMin: 100000,
        salaryMax: 150000,
        currency: 'USD',
        country: 'Germany',
        seniority: 'senior',
        remoteType: 'remote',
        evidence: { title: 'Senior Backend Engineer' },
      }),
      language: 'en',
      deterministicConfidence: 82,
      aiSelfReportedConfidence: 0.9,
      missingFields: ['city'],
      status: MessageExtractionStatus.SUCCESS,
      tokenUsage: { promptTokens: 100, completionTokens: 200, totalTokens: 300 },
      estimatedCostUsd: 0.0015,
      latencyMs: 850,
      contentHash: 'hash-1',
      fromCache: false,
    });
  }

  it('round-trips all fields through toPersistence -> toDomain', () => {
    const entity = makeEntity();
    const persisted = MessageExtractionMapper.toPersistence(entity);

    expect(persisted.id).toBe('me-1');
    expect(persisted.messageId).toBe('msg-1');
    expect(persisted.company).toBe('Acme Corp');
    expect(persisted.title).toBe('Senior Backend Engineer');
    expect(persisted.salaryMin).toBe(100000);
    expect(persisted.salaryMax).toBe(150000);
    expect(persisted.country).toBe('Germany');
    expect(persisted.seniority).toBe('senior');
    expect(persisted.remoteType).toBe('remote');
    expect(persisted.language).toBe('en');
    expect(persisted.deterministicConfidence).toBe(82);
    expect(persisted.aiSelfReportedConfidence).toBe(0.9);
    expect(persisted.status).toBe('SUCCESS');
    expect(persisted.tokensIn).toBe(100);
    expect(persisted.tokensOut).toBe(200);
    expect(persisted.totalTokens).toBe(300);
    expect(persisted.estimatedCost).toBe(0.0015);
    expect(persisted.contentHash).toBe('hash-1');
    expect(persisted.fromCache).toBe(false);

    const record = {
      ...persisted,
      extractedFields: entity.extractedFields,
      missingFields: [...entity.missingFields],
    };
    const domain = MessageExtractionMapper.toDomain(record);

    expect(domain).toEqual(entity);
  });

  it('defaults nullable optional fields to undefined on the way back to a domain object', () => {
    const entity = makeEntity();
    const persisted = MessageExtractionMapper.toPersistence(entity);
    const record = { ...persisted, extractedFields: entity.extractedFields, missingFields: [], temperature: null, maxTokens: null, aiSelfReportedConfidence: null, errorMessage: null };

    const domain = MessageExtractionMapper.toDomain(record);

    expect(domain.temperature).toBeUndefined();
    expect(domain.maxTokens).toBeUndefined();
    expect(domain.aiSelfReportedConfidence).toBeUndefined();
    expect(domain.errorMessage).toBeUndefined();
    expect(domain.missingFields).toEqual([]);
  });
});
