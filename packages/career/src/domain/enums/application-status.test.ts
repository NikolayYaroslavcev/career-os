import { describe, it, expect } from 'vitest';
import { ApplicationStatus, isTerminalStatus, canTransitionTo } from './application-status.js';

describe('ApplicationStatus', () => {
  it('should identify terminal statuses', () => {
    expect(isTerminalStatus(ApplicationStatus.REJECTED)).toBe(true);
    expect(isTerminalStatus(ApplicationStatus.ARCHIVED)).toBe(true);
    expect(isTerminalStatus(ApplicationStatus.SAVED)).toBe(false);
    expect(isTerminalStatus(ApplicationStatus.STARTED)).toBe(false);
    expect(isTerminalStatus(ApplicationStatus.SUBMITTED)).toBe(false);
    expect(isTerminalStatus(ApplicationStatus.OFFER)).toBe(false);
  });

  it('should allow valid transitions through the lifecycle', () => {
    expect(canTransitionTo(ApplicationStatus.SAVED, ApplicationStatus.STARTED)).toBe(true);
    expect(canTransitionTo(ApplicationStatus.SAVED, ApplicationStatus.SUBMITTED)).toBe(true);
    expect(canTransitionTo(ApplicationStatus.STARTED, ApplicationStatus.SUBMITTED)).toBe(true);
    expect(canTransitionTo(ApplicationStatus.SUBMITTED, ApplicationStatus.WAITING)).toBe(true);
    expect(canTransitionTo(ApplicationStatus.WAITING, ApplicationStatus.HR_INTERVIEW)).toBe(true);
  });

  it('should allow transition to rejected from any non-terminal status', () => {
    expect(canTransitionTo(ApplicationStatus.SAVED, ApplicationStatus.REJECTED)).toBe(true);
    expect(canTransitionTo(ApplicationStatus.SUBMITTED, ApplicationStatus.REJECTED)).toBe(true);
    expect(canTransitionTo(ApplicationStatus.OFFER, ApplicationStatus.REJECTED)).toBe(true);
  });

  it('should allow transition to archived from any non-terminal status', () => {
    expect(canTransitionTo(ApplicationStatus.SAVED, ApplicationStatus.ARCHIVED)).toBe(true);
    expect(canTransitionTo(ApplicationStatus.SUBMITTED, ApplicationStatus.ARCHIVED)).toBe(true);
  });

  it('should not allow transition from terminal status', () => {
    expect(canTransitionTo(ApplicationStatus.REJECTED, ApplicationStatus.SUBMITTED)).toBe(false);
    expect(canTransitionTo(ApplicationStatus.ARCHIVED, ApplicationStatus.WAITING)).toBe(false);
  });

  it('should not allow same status transition', () => {
    expect(canTransitionTo(ApplicationStatus.SAVED, ApplicationStatus.SAVED)).toBe(false);
    expect(canTransitionTo(ApplicationStatus.SUBMITTED, ApplicationStatus.SUBMITTED)).toBe(false);
  });

  it('should not allow going backwards', () => {
    expect(canTransitionTo(ApplicationStatus.SUBMITTED, ApplicationStatus.STARTED)).toBe(false);
    expect(canTransitionTo(ApplicationStatus.SUBMITTED, ApplicationStatus.SAVED)).toBe(false);
    expect(canTransitionTo(ApplicationStatus.WAITING, ApplicationStatus.SUBMITTED)).toBe(false);
  });
});
