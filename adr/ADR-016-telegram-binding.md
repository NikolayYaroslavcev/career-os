# ADR-016: Telegram Binding Strategy

## Status

Accepted

## Date

2025-01-15

## Context

CareerOS needs to link user accounts to Telegram for notifications and bot interaction. We need a secure binding strategy that:

- Doesn't expose Telegram user data
- Allows account recovery
- Works with existing authentication
- Is simple for users

## Decision

### Web Account First, Telegram Linked Later

1. User creates account via web dashboard (email + password)
2. User links Telegram through one-time code flow
3. Telegram account linked to existing user account

## Consequences

### Positive

- User has web account as primary identity
- Telegram is additional channel, not primary
- Simple linking flow
- User controls binding

### Negative

- Requires web dashboard for initial setup
- Two-factor of identity (web + Telegram)
- Code expiry management

### Mitigations

- Clear onboarding flow
- Code is simple (6-digit, 5-minute expiry)
- Resend capability

## Binding Flow

```
1. User logs into web dashboard
2. User navigates to Settings > Telegram
3. User clicks "Link Telegram"
4. System generates 6-digit code
5. User opens CareerOS Telegram bot
6. User sends /link <code>
7. Bot verifies code
8. Bot confirms binding
9. Web dashboard updates status
```

## Implementation

### Code Generation

```typescript
interface TelegramBindingCode {
  id: string;
  userId: string;
  code: string;        // 6-digit
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

// Generate code
async function generateBindingCode(userId: string): Promise<string> {
  const code = crypto.randomInt(100000, 999999).toString();
  await bindingCodeRepo.create({
    userId,
    code: await argon2.hash(code),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
  });
  return code;
}
```

### Bot Command

```typescript
// /link <code>
bot.command('link', async (ctx) => {
  const code = ctx.message.text.split(' ')[1];
  if (!code) return ctx.reply('Usage: /link <6-digit-code>');
  
  const binding = await verifyBindingCode(code, ctx.from.id);
  if (!binding) return ctx.reply('Invalid or expired code');
  
  await linkTelegramAccount(binding.userId, ctx.from.id);
  return ctx.reply('Account linked! You will now receive notifications here.');
});
```

### Database Schema

```prisma
model User {
  id            String    @id @default(uuid())
  telegramId?   String    @unique
  // ... other fields
}

model TelegramBindingCode {
  id        String   @id @default(uuid())
  userId    String
  code      String
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
}
```

## Configuration

```bash
# .env
TELEGRAM_BOT_TOKEN=...
TELEGRAM_BINDING_CODE_EXPIRY=300000  # 5 minutes in ms
```

## Alternatives Considered

### Telegram-first Account

User creates account via Telegram bot first.

**Rejected because:**
- Limited input on mobile
- Email needed for password reset
- Web dashboard is primary interface

### OAuth via Telegram

Use Telegram OAuth for login.

**Rejected because:**
- Less common than Google/GitHub OAuth
- Limited profile data
- Binding is simpler

### QR Code Binding

Show QR code in web, scan with Telegram.

**Rejected because:**
- More complex implementation
- Requires camera access
- Code is simpler

## References

- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Telegram Login Widget](https://core.telegram.org/widgets/login)
