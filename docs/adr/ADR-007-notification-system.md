# ADR-007: Notification System

## Status

Accepted

## Date

2026-01-15

## Context

CareerOS must notify users about:
- New matching jobs
- Follow-up reminders
- Application status updates
- Weekly digests

Users prefer different channels:
- Telegram (primary for MVP)
- Email (secondary)
- Discord (future)
- Slack (future)

We need a unified notification system that:
- Supports multiple channels
- Allows user preferences
- Handles failures gracefully
- Tracks delivery

## Decision

Use a provider-based notification system with channel abstraction.

## Interface

```typescript
// packages/notifications/src/interfaces/notification-provider.ts
interface NotificationProvider {
  readonly channel: NotificationChannel;

  send(notification: NotificationMessage): Promise<NotificationResult>;
  healthCheck(): Promise<boolean>;
}

interface NotificationMessage {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
```

## Channel Implementations

```typescript
// packages/notifications/src/telegram/telegram-provider.ts
class TelegramNotificationProvider implements NotificationProvider {
  readonly channel = 'TELEGRAM';

  async send(message: NotificationMessage): Promise<NotificationResult> {
    const chatId = await this.getChatId(message.userId);
    await this.bot.sendMessage(chatId, message.body, {
      parse_mode: 'Markdown',
    });
    return { success: true };
  }
}

// packages/notifications/src/email/email-provider.ts
class EmailNotificationProvider implements NotificationProvider {
  readonly channel = 'EMAIL';

  async send(message: NotificationMessage): Promise<NotificationResult> {
    await this.transporter.sendMail({
      to: await this.getEmail(message.userId),
      subject: message.title,
      html: message.body,
    });
    return { success: true };
  }
}
```

## Notification Router

```typescript
// packages/notifications/src/router.ts
class NotificationRouter {
  private providers = new Map<NotificationChannel, NotificationProvider>();

  async send(
    userId: string,
    type: NotificationType,
    title: string,
    body: string
  ): Promise<void> {
    const preferences = await this.getUserPreferences(userId);
    const channels = this.getChannelsForType(type, preferences);

    for (const channel of channels) {
      const provider = this.providers.get(channel);
      if (!provider) continue;

      const result = await provider.send({ userId, title, body });
      await this.logNotification(userId, channel, type, result);
    }
  }
}
```

## User Preferences

```typescript
interface NotificationPreferences {
  channels: {
    telegram: boolean;
    email: boolean;
  };
  types: {
    newJob: NotificationChannel[];
    followUp: NotificationChannel[];
    applicationUpdate: NotificationChannel[];
    digest: NotificationChannel[];
  };
  quietHours: {
    start: string; // "22:00"
    end: string;   // "08:00"
    timezone: string;
  };
}
```

## Consequences

### Positive
- Add new channel = implement interface
- User controls notification channels
- Failed delivery doesn't block other channels
- Notification history for debugging

### Negative
- Multiple channels to maintain
- Rate limits per channel
- Message formatting differs per channel

### Mitigations
- Markdown as universal format (converted per channel)
- Rate limit awareness in providers
- Channel-specific formatting helpers

## Notification Types

| Type | Default Channel | Priority |
|------|----------------|----------|
| NEW_JOB | Telegram | Normal |
| FOLLOW_UP | Telegram | High |
| APPLICATION_UPDATE | Telegram + Email | Normal |
| DIGEST | Email | Low |

## Alternatives Considered

1. **OneSignal**: Rejected. Vendor lock-in, overkill.
2. **Novu**: Considered. Good but adds dependency.
3. **Custom simple**: Chose this. Full control, simpler.
