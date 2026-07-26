import { describe, it, expect } from 'vitest';
import { Communication } from './communication.js';
import { createCommunicationId, createApplicationId } from '../base/identifier.js';
import { CommunicationType, CommunicationDirection } from '../enums/communication-type.js';

describe('Communication', () => {
  const communicationId = createCommunicationId('comm-1');
  const applicationId = createApplicationId('app-1');

  it('should create a communication log entry', () => {
    const communication = Communication.create({
      id: communicationId,
      applicationId,
      type: CommunicationType.EMAIL,
      direction: CommunicationDirection.OUTBOUND,
      subject: 'Following up',
      content: 'Just checking in on the status.',
    });

    expect(communication.id).toBe(communicationId);
    expect(communication.applicationId).toBe(applicationId);
    expect(communication.type).toBe(CommunicationType.EMAIL);
    expect(communication.direction).toBe(CommunicationDirection.OUTBOUND);
    expect(communication.subject).toBe('Following up');
    expect(communication.content).toBe('Just checking in on the status.');
    expect(communication.sentAt).toBeInstanceOf(Date);
  });

  it('should default sentAt to now when not provided', () => {
    const before = new Date();
    const communication = Communication.create({
      id: communicationId,
      applicationId,
      type: CommunicationType.PHONE,
      direction: CommunicationDirection.INBOUND,
    });
    const after = new Date();

    expect(communication.sentAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(communication.sentAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});
