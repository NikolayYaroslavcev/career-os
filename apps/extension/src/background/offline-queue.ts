import type { QueueItem } from '@careeros/extension-shared';
import type { StorageBridge } from './storage-bridge.js';
import type { AuthManager } from './auth-manager.js';

const STORAGE_KEY = 'offlineQueue';
const MAX_ITEMS = 50;
const MAX_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 30_000;

export class OfflineQueue {
  constructor(
    private storage: StorageBridge,
    private auth: AuthManager,
  ) {}

  async enqueue(type: string, payload: unknown): Promise<void> {
    const items = await this.getItems();

    if (items.length >= MAX_ITEMS) {
      items.shift();
    }

    items.push({
      id: crypto.randomUUID(),
      type,
      payload,
      createdAt: Date.now(),
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      nextRetryAt: Date.now(),
      status: 'pending',
    });

    await this.storage.set(STORAGE_KEY, items);
  }

  async processPending(): Promise<number> {
    const items = await this.getItems();
    const now = Date.now();
    let processed = 0;

    const pending = items.filter(
      item => item.status === 'pending' && item.nextRetryAt <= now
    );

    for (const item of pending) {
      try {
        item.status = 'processing';
        await this.storage.set(STORAGE_KEY, items);

        await this.processItem(item);

        const idx = items.indexOf(item);
        if (idx !== -1) items.splice(idx, 1);
        processed++;
      } catch {
        item.attempts++;
        if (item.attempts >= item.maxAttempts) {
          item.status = 'failed';
        } else {
          item.nextRetryAt = now + BACKOFF_BASE_MS * Math.pow(2, item.attempts);
          item.status = 'pending';
        }
      }
    }

    await this.storage.set(STORAGE_KEY, items);
    return processed;
  }

  async getCount(): Promise<number> {
    const items = await this.getItems();
    return items.filter(i => i.status === 'pending').length;
  }

  async clearFailed(): Promise<void> {
    const items = await this.getItems();
    const remaining = items.filter(i => i.status !== 'failed');
    await this.storage.set(STORAGE_KEY, remaining);
  }

  private async getItems(): Promise<QueueItem[]> {
    return (await this.storage.get<QueueItem[]>(STORAGE_KEY)) ?? [];
  }

  private async processItem(item: QueueItem): Promise<void> {
    switch (item.type) {
      case 'SAVE_VACANCY':
        await this.auth.authenticatedRequest('/api/v1/vacancies', {
          method: 'POST',
          body: JSON.stringify(item.payload),
        });
        break;

      case 'APPLY_DETECTED': {
        const applyPayload = item.payload as { provider: string; url: string; timestamp: string; method: string };
        const vacancyResult = await this.auth.authenticatedRequest<{
          exists: boolean;
          vacancyId?: string;
          applicationId?: string;
          applicationStatus?: string;
        }>('/api/v1/vacancies/by-url', {
          method: 'POST',
          body: JSON.stringify({ url: applyPayload.url }),
        });

        if (vacancyResult.exists && vacancyResult.vacancyId) {
          if (vacancyResult.applicationId && vacancyResult.applicationStatus !== 'submitted') {
            await this.auth.authenticatedRequest(`/api/v1/applications/${vacancyResult.applicationId}/status`, {
              method: 'PATCH',
              body: JSON.stringify({ status: 'submitted' }),
            });
          }
        }
        break;
      }

      case 'ANALYZE_VACANCY':
      case 'TAILOR_RESUME':
      case 'COVER_LETTER':
      case 'INTERVIEW_PREP': {
        const endpoint = item.type === 'ANALYZE_VACANCY' ? 'analyze-vacancy'
          : item.type === 'TAILOR_RESUME' ? 'tailor-resume'
          : item.type === 'COVER_LETTER' ? 'cover-letter'
          : 'interview-prep';
        await this.auth.authenticatedRequest(`/api/v1/ai/${endpoint}`, {
          method: 'POST',
          body: JSON.stringify(item.payload),
        });
        break;
      }

      default:
        throw new Error(`Unknown queue item type: ${item.type}`);
    }
  }
}
