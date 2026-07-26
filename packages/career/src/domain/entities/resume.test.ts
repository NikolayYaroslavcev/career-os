import { describe, it, expect } from 'vitest';
import { Resume } from './resume.js';
import { ResumeVersionStatus } from '../enums/resume-version-status.js';
import { createUserId, createResumeId } from '../base/identifier.js';

describe('Resume', () => {
  const userId = createUserId('user-1');
  const resumeId = createResumeId('resume-1');

  it('defaults version metadata when not provided', () => {
    const resume = Resume.create({ id: resumeId, userId, title: 'Frontend Resume' });

    expect(resume.title).toBe('Frontend Resume');
    expect(resume.description).toBe('');
    expect(resume.language).toBeUndefined();
    expect(resume.tags).toEqual([]);
    expect(resume.status).toBe(ResumeVersionStatus.ACTIVE);
  });

  it('accepts version metadata on create', () => {
    const resume = Resume.create({
      id: resumeId,
      userId,
      title: 'React EN',
      description: 'Tailored for React roles',
      language: 'English',
      tags: ['Frontend', 'React', 'Remote'],
      status: ResumeVersionStatus.DRAFT,
    });

    expect(resume.description).toBe('Tailored for React roles');
    expect(resume.language).toBe('English');
    expect(resume.tags).toEqual(['Frontend', 'React', 'Remote']);
    expect(resume.status).toBe(ResumeVersionStatus.DRAFT);
  });

  it('updates description, language, tags and status', () => {
    const resume = Resume.create({ id: resumeId, userId, title: 'Backend Resume' });
    const before = resume.updatedAt;

    resume.updateDescription('Backend-focused version');
    resume.updateLanguage('Polish');
    resume.setTags(['Backend', 'Enterprise']);
    resume.updateStatus(ResumeVersionStatus.ARCHIVED);

    expect(resume.description).toBe('Backend-focused version');
    expect(resume.language).toBe('Polish');
    expect(resume.tags).toEqual(['Backend', 'Enterprise']);
    expect(resume.status).toBe(ResumeVersionStatus.ARCHIVED);
    expect(resume.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('returns a defensive copy of tags', () => {
    const resume = Resume.create({ id: resumeId, userId, title: 'Resume', tags: ['Frontend'] });
    const tags = resume.tags as string[];
    tags.push('Mutated');

    expect(resume.tags).toEqual(['Frontend']);
  });
});
