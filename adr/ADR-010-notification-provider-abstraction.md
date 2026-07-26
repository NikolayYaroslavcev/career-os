# ADR-010: Notification Provider Abstraction

## Status

Accepted

## Date

2025-01-15

## Context

CareerOS needs to notify users about:

- New job matches
- Follow-up reminders
- Application status changes
- Weekly digests
- Interview reminders

We need to support multiple notification channels:

- Telegram (primary)
- Email
- Discord
- Slack

The system must:

- Allow users to choose notification channels
- Support multiple channels per user
- Handle provider failures gracefully
- Support channel-specific formatting

## Decision

We will create a NotificationProvider interface with channel-specific implementations.

## Consequences

### Positive

- Business logic independent of notification channel
- Easy to add new channels
- User-configurable preferences
- Graceful degradation on failure
- Channel-specific formatting

### Negative

- Need to maintain multiple implementations
- Different channel capabilities
- Rate limiting per channel

### Mitigations

- Standardize core notification interface
- Document channel differences
- Implement channel-specific adapters

## Interface Design

```typescript
// packages/notifications/src/domain/NotificationProvider.ts

export interface NotificationProvider {
  readonly channel: NotificationChannel;
  
  send(
    userId: string,
    notification: Notification,
  ): Promise<SendResult>;
  
  isAvailable(userId: string): Promise<boolean>;
  
  formatNotification(
    notification: Notification,
    format: NotificationFormat,
  ): Promise<FormattedNotification>;
}

export interface Notification {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority: NotificationPriority;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export enum NotificationChannel {
  TELEGRAM = 'telegram',
  EMAIL = 'email',
  DISCORD = 'discord',
  SLACK = 'slack',
}

export enum NotificationType {
  JOB_MATCH = 'job_match',
  FOLLOW_UP = 'follow_up',
  STATUS_CHANGE = 'status_change',
  WEEKLY_DIGEST = 'weekly_digest',
  INTERVIEW_REMINDER = 'interview_reminder',
}
```

## Channel Implementations

### Telegram

```typescript
// packages/notifications/src/infrastructure/TelegramProvider.ts
export class TelegramProvider implements NotificationProvider {
  readonly channel = NotificationChannel.TELEGRAM;
  
  async send(userId: string, notification: Notification): Promise<SendResult> {
    const telegramId = await this.getTelegramId(userId);
    const message = this.formatMessage(notification);
    return this.bot.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
  }
}
```

### Email

```typescript
// packages/notifications/src/infrastructure/EmailProvider.ts
export class EmailProvider implements NotificationProvider {
  readonly channel = NotificationChannel.EMAIL;
  
  async send(userId: string, notification: Notification): Promise<SendResult> {
    const email = await this.getEmail(userId);
    const html = this.renderTemplate(notification);
    return this.transporter.sendMail({ to: email, subject: notification.title, html });
  }
}
```

## User Preferences

```typescript
// packages/notifications/src/domain/NotificationPreferences.ts
export interface NotificationPreferences {
  userId: string;
  channels: ChannelPreferences;
  quietHours: QuietHours;
  frequency: FrequencyPreferences;
}

export interface ChannelPreferences {
  telegram: boolean;
  email: boolean;
  discord: boolean;
  slack: boolean;
}

export interface QuietHours {
  enabled: boolean;
  start: string; // "22:00"
  end: string;   // "08:00"
  timezone: string;
}

export interface FrequencyPreferences {
  jobMatches: 'immediate' | 'daily' | 'weekly';
  followUps: 'immediate' | 'daily';
  digest: 'daily' | 'weekly';
}
```

## Notification Router

```typescript
// packages/notifications/src/NotificationRouter.ts
export class NotificationRouter {
  constructor(
    private readonly providers: Map<NotificationChannel, NotificationProvider>,
    private readonly preferencesRepo: NotificationPreferencesRepository,
  ) {}

  async route(notification: Notification): Promise<void> {
    const preferences = await this.preferencesRepo.findByUserId(notification.userId);
    
    for (const [channel, enabled] of Object.entries(preferences.channels)) {
      if (enabled && this.providers.has(channel as NotificationChannel)) {
        const provider = this.providers.get(channel as NotificationChannel)!;
        if (await provider.isAvailable(notification.userId)) {
          await provider.send(notification.userId, notification);
        }
      }
    }
  }
}
```

## Configuration

```bash
# .env
NOTIFICATION_CHANNELS=telegram,email
TELEGRAM_BOT_TOKEN=...
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
```

## Alternatives Considered

### Nodemailer Only

Email-only notifications.

**Rejected because:**
- No Telegram support
- Less immediate than Telegram
- Users prefer Telegram

### Push Notifications

Browser push notifications.

**Rejected because:**
- Requires browser open
- Less reliable
- More complex setup

### OneSignal

Third-party push service.

**Rejected because:**
- Vendor lock-in
- Less control
- Additional cost

## References

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Nodemailer](https://nodemailer.com/)
- [Notification Best Practices](https://www.nngroup.com/articles/notifications/)
