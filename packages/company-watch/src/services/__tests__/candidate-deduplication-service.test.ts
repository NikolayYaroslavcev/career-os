import { describe, it, expect } from 'vitest';
import { CandidateDeduplicationService } from '../candidate-deduplication-service.js';

describe('CandidateDeduplicationService', () => {
  const service = new CandidateDeduplicationService();

  it('findNearestMatch returns null when there are no known names', () => {
    expect(service.findNearestMatch('Acme Inc', [])).toBeNull();
  });

  it('findNearestMatch returns the closest known name by similarity', () => {
    const match = service.findNearestMatch('Acme Incorporated', ['Zzz Corp', 'Acme Inc', 'Beta LLC']);
    expect(match?.name).toBe('Acme Inc');
  });

  it('isDuplicate is true for an exact (case/punctuation-insensitive) name match', () => {
    expect(service.isDuplicate('Acme, Inc.', ['acme inc'])).toBe(true);
  });

  it('isDuplicate is false for a clearly distinct name', () => {
    expect(service.isDuplicate('Acme Inc', ['Globex Corporation'])).toBe(false);
  });

  it('isDuplicate is false for a merely similar (not near-identical) name — ADR §2 dedup-distance case, not a hard duplicate', () => {
    expect(service.isDuplicate('Acme Robotics', ['Acme Software'])).toBe(false);
  });
});
