import { describe, it, expect, beforeEach } from 'vitest';
import { Resume, ResumeVersionStatus, createResumeId, createUserId } from '@careeros/career';
import { InMemoryResumeRepository } from '../../testing/in-memory-repositories.js';
import { ResumeService, ResumeNotFoundError, ResumeNotAuthorizedError } from '../resume-service.js';

describe('ResumeService.updateVersionMetadata', () => {
  let repository: InMemoryResumeRepository;
  let service: ResumeService;
  const userId = createUserId('11111111-1111-4111-8111-111111111111');
  const otherUserId = createUserId('22222222-2222-4222-8222-222222222222');
  const resumeId = createResumeId('33333333-3333-4333-8333-333333333333');

  beforeEach(async () => {
    repository = new InMemoryResumeRepository();
    service = new ResumeService(repository);
    const resume = Resume.create({ id: resumeId, userId, title: 'Original Title' });
    await repository.save(resume);
  });

  it('updates title, description, language, tags and status', async () => {
    const updated = await service.updateVersionMetadata(resumeId, userId, {
      title: 'React EN',
      description: 'Tailored for React roles',
      language: 'English',
      tags: ['Frontend', 'React', 'Remote'],
      status: ResumeVersionStatus.ACTIVE,
    });

    expect(updated.title).toBe('React EN');
    expect(updated.description).toBe('Tailored for React roles');
    expect(updated.language).toBe('English');
    expect(updated.tags).toEqual(['Frontend', 'React', 'Remote']);
    expect(updated.status).toBe(ResumeVersionStatus.ACTIVE);

    const persisted = await repository.findById(resumeId);
    expect(persisted?.title).toBe('React EN');
  });

  it('applies partial updates without touching omitted fields', async () => {
    await service.updateVersionMetadata(resumeId, userId, { tags: ['Backend'] });
    const updated = await service.updateVersionMetadata(resumeId, userId, { status: ResumeVersionStatus.ARCHIVED });

    expect(updated.title).toBe('Original Title');
    expect(updated.tags).toEqual(['Backend']);
    expect(updated.status).toBe(ResumeVersionStatus.ARCHIVED);
  });

  it('throws ResumeNotFoundError for an unknown id', async () => {
    await expect(
      service.updateVersionMetadata(createResumeId('99999999-9999-4999-8999-999999999999'), userId, { title: 'X' }),
    ).rejects.toThrow(ResumeNotFoundError);
  });

  it('throws ResumeNotAuthorizedError when the resume belongs to another user', async () => {
    await expect(
      service.updateVersionMetadata(resumeId, otherUserId, { title: 'Hijacked' }),
    ).rejects.toThrow(ResumeNotAuthorizedError);
  });
});
