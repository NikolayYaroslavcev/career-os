# ADR-011: Authentication Strategy

## Status

Accepted

## Date

2025-01-15

## Context

CareerOS requires authentication for:

- API access (backend)
- Dashboard access (Next.js)
- Telegram bot binding
- Data isolation per user

We need a strategy that:

- Is secure and industry-standard
- Supports refresh tokens for UX
- Allows future OAuth providers
- Works with JWT

## Decision

### MVP Authentication

- JWT access tokens (15-minute expiry)
- Refresh tokens (7-day expiry, stored in database)
- Argon2 for password hashing

### Future OAuth Providers

- Google OAuth
- GitHub OAuth
- Telegram OAuth (via bot)

## Consequences

### Positive

- Stateless access tokens (fast validation)
- Refresh tokens allow long sessions
- Argon2 is memory-hard (resists GPU attacks)
- OAuth can be added without changing core auth

### Negative

- Refresh token storage required
- Token rotation complexity
- Revocation requires database check

### Mitigations

- Store refresh tokens in Redis for fast lookup
- Implement token rotation on refresh
- Use short access token lifetime

## Implementation

### Token Structure

```typescript
// Access Token (JWT)
interface AccessToken {
  sub: string;      // user ID
  email: string;
  iat: number;
  exp: number;
}

// Refresh Token (stored)
interface RefreshToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}
```

### Password Hashing

```typescript
import argon2 from 'argon2';

// Hash password
const hash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
});

// Verify password
const valid = await argon2.verify(hash, password);
```

### Auth Flow

```
1. User sends email + password
2. Server validates credentials
3. Server generates access token (15min)
4. Server generates refresh token (7 days)
5. Server stores refresh token
6. Client uses access token for requests
7. When expired, client sends refresh token
8. Server validates refresh token
9. Server issues new access + refresh tokens
10. Old refresh token invalidated
```

## Configuration

```bash
# .env
JWT_SECRET=your-secret-key-min-32-chars
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
ARGON2_MEMORY_COST=65536
ARGON2_TIME_COST=3
ARGON2_PARALLELISM=4
```

## Alternatives Considered

### Session-based Authentication

Server-side sessions with cookies.

**Rejected because:**
- Requires session store
- Less suitable for API
- Harder to scale

### OAuth Only

Third-party authentication only.

**Rejected because:**
- MVP requires email/password
- Not all users have OAuth accounts
- Less control

### bcrypt

Password hashing with bcrypt.

**Rejected because:**
- Argon2 is newer and more secure
- Argon2 is memory-hard
- Argon2 wins Password Hashing Competition

## Security Considerations

- Access tokens are short-lived (15 min)
- Refresh tokens are rotated on use
- Refresh tokens are stored securely
- Passwords are hashed with Argon2id
- Rate limiting on auth endpoints
- Account lockout after failed attempts

## References

- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
- [Argon2 Documentation](https://github.com/P-H-C/phc-winner-argon2)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
