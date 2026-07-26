import { describe, it, expect } from 'vitest';
import { Resume, ResumeFormat, ResumeVersionStatus, createResumeId, createUserId } from '@careeros/career';
import { ResumeMapper } from '../resume-mapper.js';

describe('ResumeMapper', () => {
  it('round-trips rawText through persistence alongside structured fields', () => {
    const resume = Resume.create({
      id: createResumeId('11111111-1111-4111-8111-111111111111'),
      userId: createUserId('22222222-2222-4222-8222-222222222222'),
      title: 'Backend Engineer Resume',
      summary: 'Backend engineer with 6 years of experience.',
    });

    const persisted = ResumeMapper.toPersistence(resume, {
      fileName: 'resume.pdf',
      rawText: 'Full extracted PDF text goes here.',
      workspaceId: 'workspace-1',
    });

    expect((persisted.parsedData as { rawText?: string }).rawText).toBe('Full extracted PDF text goes here.');

    const roundTripped = ResumeMapper.toDomain(persisted);

    expect(roundTripped.rawText).toBe('Full extracted PDF text goes here.');
    expect(roundTripped.summary).toBe('Backend engineer with 6 years of experience.');
  });

  it('leaves rawText undefined when no metadata or prior rawText is present', () => {
    const resume = Resume.create({
      id: createResumeId('33333333-3333-4333-8333-333333333333'),
      userId: createUserId('44444444-4444-4444-8444-444444444444'),
      title: 'Minimal Resume',
    });

    const persisted = ResumeMapper.toPersistence(resume);
    const roundTripped = ResumeMapper.toDomain(persisted);

    expect(roundTripped.rawText).toBeUndefined();
  });

  it('preserves the entity rawText on re-save when no new metadata.rawText is supplied', () => {
    const resume = Resume.create({
      id: createResumeId('55555555-5555-4555-8555-555555555555'),
      userId: createUserId('66666666-6666-4666-8666-666666666666'),
      title: 'Re-saved Resume',
      rawText: 'Already-extracted text from a prior upload.',
    });

    const persisted = ResumeMapper.toPersistence(resume);

    expect((persisted.parsedData as { rawText?: string }).rawText).toBe('Already-extracted text from a prior upload.');
  });

  it('preserves PDF format for uploaded resumes', () => {
    const resume = Resume.create({
      id: createResumeId('77777777-7777-4777-8777-777777777777'),
      userId: createUserId('88888888-8888-4888-8888-888888888888'),
      title: 'PDF Resume',
      format: ResumeFormat.PDF,
    });

    const persisted = ResumeMapper.toPersistence(resume, {
      fileName: 'resume.pdf',
      fileType: 'application/pdf',
    });

    const roundTripped = ResumeMapper.toDomain(persisted);

    expect(roundTripped.format).toBe(ResumeFormat.PDF);
  });

  it('round-trips version metadata (title/description/language/tags/status) through real columns', () => {
    const resume = Resume.create({
      id: createResumeId('99999999-9999-4999-8999-999999999999'),
      userId: createUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
      title: 'React EN',
      description: 'Tailored for React roles',
      language: 'English',
      tags: ['Frontend', 'React', 'Remote'],
      status: ResumeVersionStatus.DRAFT,
    });

    const persisted = ResumeMapper.toPersistence(resume);

    expect(persisted.title).toBe('React EN');
    expect(persisted.description).toBe('Tailored for React roles');
    expect(persisted.language).toBe('English');
    expect(persisted.tags).toEqual(['Frontend', 'React', 'Remote']);
    expect(persisted.status).toBe('DRAFT');

    const roundTripped = ResumeMapper.toDomain(persisted);

    expect(roundTripped.title).toBe('React EN');
    expect(roundTripped.description).toBe('Tailored for React roles');
    expect(roundTripped.language).toBe('English');
    expect(roundTripped.tags).toEqual(['Frontend', 'React', 'Remote']);
    expect(roundTripped.status).toBe(ResumeVersionStatus.DRAFT);
  });

  it('reads title from the real column even when parsedData.title differs (post-migration precedence)', () => {
    const roundTripped = ResumeMapper.toDomain({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      title: 'Column Title',
      description: null,
      language: null,
      tags: [],
      status: 'ACTIVE',
      originalFile: null,
      fileName: null,
      fileType: null,
      fileSize: null,
      parsedData: { title: 'Stale JSON Title' },
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    });

    expect(roundTripped.title).toBe('Column Title');
  });

  it('falls back to parsedData.title, then fileName, for pre-migration rows with an empty title column', () => {
    const fromParsedData = ResumeMapper.toDomain({
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      title: '',
      description: null,
      language: null,
      tags: [],
      status: 'ACTIVE',
      originalFile: null,
      fileName: 'legacy-resume.pdf',
      fileType: null,
      fileSize: null,
      parsedData: { title: 'Legacy JSON Title' },
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    });
    expect(fromParsedData.title).toBe('Legacy JSON Title');

    const fromFileName = ResumeMapper.toDomain({
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      title: '',
      description: null,
      language: null,
      tags: [],
      status: 'ACTIVE',
      originalFile: null,
      fileName: 'legacy-resume.pdf',
      fileType: null,
      fileSize: null,
      parsedData: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: '11111111-2222-4333-8444-555555555555',
    });
    expect(fromFileName.title).toBe('legacy-resume.pdf');
  });
});
