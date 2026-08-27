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

describe('MessageRouter LINKEDIN_FEED_POST_DETECTED', () => {
  beforeEach(() => {
    mockStorage.get.mockReset();
    mockStorage.set.mockReset();
    mockStorage.get.mockResolvedValue(null);
  });

  const candidate = {
    postId: 'urn:li:activity:555',
    postUrl: 'https://www.linkedin.com/feed/update/urn%3Ali%3Aactivity%3A555/',
    authorName: 'Jane Doe',
    rawText: 'We are hiring a senior engineer',
    links: ['https://example.com/careers'],
  };

  it('posts the candidate to the social-messages ingest endpoint via the authenticated request path', async () => {
    const authenticatedRequest = vi.fn(async (path: string) => {
      if (path === '/api/v1/social-messages/ingest') {
        return { ok: true, messageId: 'msg-1', created: true };
      }
      throw new Error(`Unexpected path: ${path}`);
    });
    const router = buildRouter(authenticatedRequest);
    const sendResponse = vi.fn();

    await router.handle({ type: 'LINKEDIN_FEED_POST_DETECTED', payload: candidate }, {} as chrome.runtime.MessageSender, sendResponse);

    expect(authenticatedRequest).toHaveBeenCalledWith(
      '/api/v1/social-messages/ingest',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          platform: 'LINKEDIN',
          externalMessageId: candidate.postId,
          authorUsername: candidate.authorName,
          publishedAt: undefined,
          rawText: candidate.rawText,
          links: candidate.links,
        }),
      })
    );
    expect(sendResponse).toHaveBeenCalledWith({ ok: true, data: { ok: true, messageId: 'msg-1', created: true } });
  });

  it('bumps the toolbar badge for a newly created (non-duplicate) post', async () => {
    const setBadgeText = vi.fn();
    const setBadgeBackgroundColor = vi.fn();
    vi.stubGlobal('chrome', { action: { setBadgeText, setBadgeBackgroundColor } });

    const authenticatedRequest = vi.fn(async () => ({ ok: true, messageId: 'msg-1', created: true }));
    const router = buildRouter(authenticatedRequest);
    const sendResponse = vi.fn();

    await router.handle({ type: 'LINKEDIN_FEED_POST_DETECTED', payload: candidate }, {} as chrome.runtime.MessageSender, sendResponse);

    expect(setBadgeText).toHaveBeenCalledWith({ text: '1' });
    expect(mockStorage.set).toHaveBeenCalledWith('linkedInFeedBadgeCount', expect.objectContaining({ count: 1 }));

    vi.unstubAllGlobals();
  });

  it('does not bump the toolbar badge for a duplicate post (created: false)', async () => {
    const setBadgeText = vi.fn();
    vi.stubGlobal('chrome', { action: { setBadgeText, setBadgeBackgroundColor: vi.fn() } });

    const authenticatedRequest = vi.fn(async () => ({ ok: true, messageId: 'msg-1', created: false }));
    const router = buildRouter(authenticatedRequest);
    const sendResponse = vi.fn();

    await router.handle({ type: 'LINKEDIN_FEED_POST_DETECTED', payload: candidate }, {} as chrome.runtime.MessageSender, sendResponse);

    expect(setBadgeText).not.toHaveBeenCalled();
    expect(mockStorage.set).not.toHaveBeenCalledWith('linkedInFeedBadgeCount', expect.anything());

    vi.unstubAllGlobals();
  });

  it('reports a backend failure through the response instead of throwing or queuing for retry', async () => {
    const authenticatedRequest = vi.fn(async () => {
      throw new Error('API error 500: Internal Server Error');
    });
    const router = buildRouter(authenticatedRequest);
    const sendResponse = vi.fn();

    await router.handle({ type: 'LINKEDIN_FEED_POST_DETECTED', payload: candidate }, {} as chrome.runtime.MessageSender, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false, code: 'LINKEDIN_FEED_INGEST_FAILED', error: 'API error 500: Internal Server Error' })
    );
  });

  it('does not enqueue into the offline queue on a network failure (deliberately not retried)', async () => {
    const authenticatedRequest = vi.fn(async () => {
      throw new Error('Failed to fetch');
    });
    const auth = { authenticatedRequest } as unknown as ConstructorParameters<typeof MessageRouter>[0];
    const enqueue = vi.fn();
    const queue = { enqueue } as unknown as ConstructorParameters<typeof MessageRouter>[1];
    const sync = {} as unknown as ConstructorParameters<typeof MessageRouter>[2];
    const notifications = {} as unknown as ConstructorParameters<typeof MessageRouter>[3];
    const router = new MessageRouter(auth, queue, sync, notifications);
    const sendResponse = vi.fn();

    await router.handle({ type: 'LINKEDIN_FEED_POST_DETECTED', payload: candidate }, {} as chrome.runtime.MessageSender, sendResponse);

    expect(enqueue).not.toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({ ok: false, code: 'LINKEDIN_FEED_INGEST_FAILED' }));
  });
});

