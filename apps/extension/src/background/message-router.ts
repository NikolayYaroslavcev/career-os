import type { BackgroundMessage, BackgroundResponse, ContentVacancy, LinkedInFeedPostCandidate } from '@careeros/extension-shared';
import type { AuthManager } from './auth-manager.js';
import type { OfflineQueue } from './offline-queue.js';
import type { SyncManager } from './sync-manager.js';
import type { NotificationManager } from './notification-manager.js';
import { storage } from '../shared/storage/chrome-storage.js';

interface AiActionResult {
  jobId: string;
  status: 'cached' | 'queued' | 'completed' | 'failed';
  cached: boolean;
  result?: unknown;
}

export class MessageRouter {
  constructor(
    private auth: AuthManager,
    private queue: OfflineQueue,
    private sync: SyncManager,
    private notifications: NotificationManager,
  ) {}

  async handle(
    message: BackgroundMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: BackgroundResponse) => void,
  ): Promise<void> {
    try {
      const response = await this.route(message, sender);
      sendResponse(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('Failed to fetch')) {
        await this.queue.enqueue(message.type, message.payload);
        sendResponse({ ok: true, data: { queued: true } });
      } else {
        sendResponse({ ok: false, error: errorMessage });
      }
    }
  }

  private async route(
    message: BackgroundMessage,
    _sender: chrome.runtime.MessageSender,
  ): Promise<BackgroundResponse> {
    switch (message.type) {
      case 'CHECK_AUTH':
        return { ok: true, data: { authenticated: this.auth.isAuthenticated(), user: this.auth.getUser() } };

      case 'LOGIN': {
        const loginPayload = message.payload as { email: string; password: string };
        const user = await this.auth.login(loginPayload.email, loginPayload.password);
        return { ok: true, data: user };
      }

      case 'LOGOUT':
        await this.auth.logout();
        return { ok: true, data: null };

      case 'SAVE_VACANCY':
        return this.handleSaveVacancy(message.payload as ContentVacancy);

      case 'GET_VACANCY_STATUS':
        return this.handleGetVacancyStatus((message.payload as { url: string }).url);

      case 'ANALYZE_VACANCY':
        return this.handleAiAction('analyze-vacancy', message.payload as ContentVacancy);

      case 'TAILOR_RESUME':
        return this.handleAiAction('tailor-resume', message.payload as ContentVacancy);

      case 'COVER_LETTER':
        return this.handleAiAction('cover-letter', message.payload as ContentVacancy);

      case 'INTERVIEW_PREP':
        return this.handleAiAction('interview-prep', message.payload as ContentVacancy);

      case 'APPLY_DETECTED':
        return this.handleApplyDetected(message.payload as { provider: string; url: string; timestamp: string; method: string });

      case 'LINKEDIN_FEED_POST_DETECTED':
        return this.handleLinkedInFeedPost(message.payload as LinkedInFeedPostCandidate);

      case 'GET_RECENT_VACANCIES':
        return this.handleGetRecentVacancies((message.payload as { limit: number }).limit);

      case 'GET_SAVED_TODAY':
        return this.handleGetSavedToday();

      case 'GET_PENDING_APPLICATIONS':
        return this.handleGetPendingApplications();

      case 'GET_UPCOMING_INTERVIEWS':
        return this.handleGetUpcomingInterviews();

      case 'GET_NOTIFICATIONS':
        return this.handleGetNotifications((message.payload as { limit: number }).limit);

      case 'QUICK_SEARCH':
        return this.handleQuickSearch((message.payload as { query: string }).query);

      case 'GET_SETTINGS':
        return this.handleGetSettings();

      case 'SAVE_SETTINGS':
        return this.handleSaveSettings(message.payload as Record<string, unknown>);

      default:
        return { ok: false, error: `Unknown message type: ${(message as { type: string }).type}` };
    }
  }

  private async handleSaveVacancy(vacancy: ContentVacancy): Promise<BackgroundResponse> {
    const result = await this.auth.authenticatedRequest<{ id: string }>('/api/v1/vacancies', {
      method: 'POST',
      body: JSON.stringify(vacancy),
    });

    await this.notifications.notifyApplicationSaved(vacancy);

    return { ok: true, data: result };
  }

  private async handleGetVacancyStatus(url: string): Promise<BackgroundResponse> {
    try {
      const result = await this.auth.authenticatedRequest<{
        exists: boolean;
        vacancyId?: string;
        applicationStatus?: string;
      }>('/api/v1/vacancies/by-url', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });

      return { ok: true, data: result };
    } catch {
      return { ok: true, data: { exists: false } };
    }
  }

  private async resolveVacancyId(vacancy: ContentVacancy): Promise<string> {
    const status = await this.auth.authenticatedRequest<{ exists: boolean; vacancyId?: string }>(
      '/api/v1/vacancies/by-url',
      { method: 'POST', body: JSON.stringify({ url: vacancy.url }) }
    );
    if (status.exists && status.vacancyId) return status.vacancyId;

    const saved = await this.auth.authenticatedRequest<{ id: string }>('/api/v1/vacancies', {
      method: 'POST',
      body: JSON.stringify(vacancy),
    });
    return saved.id;
  }

  private async resolveDefaultResumeId(): Promise<string | null> {
    const cached = await storage.get<string>('defaultResumeId');
    if (cached) return cached;

    const data = await this.auth.authenticatedRequest<{ resumes: Array<{ id: string }> }>('/api/v1/resumes');
    const id = data.resumes[0]?.id ?? null;
    if (id) await storage.set('defaultResumeId', id);
    return id;
  }

  private async resolveActiveSearchProfileId(): Promise<string | null> {
    const cached = await storage.get<string>('activeSearchProfileId');
    if (cached) return cached;

    const data = await this.auth.authenticatedRequest<{ searchProfiles: Array<{ id: string; isActive: boolean }> }>(
      '/api/v1/search-profiles'
    );
    const id = data.searchProfiles.find((p) => p.isActive)?.id ?? null;
    if (id) await storage.set('activeSearchProfileId', id);
    return id;
  }

  private async handleAiAction(
    endpoint: 'analyze-vacancy' | 'tailor-resume' | 'cover-letter' | 'interview-prep',
    vacancy: ContentVacancy
  ): Promise<BackgroundResponse> {
    const vacancyId = await this.resolveVacancyId(vacancy);

    let body: Record<string, unknown>;
    if (endpoint === 'analyze-vacancy') {
      const searchProfileId = await this.resolveActiveSearchProfileId();
      if (!searchProfileId) {
        return { ok: false, error: 'Create an active search profile in CareerOS before running AI analysis', code: 'NO_ACTIVE_SEARCH_PROFILE' };
      }
      body = { vacancyId, searchProfileId };
    } else if (endpoint === 'tailor-resume' || endpoint === 'cover-letter') {
      const resumeId = await this.resolveDefaultResumeId();
      if (!resumeId) {
        return { ok: false, error: 'Upload a resume in CareerOS before running this action', code: 'NO_RESUME_FOUND' };
      }
      body = { vacancyId, resumeId };
    } else {
      body = { vacancyId, interviewType: 'TECHNICAL' };
    }

    let result = await this.auth.authenticatedRequest<AiActionResult>(`/api/v1/ai/${endpoint}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    // Resume tailoring runs asynchronously (ADR-031) — poll internally so the
    // content script's request/response contract (panel-injector.ts) stays
    // exactly as it was when this endpoint responded synchronously.
    if (endpoint === 'tailor-resume' && result.status !== 'completed' && result.status !== 'failed' && result.status !== 'cached') {
      result = await this.pollTailoringStatus(result.jobId);
    }

    return { ok: true, data: { ...result, vacancyId } };
  }

  private async pollTailoringStatus(jobId: string): Promise<AiActionResult> {
    const POLL_INTERVAL_MS = 4000;
    const MAX_POLL_ATTEMPTS = 30; // ~2 minutes backstop

    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      try {
        const status = await this.auth.authenticatedRequest<AiActionResult>(
          `/api/v1/ai/tailor-resume/${encodeURIComponent(jobId)}/status`,
        );
        if (status.status === 'completed' || status.status === 'failed' || status.status === 'cached') {
          return status;
        }
      } catch {
        // Transient poll failure — try again next tick.
      }
    }

    return { jobId, status: 'failed', cached: false };
  }

  private async handleApplyDetected(event: { provider: string; url: string; timestamp: string; method: string }): Promise<BackgroundResponse> {
    try {
      const vacancyResult = await this.auth.authenticatedRequest<{
        exists: boolean;
        vacancyId?: string;
        applicationId?: string;
        applicationStatus?: string;
      }>('/api/v1/vacancies/by-url', {
        method: 'POST',
        body: JSON.stringify({ url: event.url }),
      });

      if (!vacancyResult.exists || !vacancyResult.vacancyId) {
        return { ok: true, data: { action: 'vacancy_not_found' } };
      }

      if (vacancyResult.applicationId && vacancyResult.applicationStatus !== 'submitted') {
        await this.auth.authenticatedRequest(`/api/v1/applications/${vacancyResult.applicationId}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'submitted' }),
        });
        return { ok: true, data: { action: 'application_submitted', applicationId: vacancyResult.applicationId } };
      }

      if (vacancyResult.applicationId) {
        return { ok: true, data: { action: 'already_submitted', applicationId: vacancyResult.applicationId } };
      }

      return { ok: true, data: { action: 'no_application', vacancyId: vacancyResult.vacancyId } };
    } catch {
      await this.queue.enqueue('APPLY_DETECTED', event);
      return { ok: true, data: { queued: true } };
    }
  }

  private async handleLinkedInFeedPost(candidate: LinkedInFeedPostCandidate): Promise<BackgroundResponse> {
    try {
      const result = await this.auth.authenticatedRequest<{ ok: boolean; messageId: string; created: boolean }>(
        '/api/v1/social-messages/ingest',
        {
          method: 'POST',
          body: JSON.stringify({
            platform: 'LINKEDIN',
            externalMessageId: candidate.postId,
            authorUsername: candidate.authorName,
            publishedAt: candidate.publishedAt,
            rawText: candidate.rawText,
            links: candidate.links,
          }),
        }
      );
      if (result.created) {
        await this.bumpLinkedInFeedBadge();
      }
      return { ok: true, data: result };
    } catch (error) {
      // Deliberately not routed through OfflineQueue (unlike SAVE_VACANCY/APPLY_DETECTED
      // above): this is Phase 1 transport-proof territory — backend-side dedup on
      // (platform, sourceId, externalMessageId) means a post missed here is simply not
      // retried this session, rather than adding a second uncontrolled retry path.
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: message, code: 'LINKEDIN_FEED_INGEST_FAILED' };
    }
  }

  /**
   * Live signal while scrolling the feed itself (not just the popup): the
   * toolbar badge counts new (non-duplicate) LinkedIn posts ingested today,
   * so there's visible feedback without opening the popup mid-scroll. Keyed
   * by date in storage rather than an in-memory counter, since MV3 service
   * workers restart far more often than once a day and would otherwise reset
   * to 0 on every wake.
   */
  private async bumpLinkedInFeedBadge(): Promise<void> {
    const todayKey = new Date().toISOString().slice(0, 10);
    const stored = await storage.get<{ date: string; count: number }>('linkedInFeedBadgeCount');
    const count = (stored?.date === todayKey ? stored.count : 0) + 1;
    await storage.set('linkedInFeedBadgeCount', { date: todayKey, count });

    if (typeof chrome !== 'undefined' && chrome.action?.setBadgeText) {
      chrome.action.setBadgeText({ text: String(count) });
      chrome.action.setBadgeBackgroundColor?.({ color: '#0a66c2' });
    }
  }

  private async handleGetRecentVacancies(limit: number): Promise<BackgroundResponse> {
    const response = await this.auth.authenticatedRequest<{ vacancies: unknown[] }>(
      `/api/v1/vacancies?limit=${limit}&sortBy=publishedAt&sortOrder=desc`
    );
    return { ok: true, data: response.vacancies };
  }

  private async handleGetSavedToday(): Promise<BackgroundResponse> {
    const today = new Date().toISOString().split('T')[0];
    const response = await this.auth.authenticatedRequest<{ vacancies: unknown[] }>(
      `/api/v1/vacancies?savedAfter=${today}`
    );
    return { ok: true, data: response.vacancies };
  }

  private async handleGetPendingApplications(): Promise<BackgroundResponse> {
    const response = await this.auth.authenticatedRequest<{ applications: unknown[] }>(
      '/api/v1/applications?status=applied,status=waiting'
    );
    return { ok: true, data: response.applications };
  }

  private async handleGetUpcomingInterviews(): Promise<BackgroundResponse> {
    const response = await this.auth.authenticatedRequest<{ applications: unknown[] }>(
      '/api/v1/applications?hasInterview=true'
    );
    return { ok: true, data: response.applications };
  }

  private async handleGetNotifications(limit: number): Promise<BackgroundResponse> {
    const data = await this.sync.getRecentNotifications(limit);
    return { ok: true, data };
  }

  private async handleQuickSearch(query: string): Promise<BackgroundResponse> {
    const response = await this.auth.authenticatedRequest<{ vacancies: unknown[] }>(
      `/api/v1/vacancies?query=${encodeURIComponent(query)}&limit=10`
    );
    return { ok: true, data: response.vacancies };
  }

  private async handleGetSettings(): Promise<BackgroundResponse> {
    const settings = await storage.get('settings');
    return { ok: true, data: settings };
  }

  private async handleSaveSettings(settings: Record<string, unknown>): Promise<BackgroundResponse> {
    await storage.set('settings', settings);
    return { ok: true, data: null };
  }
}
