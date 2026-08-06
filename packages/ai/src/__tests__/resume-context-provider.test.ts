import { describe, it, expect } from 'vitest';
import { ResumeContextProviderImpl, type ResumeContextProviderDeps } from '../context/resume-context-provider.js';
import type { ResumeId, Resume, StructuredResume, ResumeRepository, StructuredResumeRepository } from '@careeros/career';

function createMockResume(rawText?: string): Resume {
  const now = new Date();
  return {
    id: 'resume-1' as ResumeId,
    userId: 'user-1',
    title: 'Test Resume',
    summary: 'Test summary',
    skills: [
      { name: 'TypeScript', level: 'advanced' },
      { name: 'React', level: 'advanced' },
    ],
    technologies: [
      { name: 'Node.js', category: 'runtime' },
      { name: 'PostgreSQL', category: 'database' },
    ],
    experience: [
      {
        company: 'TechCorp',
        position: 'Senior Developer',
        startDate: new Date('2020-01-01'),
        description: 'Built things',
        technologies: [{ name: 'TypeScript', category: 'language' }],
      },
    ],
    education: [],
    format: 'json',
    isDefault: true,
    createdAt: now,
    updatedAt: now,
    rawText,
    totalYearsOfExperience: 5,
  } as unknown as Resume;
}

