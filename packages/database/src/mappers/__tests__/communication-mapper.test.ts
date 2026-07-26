import { describe, it, expect } from 'vitest';
import {
  Communication,
  createCommunicationId,
  createApplicationId,
  CommunicationType,
  CommunicationDirection,
} from '@careeros/career';
import { CommunicationMapper } from '../communication-mapper.js';

describe('CommunicationMapper', () => {
  it('round-trips a communication log entry through the uppercase Prisma enum shape', () => {
    const communication = Communication.create({
      id: createCommunicationId('11111111-1111-4111-8111-111111111111'),
      applicationId: createApplicationId('22222222-2222-4222-8222-222222222222'),
      type: CommunicationType.LINKEDIN,
      direction: CommunicationDirection.OUTBOUND,
      subject: 'Intro',
      content: 'Hi there',
    });

    const persisted = CommunicationMapper.toPersistence(communication);
    expect(persisted.type).toBe('LINKEDIN');
    expect(persisted.direction).toBe('OUTBOUND');

    const roundTripped = CommunicationMapper.toDomain(persisted);
    expect(roundTripped.type).toBe(CommunicationType.LINKEDIN);
    expect(roundTripped.direction).toBe(CommunicationDirection.OUTBOUND);
    expect(roundTripped.subject).toBe('Intro');
    expect(roundTripped.content).toBe('Hi there');
  });
});
