import type { AuthManager } from './auth-manager.js';
import type { OfflineQueue } from './offline-queue.js';
import type { NotificationManager } from './notification-manager.js';

export class SyncManager {
  private syncInterval = 30 * 60 * 1000; // 30 minutes
  private lastSync = 0;

  constructor(
    private auth: AuthManager,
    private queue: OfflineQueue,
    private notifications: NotificationManager,
  ) {}

  async init(): Promise<void> {
    chrome.alarms.create('sync', { periodInMinutes: 30 });
    chrome.alarms.onAlarm.addListener(async (alarm) => {
      if (alarm.name === 'sync') {
        await this.pullUpdates();
        await this.queue.processPending();
      }
    });
  }

  async pullUpdates(): Promise<void> {
    if (!this.auth.isAuthenticated()) return;
    
    const now = Date.now();
    if (now - this.lastSync < this.syncInterval) return;

    try {
      await this.auth.authenticatedRequest('/api/v1/sync/status');
      this.lastSync = now;
    } catch {
      // Sync failure is non-critical; will retry on next alarm
    }
  }

  async forceSyncNow(): Promise<void> {
    this.lastSync = 0;
    await this.pullUpdates();
    await this.queue.processPending();
  }

  async getRecentNotifications(limit: number = 10): Promise<unknown[]> {
    if (!this.auth.isAuthenticated()) return [];

    try {
      const data = await this.auth.authenticatedRequest<{ notifications: unknown[] }>(
        `/api/v1/dashboard/notifications?limit=${limit}`
      );
      return data.notifications ?? [];
    } catch {
      return [];
    }
  }
}