// The backend's list endpoints wrap results in a named envelope
// (`{ vacancies, total }`, `{ applications, total }`) rather than returning
// a bare array — the popup's tab components (recent-vacancies.tsx,
// popup-app.tsx's SavedToday) assume `data` is directly an array and crash
// with "vacancies.map is not a function" (an uncaught render error with no
// error boundary unmounts the whole popup — the "Saved tab goes white" bug)
// when a request actually succeeds instead of failing into an empty array.
describe('MessageRouter vacancy/application list unwrapping', () => {
  it('GET_RECENT_VACANCIES returns the vacancies array, not the {vacancies, total} envelope', async () => {
    const authenticatedRequest = vi.fn(async () => ({ vacancies: [{ title: 'A' }], total: 1, limit: 20, offset: 0 }));
    const router = buildRouter(authenticatedRequest);
    const sendResponse = vi.fn();

    await router.handle({ type: 'GET_RECENT_VACANCIES', payload: { limit: 20 } }, {} as chrome.runtime.MessageSender, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({ ok: true, data: [{ title: 'A' }] });
  });

  it('GET_SAVED_TODAY returns the vacancies array, not the {vacancies, total} envelope', async () => {
    const authenticatedRequest = vi.fn(async () => ({ vacancies: [{ title: 'B' }], total: 1 }));
    const router = buildRouter(authenticatedRequest);
    const sendResponse = vi.fn();

    await router.handle({ type: 'GET_SAVED_TODAY', payload: {} }, {} as chrome.runtime.MessageSender, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({ ok: true, data: [{ title: 'B' }] });
  });

  it('GET_PENDING_APPLICATIONS returns the applications array, not the {applications, total} envelope', async () => {
    const authenticatedRequest = vi.fn(async () => ({ applications: [{ id: '1' }], total: 1 }));
    const router = buildRouter(authenticatedRequest);
    const sendResponse = vi.fn();

    await router.handle({ type: 'GET_PENDING_APPLICATIONS', payload: {} }, {} as chrome.runtime.MessageSender, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({ ok: true, data: [{ id: '1' }] });
  });

  it('GET_UPCOMING_INTERVIEWS returns the applications array, not the {applications, total} envelope', async () => {
    const authenticatedRequest = vi.fn(async () => ({ applications: [{ id: '2' }], total: 1 }));
    const router = buildRouter(authenticatedRequest);
    const sendResponse = vi.fn();

    await router.handle({ type: 'GET_UPCOMING_INTERVIEWS', payload: {} }, {} as chrome.runtime.MessageSender, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({ ok: true, data: [{ id: '2' }] });
  });

  it('QUICK_SEARCH returns the vacancies array, not the {vacancies, total} envelope', async () => {
    const authenticatedRequest = vi.fn(async () => ({ vacancies: [{ title: 'C' }], total: 1 }));
    const router = buildRouter(authenticatedRequest);
    const sendResponse = vi.fn();

    await router.handle({ type: 'QUICK_SEARCH', payload: { query: 'engineer' } }, {} as chrome.runtime.MessageSender, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({ ok: true, data: [{ title: 'C' }] });
  });
});