function createMockStructuredResume(
  sourceHash: string,
  extractionVersion: string,
  status: 'pending' | 'completed' | 'failed' = 'completed',
): StructuredResume {
  return {
    id: 'structured-1',
    resumeId: 'resume-1' as ResumeId,
    sourceHash,
    extractionVersion,
    extractionStatus: status,
    summary: 'Extracted summary',
    seniorityLevel: 'senior',
    totalYearsOfExperience: 8,
    skills: ['TypeScript', 'React', 'Node.js'],
    technologies: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
    experience: [
      {
        company: 'TechCorp',
        position: 'Senior Developer',
        startDate: new Date('2020-01-01'),
        description: 'Built things',
        bullets: ['Built things'],
        technologies: ['TypeScript', 'React'],
      },
    ],
    education: [
      {
        institution: 'MIT',
        degree: 'BS',
        field: 'Computer Science',
        startDate: new Date('2012-09-01'),
        endDate: new Date('2016-05-01'),
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    isFreshFor: (currentRawTextHash: string, currentExtractionVersion: string): boolean => {
      return (
        status === 'completed' &&
        sourceHash === currentRawTextHash &&
        extractionVersion === currentExtractionVersion
      );
    },
  } as unknown as StructuredResume;
}

function createMockResumeRepository(resume: Resume): ResumeRepository {
  return {
    findById: async () => resume,
    findByIds: async () => [resume],
    findByUserId: async () => [resume],
    findDefaultByUserId: async () => resume,
    save: async (): Promise<void> => {},
    delete: async (): Promise<void> => {},
    exists: async () => true,
  };
}

function createMockStructuredResumeRepository(
  structured: StructuredResume | null,
): StructuredResumeRepository {
  return {
    findByResumeId: async () => structured,
    upsert: async (): Promise<void> => {},
  };
}

function computeHash(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return hash.toString(16);
}

function createDeps(
  resume: Resume,
  structured: StructuredResume | null = null,
  extractionVersion = '1.0.0',
): ResumeContextProviderDeps {
  return {
    resumeRepository: createMockResumeRepository(resume),
    structuredResumeRepository: createMockStructuredResumeRepository(structured),
    extractionVersion,
    fallbackContextBuilder: (rawText: string, _budgetTokens: number) => `Fallback: ${rawText.slice(0, 100)}`,
    tokenEstimator: (text: string) => Math.ceil(text.length / 4),
  };
}

describe('ResumeContextProviderImpl', () => {
  describe('getContext', () => {
    it('throws when resume not found', async () => {
      const resume = createMockResume();
      const deps = createDeps(resume);
      deps.resumeRepository.findById = async (): Promise<Resume | null> => null;
      const provider = new ResumeContextProviderImpl(deps);

      await expect(provider.getContext('resume-1' as ResumeId, 1000)).rejects.toThrow('Resume not found');
    });

    it('uses fallback when rawText is missing', async () => {
      const resume = createMockResume(undefined);
      const deps = createDeps(resume);
      const provider = new ResumeContextProviderImpl(deps);

      const context = await provider.getContext('resume-1' as ResumeId, 1000);

      expect(context.source).toBe('fallback_raw');
      expect(context.promptText).toContain('Fallback:');
    });

    it('uses fallback when no structured resume exists', async () => {
      const resume = createMockResume('Some raw text');
      const deps = createDeps(resume, null);
      const provider = new ResumeContextProviderImpl(deps);

      const context = await provider.getContext('resume-1' as ResumeId, 1000);

      expect(context.source).toBe('fallback_raw');
      expect(context.promptText).toContain('Fallback:');
    });

    it('uses fallback when structured resume is not fresh', async () => {
      const rawText = 'Some raw text';
      const resume = createMockResume(rawText);
      const structured = createMockStructuredResume('wrong-hash', '1.0.0');
      const deps = createDeps(resume, structured);
      const provider = new ResumeContextProviderImpl(deps);

      const context = await provider.getContext('resume-1' as ResumeId, 1000);

      expect(context.source).toBe('fallback_raw');
    });

    it('uses structured when fresh', async () => {
      const rawText = 'Some raw text';
      const resume = createMockResume(rawText);
      const hash = computeHash(rawText);
      const structured = createMockStructuredResume(hash, '1.0.0');
      const deps = createDeps(resume, structured);
      const provider = new ResumeContextProviderImpl(deps);

      const context = await provider.getContext('resume-1' as ResumeId, 1000);

      expect(context.source).toBe('structured');
      expect(context.summary).toBe('Extracted summary');
      expect(context.skills).toContain('TypeScript');
      expect(context.technologies).toContain('React');
      expect(context.experience).toHaveLength(1);
      const exp = context.experience[0];
      expect(exp).toBeDefined();
      expect(exp?.company).toBe('TechCorp');
    });

    it('uses fallback when extraction status is not completed', async () => {
      const rawText = 'Some raw text';
      const resume = createMockResume(rawText);
      const hash = computeHash(rawText);
      const structured = createMockStructuredResume(hash, '1.0.0', 'failed');
      const deps = createDeps(resume, structured);
      const provider = new ResumeContextProviderImpl(deps);

      const context = await provider.getContext('resume-1' as ResumeId, 1000);

      expect(context.source).toBe('fallback_raw');
    });

    it('uses fallback when extraction version mismatch', async () => {
      const rawText = 'Some raw text';
      const resume = createMockResume(rawText);
      const hash = computeHash(rawText);
      const structured = createMockStructuredResume(hash, '2.0.0');
      const deps = createDeps(resume, structured, '1.0.0');
      const provider = new ResumeContextProviderImpl(deps);

      const context = await provider.getContext('resume-1' as ResumeId, 1000);

      expect(context.source).toBe('fallback_raw');
    });
  });

  describe('structured context', () => {
    it('includes all structured fields', async () => {
      const rawText = 'Some raw text';
      const resume = createMockResume(rawText);
      const hash = computeHash(rawText);
      const structured = createMockStructuredResume(hash, '1.0.0');
      const deps = createDeps(resume, structured);
      const provider = new ResumeContextProviderImpl(deps);

      const context = await provider.getContext('resume-1' as ResumeId, 1000);

      expect(context.source).toBe('structured');
      expect(context.summary).toBe('Extracted summary');
      expect(context.skills).toEqual(['TypeScript', 'React', 'Node.js']);
      expect(context.technologies).toEqual(['TypeScript', 'React', 'Node.js', 'PostgreSQL']);
      expect(context.totalYearsOfExperience).toBe(8);
      expect(context.experience).toHaveLength(1);
      const exp = context.experience[0];
      expect(exp).toBeDefined();
      expect(exp?.company).toBe('TechCorp');
      expect(exp?.position).toBe('Senior Developer');
      expect(exp?.technologies).toEqual(['TypeScript', 'React']);
      expect(context.promptText).toContain('## Summary');
      expect(context.promptText).toContain('## Skills');
      expect(context.promptText).toContain('## Technologies');
      expect(context.promptText).toContain('## Work Experience');
    });
  });

  describe('fallback context', () => {
    it('includes resume fields', async () => {
      const resume = createMockResume('Some raw text');
      const deps = createDeps(resume);
      const provider = new ResumeContextProviderImpl(deps);

      const context = await provider.getContext('resume-1' as ResumeId, 1000);

      expect(context.source).toBe('fallback_raw');
      expect(context.summary).toBe('Test summary');
      expect(context.skills).toEqual(['TypeScript', 'React']);
      expect(context.technologies).toEqual(['Node.js', 'PostgreSQL']);
      expect(context.experience).toHaveLength(1);
      const exp = context.experience[0];
      expect(exp).toBeDefined();
      expect(exp?.company).toBe('TechCorp');
      expect(exp?.technologies).toEqual(['TypeScript']);
    });

    it('calls fallback builder with correct args', async () => {
      const rawText = 'Test raw text content';
      const resume = createMockResume(rawText);
      let calledWith: { rawText: string; budgetTokens: number; maxChars: number } | null = null;
      
      const deps: ResumeContextProviderDeps = {
        resumeRepository: createMockResumeRepository(resume),
        structuredResumeRepository: createMockStructuredResumeRepository(null),
        extractionVersion: '1.0.0',
        fallbackContextBuilder: (rawText: string, budgetTokens: number, maxChars: number) => {
          calledWith = { rawText, budgetTokens, maxChars };
          return 'fallback result';
        },
        tokenEstimator: (text: string) => Math.ceil(text.length / 4),
      };
      
      const provider = new ResumeContextProviderImpl(deps);
      await provider.getContext('resume-1' as ResumeId, 1500);

      expect(calledWith).toEqual({
        rawText,
        budgetTokens: 1500,
        maxChars: rawText.length,
      });
    });
  });
});
