import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageRouter } from '../../src/background/message-router.js';

const { mockStorage } = vi.hoisted(() => ({
  mockStorage: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('../../src/shared/storage/chrome-storage.js', () => ({
  storage: mockStorage,
}));

function buildRouter(authenticatedRequest: ReturnType<typeof vi.fn>) {
  const auth = { authenticatedRequest } as unknown as ConstructorParameters<typeof MessageRouter>[0];
  const queue = { enqueue: vi.fn() } as unknown as ConstructorParameters<typeof MessageRouter>[1];
  const sync = {} as unknown as ConstructorParameters<typeof MessageRouter>[2];
  const notifications = {} as unknown as ConstructorParameters<typeof MessageRouter>[3];
  return new MessageRouter(auth, queue, sync, notifications);
}

const vacancy = {
  provider: 'linkedin',
  externalId: 'ext-1',
  title: 'Senior Engineer',
  company: 'Acme',
  location: 'Remote',
  technologies: [],
  description: 'desc',
  requirements: [],
  url: 'https://example.com/job/1',
  extractedAt: new Date().toISOString(),
} as never;

describe('MessageRouter AI actions', () => {
  beforeEach(() => {
    mockStorage.get.mockReset();
    mockStorage.set.mockReset();
    mockStorage.get.mockResolvedValue(null);
  });

  it('resolves the vacancy and default resume before calling tailor-resume, and returns the full result', async () => {
    const authenticatedRequest = vi.fn(async (path: string) => {
      if (path === '/api/v1/vacancies/by-url') return { exists: true, vacancyId: 'vacancy-1' };
      if (path === '/api/v1/resumes') return { resumes: [{ id: 'resume-1' }] };
      if (path === '/api/v1/ai/tailor-resume') {
        return { jobId: 'job-1', status: 'completed', cached: false, result: { tailoredResume: 'text' } };
      }
      throw new Error(`Unexpected path: ${path}`);
    });
    const router = buildRouter(authenticatedRequest);
    const sendResponse = vi.fn();

    await router.handle({ type: 'TAILOR_RESUME', payload: vacancy }, {} as chrome.runtime.MessageSender, sendResponse);

    expect(authenticatedRequest).toHaveBeenCalledWith(
      '/api/v1/ai/tailor-resume',
      expect.objectContaining({ body: JSON.stringify({ vacancyId: 'vacancy-1', resumeId: 'resume-1' }) })
    );
    expect(sendResponse).toHaveBeenCalledWith({
      ok: true,
      data: { jobId: 'job-1', status: 'completed', cached: false, result: { tailoredResume: 'text' }, vacancyId: 'vacancy-1' },
    });
    expect(mockStorage.set).toHaveBeenCalledWith('defaultResumeId', 'resume-1');
  });

  it('saves an unknown vacancy first to obtain a vacancyId', async () => {
    const authenticatedRequest = vi.fn(async (path: string) => {
      if (path === '/api/v1/vacancies/by-url') return { exists: false };
      if (path === '/api/v1/vacancies') return { id: 'vacancy-new' };
      if (path === '/api/v1/resumes') return { resumes: [{ id: 'resume-1' }] };
      if (path === '/api/v1/ai/cover-letter') {
        return { jobId: 'job-2', status: 'completed', cached: false, result: { coverLetter: 'text' } };
      }
      throw new Error(`Unexpected path: ${path}`);
    });
    const router = buildRouter(authenticatedRequest);
    const sendResponse = vi.fn();

    await router.handle({ type: 'COVER_LETTER', payload: vacancy }, {} as chrome.runtime.MessageSender, sendResponse);

    expect(authenticatedRequest).toHaveBeenCalledWith('/api/v1/vacancies', expect.objectContaining({ method: 'POST' }));
    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, data: expect.objectContaining({ vacancyId: 'vacancy-new' }) })
    );
  });

  it('returns a clear error instead of calling the AI endpoint when there is no active search profile', async () => {
    const authenticatedRequest = vi.fn(async (path: string) => {
      if (path === '/api/v1/vacancies/by-url') return { exists: true, vacancyId: 'vacancy-1' };
      if (path === '/api/v1/search-profiles') return { searchProfiles: [{ id: '1', isActive: false }] };
      throw new Error(`Unexpected path: ${path}`);
    });
    const router = buildRouter(authenticatedRequest);
    const sendResponse = vi.fn();

    await router.handle({ type: 'ANALYZE_VACANCY', payload: vacancy }, {} as chrome.runtime.MessageSender, sendResponse);

    expect(authenticatedRequest).not.toHaveBeenCalledWith('/api/v1/ai/analyze-vacancy', expect.anything());
    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false, code: 'NO_ACTIVE_SEARCH_PROFILE' })
    );
  });

  it('reuses a cached default resume id without re-fetching the resume list', async () => {
    mockStorage.get.mockImplementation(async (key: string) => (key === 'defaultResumeId' ? 'cached-resume' : null));
    const authenticatedRequest = vi.fn(async (path: string) => {
      if (path === '/api/v1/vacancies/by-url') return { exists: true, vacancyId: 'vacancy-1' };
      if (path === '/api/v1/ai/tailor-resume') {
        return { jobId: 'job-1', status: 'completed', cached: false, result: {} };
      }
      throw new Error(`Unexpected path: ${path}`);
    });
    const router = buildRouter(authenticatedRequest);
    const sendResponse = vi.fn();

    await router.handle({ type: 'TAILOR_RESUME', payload: vacancy }, {} as chrome.runtime.MessageSender, sendResponse);

    expect(authenticatedRequest).not.toHaveBeenCalledWith('/api/v1/resumes');
    expect(authenticatedRequest).toHaveBeenCalledWith(
      '/api/v1/ai/tailor-resume',
      expect.objectContaining({ body: JSON.stringify({ vacancyId: 'vacancy-1', resumeId: 'cached-resume' }) })
    );
  });
});
