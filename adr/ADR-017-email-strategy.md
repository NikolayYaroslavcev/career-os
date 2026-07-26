# ADR-017: Email Strategy

## Status

Accepted

## Date

2025-01-15

## Context

CareerOS needs email for:

- Welcome emails
- Password reset
- Weekly digests
- Important notifications

We need:

- Development email solution
- Production email solution
- Pluggable provider abstraction

## Decision

### Development: Mailpit

- Docker-based email testing
- Web UI for viewing emails
- No real email sending

### Production: SMTP Provider (Later)

- Abstract EmailProvider interface
- SMTP for direct sending
- Future: SendGrid, SES, etc.

## Consequences

### Positive

- No real emails in development
- Easy testing with Mailpit UI
- Provider abstraction ready for production
- Low cost for MVP

### Negative

- Mailpit is local only
- Production SMTP setup needed later
- Email deliverability concerns

### Mitigations

- Clear separation of dev/prod
- Provider interface allows easy swap
- Document SMTP setup for production

## Architecture

```
packages/notifications/src/
├── domain/
│   └── EmailProvider.ts        # Interface
├── infrastructure/
│   ├── MailpitProvider.ts      # Dev implementation
│   └── SMTPProvider.ts         # Production (future)
```

## Interface

```typescript
// packages/notifications/src/domain/EmailProvider.ts
export interface EmailProvider {
  readonly name: string;
  
  send(options: EmailOptions): Promise<EmailResult>;
  
  isAvailable(): Promise<boolean>;
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
```

## Mailpit Implementation

```typescript
// packages/notifications/src/infrastructure/MailpitProvider.ts
import nodemailer from 'nodemailer';

export class MailpitProvider implements EmailProvider {
  readonly name = 'mailpit';
  
  private transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '1025'),
    secure: false,
  });
  
  async send(options: EmailOptions): Promise<EmailResult> {
    try {
      const result = await this.transporter.sendMail({
        from: options.from || 'CareerOS <noreply@careeros.local>',
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      return { success: true, messageId: result.messageId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  async isAvailable(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }
}
```

## Docker Compose

```yaml
services:
  mailpit:
    image: axllent/mailpit
    ports:
      - "1025:1025"   # SMTP
      - "8025:8025"   # Web UI
    environment:
      - MP_SMTP_AUTH_ACCEPT_ANY=1
      - MP_SMTP_AUTH_ALLOW_INSECURE=1
```

## Development Usage

### View Emails

Open http://localhost:8025 to see all sent emails.

### Send Test Email

```typescript
const emailProvider = new MailpitProvider();
await emailProvider.send({
  to: 'test@example.com',
  subject: 'Welcome to CareerOS',
  html: '<h1>Welcome!</h1><p>Your account is ready.</p>',
});
```

## Email Templates

### Welcome Email

```typescript
const welcomeTemplate = (userName: string) => `
  <h1>Welcome to CareerOS, ${userName}!</h1>
  <p>Your AI career assistant is ready.</p>
  <p>Get started by:</p>
  <ol>
    <li>Uploading your resume</li>
    <li>Setting up job preferences</li>
    <li>Connecting Telegram</li>
  </ol>
`;
```

### Password Reset

```typescript
const passwordResetTemplate = (resetUrl: string) => `
  <h1>Password Reset</h1>
  <p>Click the link below to reset your password:</p>
  <a href="${resetUrl}">Reset Password</a>
  <p>This link expires in 1 hour.</p>
`;
```

## Configuration

```bash
# .env (Development)
SMTP_HOST=localhost
SMTP_PORT=1025
EMAIL_FROM=CareerOS <noreply@careeros.local>

# .env (Production - future)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=CareerOS <noreply@careeros.com>
```

## Production Migration

When ready for production:

1. Set up SMTP provider (Gmail, SendGrid, SES)
2. Update environment variables
3. Swap EmailProvider implementation
4. Test email delivery
5. Monitor deliverability

## References

- [Mailpit](https://github.com/axllent/mailpit)
- [Nodemailer](https://nodemailer.com/)
- [Email Deliverability](https://www.mailchimp.com/resources/guide-to-email-deliverability/)
