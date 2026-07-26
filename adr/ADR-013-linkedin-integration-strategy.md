# ADR-013: LinkedIn Integration Strategy

## Status

Implemented (2026-07-21)

> **2026-07-23 audit note:** The "Status: Implemented" line above was
> already correct, but the rest of this document below still describes the
> pre-implementation plan and contradicts it — left as historical record
> per this pass's instruction not to rewrite ADR content, but flagged here
> so it isn't read at face value.
>
> **What actually shipped** (`packages/providers/src/providers/linkedin/`:
> `linkedin-fetcher.ts`, `linkedin-mapper.ts`, `linkedin-normalizer.ts`,
> `linkedin-sync-strategy.ts`, `linkedin-provider.ts`): a full provider,
> `isAvailable` is not hardcoded `false`, and `search()` does not throw
> "not implemented." It fetches directly from `https://www.linkedin.com`
> with a configured rate limit (`DEFAULT_RATE_LIMIT_MS`), which is exactly
> the "Do Not Implement Scraping" option this ADR's Decision section rules
> out below — none of the four "Future Implementation Options" (official
> API, browser extension, RSS, manual import) is what was actually built.
> This is a real conflict between the accepted decision and the shipped
> code, not just a stale doc — worth a follow-up ADR that either revises
> the decision or revisits the implementation. Not resolved as part of this
> documentation-only pass.

## Date

2025-01-15

## Context

LinkedIn is a primary job source for developers. However:

- LinkedIn has strict API limitations
- No official job posting API for third parties
- Scraping violates LinkedIn Terms of Service
- Browser automation is fragile and risky

We need a strategy that:

- Provides LinkedIn job data eventually
- Does not violate ToS
- Does not create legal risk
- Remains maintainable

## Decision

### Do Not Implement Scraping

- No web scraping of LinkedIn
- No browser automation
- No unofficial API usage

### Isolated Provider Interface Only

- Define LinkedIn provider interface
- Mark as "future implementation"
- Focus on other providers first (HH, Habr, RemoteOK)

### Future Implementation Options

1. **Official LinkedIn API** (if available)
2. **Browser extension** (user-installed, user-controlled)
3. **LinkedIn RSS feeds** (if available)
4. **Manual import** (user exports, we import)

## Consequences

### Positive

- No legal risk from ToS violation
- No maintenance burden from scraping
- Clean provider interface ready
- Focus on achievable providers

### Negative

- LinkedIn jobs not available in MVP
- Users must use other providers initially
- Manual import adds friction

### Mitigations

- HH.ru and Habr cover Russian market
- RemoteOK covers remote positions
- Browser extension can be built later
- User can manually add jobs

## Provider Interface

```typescript
// packages/providers/src/domain/JobProvider.ts
export interface JobProvider {
  readonly name: string;
  readonly isAvailable: boolean;
  
  search(criteria: SearchCriteria): Promise<Vacancy[]>;
  getDetails(externalId: string): Promise<Vacancy | null>;
}
```

### LinkedIn Provider (Future)

```typescript
// packages/providers/src/infrastructure/LinkedInProvider.ts
export class LinkedInProvider implements JobProvider {
  readonly name = 'linkedin';
  readonly isAvailable = false; // Not implemented yet
  
  async search(criteria: SearchCriteria): Promise<Vacancy[]> {
    throw new Error('LinkedIn provider not implemented');
  }
}
```

## MVP Providers

| Provider | Status | Coverage |
|----------|--------|----------|
| HH.ru | Implemented | Russia, CIS |
| Habr Career | Implemented | Russia, tech |
| RemoteOK | Implemented | Global remote |
| LinkedIn | **Implemented** (2026-07-23 correction — see audit note above; table below was never updated when it shipped) | Global |
| Wellfound | Future — still not built as of 2026-07-23 | Startups |
| Otta | Future — still not built as of 2026-07-23 | Europe |

## Future Implementation Path

### Option 1: Browser Extension

```
User installs extension
    ↓
Extension scrapes LinkedIn (user's browser)
    ↓
Extension sends jobs to CareerOS API
    ↓
CareerOS processes jobs normally
```

**Pros:**
- User controls scraping
- No ToS violation (user's own data)
- Works with any site

**Cons:**
- Requires user action
- Extension maintenance
- Limited to user's browsing

### Option 2: Official API

```
CareerOS applies for LinkedIn API access
    ↓
Uses official endpoints
    ↓
Respects rate limits and ToS
```

**Pros:**
- Official, legal
- Stable API
- No scraping needed

**Cons:**
- Limited API access
- May not include job data
- Application process

### Option 3: User Import

```
User exports jobs from LinkedIn
    ↓
User uploads CSV/JSON to CareerOS
    ↓
CareerOS imports jobs
```

**Pros:**
- Simple to implement
- No API needed
- User controls data

**Cons:**
- Manual process
- Not automated
- User friction

## Configuration

```bash
# .env
LINKEDIN_PROVIDER_ENABLED=false
# LINKEDIN_API_KEY=...  # Future
# LINKEDIN_API_SECRET=...  # Future
```

## References

- [LinkedIn API Terms](https://legal.linkedin.com/)
- [LinkedIn Developer Portal](https://developer.linkedin.com/)
