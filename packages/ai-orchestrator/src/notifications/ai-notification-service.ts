export interface AINotification {
  readonly id: string;
  readonly userId: string;
  readonly type: 'job_completed' | 'job_failed' | 'provider_unavailable' | 'daily_limit_reached' | 'monthly_budget_reached';
  readonly title: string;
  readonly body: string;
  readonly feature?: string;
  readonly jobId?: string;
  readonly createdAt: Date;
}

export interface NotifyParams {
  readonly userId: string;
  readonly type: AINotification['type'];
  readonly title: string;
  readonly body: string;
  readonly feature?: string;
  readonly jobId?: string;
}

export class AINotificationService {
  private readonly notifications: AINotification[] = [];

  async notify(params: NotifyParams): Promise<AINotification> {
    const notification: AINotification = {
      id: crypto.randomUUID(),
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      feature: params.feature,
      jobId: params.jobId,
      createdAt: new Date(),
    };

    this.notifications.push(notification);

    // In production, this would:
    // 1. Save to database
    // 2. Send via Telegram if connected
    // 3. Send via email if configured
    // 4. Send via websocket for real-time UI updates

    return notification;
  }

  async notifyJobCompleted(userId: string, feature: string, jobId: string): Promise<AINotification> {
    return this.notify({
      userId,
      type: 'job_completed',
      title: 'AI Task Completed',
      body: `Your ${feature.replace(/_/g, ' ')} request has been completed.`,
      feature,
      jobId,
    });
  }

  async notifyJobFailed(userId: string, feature: string, jobId: string, error: string): Promise<AINotification> {
    return this.notify({
      userId,
      type: 'job_failed',
      title: 'AI Task Failed',
      body: `Your ${feature.replace(/_/g, ' ')} request failed: ${error}`,
      feature,
      jobId,
    });
  }

  async notifyDailyLimitReached(userId: string): Promise<AINotification> {
    return this.notify({
      userId,
      type: 'daily_limit_reached',
      title: 'Daily Token Limit Reached',
      body: 'You have reached your daily AI token limit. AI features are temporarily disabled until tomorrow.',
    });
  }

  async notifyMonthlyBudgetReached(userId: string): Promise<AINotification> {
    return this.notify({
      userId,
      type: 'monthly_budget_reached',
      title: 'Monthly Budget Reached',
      body: 'You have reached your monthly AI budget limit. AI features are temporarily disabled until next month.',
    });
  }

  async getNotifications(userId: string): Promise<AINotification[]> {
    return this.notifications.filter(n => n.userId === userId);
  }
}
