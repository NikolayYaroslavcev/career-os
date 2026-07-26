import { describe, it, expect } from 'vitest';
import { Recruiter } from './recruiter.js';
import { createRecruiterId, createCompanyId } from '../base/identifier.js';
import { Email } from '../value-objects/email.js';

describe('Recruiter', () => {
  const recruiterId = createRecruiterId('recruiter-1');

  it('should create a recruiter with minimal fields', () => {
    const recruiter = Recruiter.create({ id: recruiterId, name: '  Jane Doe  ' });

    expect(recruiter.id).toBe(recruiterId);
    expect(recruiter.name).toBe('Jane Doe');
    expect(recruiter.email).toBeUndefined();
    expect(recruiter.companyId).toBeUndefined();
  });

  it('should throw on empty name', () => {
    expect(() => Recruiter.create({ id: recruiterId, name: '   ' })).toThrow(
      'Recruiter name cannot be empty'
    );
  });

  it('should create with contact info and a linked company', () => {
    const companyId = createCompanyId('company-1');
    const recruiter = Recruiter.create({
      id: recruiterId,
      name: 'Jane Doe',
      email: Email.create('jane@example.com'),
      phone: '+1 555 0100',
      linkedinUrl: 'https://linkedin.com/in/janedoe',
      companyId,
    });

    expect(recruiter.email?.value).toBe('jane@example.com');
    expect(recruiter.phone).toBe('+1 555 0100');
    expect(recruiter.companyId).toBe(companyId);
  });

  it('should update contact info', () => {
    const recruiter = Recruiter.create({ id: recruiterId, name: 'Jane Doe' });
    const before = recruiter.updatedAt;

    recruiter.updateContactInfo({ phone: '+1 555 0199', notes: 'Prefers email' });

    expect(recruiter.phone).toBe('+1 555 0199');
    expect(recruiter.notes).toBe('Prefers email');
    expect(recruiter.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('should throw when updating to an empty name', () => {
    const recruiter = Recruiter.create({ id: recruiterId, name: 'Jane Doe' });
    expect(() => recruiter.updateContactInfo({ name: '   ' })).toThrow('Recruiter name cannot be empty');
  });
});
