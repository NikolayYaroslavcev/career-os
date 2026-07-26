import { describe, it, expect } from 'vitest';
import { Recruiter, createRecruiterId, createCompanyId, Email } from '@careeros/career';
import { RecruiterMapper } from '../recruiter-mapper.js';

describe('RecruiterMapper', () => {
  it('round-trips a fully populated recruiter', () => {
    const recruiter = Recruiter.create({
      id: createRecruiterId('11111111-1111-4111-8111-111111111111'),
      name: 'Jane Doe',
      email: Email.create('jane@example.com'),
      phone: '+1 555 0100',
      linkedinUrl: 'https://linkedin.com/in/janedoe',
      notes: 'Responsive',
      companyId: createCompanyId('22222222-2222-4222-8222-222222222222'),
    });

    const persisted = RecruiterMapper.toPersistence(recruiter, 'workspace-1');
    expect(persisted.workspaceId).toBe('workspace-1');
    expect(persisted.email).toBe('jane@example.com');
    expect(persisted.companyId).toBe('22222222-2222-4222-8222-222222222222');

    const roundTripped = RecruiterMapper.toDomain({
      id: persisted.id,
      name: persisted.name,
      email: persisted.email ?? null,
      phone: persisted.phone ?? null,
      linkedinUrl: persisted.linkedinUrl ?? null,
      notes: persisted.notes ?? null,
      companyId: persisted.companyId ?? null,
      createdAt: persisted.createdAt,
      updatedAt: persisted.updatedAt,
    });

    expect(roundTripped.name).toBe('Jane Doe');
    expect(roundTripped.email?.value).toBe('jane@example.com');
    expect(roundTripped.companyId).toBe('22222222-2222-4222-8222-222222222222');
  });

  it('handles a minimal recruiter with no email or company', () => {
    const recruiter = Recruiter.create({
      id: createRecruiterId('33333333-3333-4333-8333-333333333333'),
      name: 'John Smith',
    });

    const persisted = RecruiterMapper.toPersistence(recruiter, 'workspace-1');
    expect(persisted.email).toBeUndefined();
    expect(persisted.companyId).toBeUndefined();

    const roundTripped = RecruiterMapper.toDomain({
      id: persisted.id,
      name: persisted.name,
      email: null,
      phone: null,
      linkedinUrl: null,
      notes: null,
      companyId: null,
      createdAt: persisted.createdAt,
      updatedAt: persisted.updatedAt,
    });

    expect(roundTripped.email).toBeUndefined();
    expect(roundTripped.companyId).toBeUndefined();
  });
});
