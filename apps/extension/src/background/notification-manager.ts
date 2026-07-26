import type { ContentVacancy } from '@careeros/extension-shared';

export class NotificationManager {
  private permissionGranted = false;

  async init(): Promise<void> {
    if (chrome.notifications) {
      this.permissionGranted = await this.requestPermission();
    }
  }

  async requestPermission(): Promise<boolean> {
    if (!chrome.notifications) return false;

    const level = await new Promise<string>(resolve => {
      chrome.notifications.getPermissionLevel(resolve);
    });
    this.permissionGranted = level === 'granted';
    return this.permissionGranted;
  }

  async notifyWatchedCompany(vacancy: ContentVacancy): Promise<void> {
    if (!this.permissionGranted) return;

    chrome.notifications.create(`watched-${vacancy.externalId}`, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: `New vacancy at ${vacancy.company}`,
      message: `${vacancy.title} - ${vacancy.location}`,
      priority: 2,
    });
  }

  async notifyAiCompleted(jobId: string, feature: string): Promise<void> {
    if (!this.permissionGranted) return;

    const title = feature.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    
    chrome.notifications.create(`ai-${jobId}`, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: `${title} Complete`,
      message: 'Your AI task is ready. Click to view results.',
      priority: 1,
    });
  }

  async notifyInterviewReminder(company: string, date: string): Promise<void> {
    if (!this.permissionGranted) return;

    chrome.notifications.create(`interview-${date}`, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Interview Reminder',
      message: `Interview with ${company} soon`,
      priority: 2,
    });
  }

  async notifyApplicationSaved(vacancy: ContentVacancy): Promise<void> {
    if (!this.permissionGranted) return;

    chrome.notifications.create(`saved-${vacancy.externalId}`, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Vacancy Saved',
      message: `${vacancy.title} at ${vacancy.company}`,
      priority: 0,
    });
  }
}
