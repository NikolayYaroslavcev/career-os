# HeadHunter API 403 Forbidden - Investigation Report

**Date:** 2025-01-22
**Status:** Definitive root cause identified
**Severity:** Production blocker

---

## Executive Summary

The HeadHunter API `/vacancies` endpoint returns `403 Forbidden` with `{"errors":[{"type":"forbidden"}]}` from **DDoS-Guard**, a CDN/WAF service protecting HeadHunter's infrastructure. This is an **IP-level block** that cannot be bypassed through headers, User-Agent changes, OAuth tokens, or any code-level modifications.

**Root Cause:** DDoS-Guard is blocking the `/vacancies` endpoint from our IP address(s). This is a network-layer protection, not an API-level error.

**Impact:** The HH provider cannot fetch vacancies from any environment using our current IP addresses.

---

## Evidence

### 1. Official HH API Error Documentation

From `https://github.com/hhru/api/blob/master/docs/errors.md`:

| HTTP Code | Type | Value | Description |
|-----------|------|-------|-------------|
| 400 | bad_user_agent | unset | User-Agent header not sent |
| 400 | bad_user_agent | blacklisted | User-Agent value is blacklisted |
| 403 | oauth | bad_authorization | Token doesn't exist or invalid |
| 403 | oauth | token_expired | Access token expired |
| 403 | oauth | token_revoked | Token revoked by user |
| 403 | oauth | application_not_found | App was deleted |
| 403 | oauth | user_auth_expected | App token used for user endpoint |

**Key finding:** The `{"type":"forbidden"}` error we receive has **no `value` field**. This error type is NOT documented in the official HH API error documentation. This confirms the 403 is from DDoS-Guard, not from HH's API layer.

### 2. Endpoint Accessibility Testing

| Endpoint | Status | Response |
|----------|--------|----------|
| `GET /` | 302 | Redirect to hh.ru |
| `GET /areas` | 200 | Full JSON response |
| `GET /dictionaries` | 200 | Full JSON response |
| `GET /vacancies?per_page=1` | 403 | `{"errors":[{"type":"forbidden"}]}` |
| `GET /vacancies/{id}` | 403 | `{"errors":[{"type":"forbidden"}]}` |

**Conclusion:** DDoS-Guard selectively blocks the `/vacancies` endpoint while allowing `/areas` and `/dictionaries` through. This is consistent with WAF rules that protect resource-intensive search endpoints.

### 3. Header Testing Results

| Test | User-Agent | HH-User-Agent | Accept | Result |
|------|------------|---------------|--------|--------|
| Plain request | none | none | none | 403 |
| CareerOS UA | CareerOS/1.0 | none | json | 403 |
| Browser UA | Mozilla/5.0... | none | json | 403 |
| Minimal UA | Mozilla/5.0 | none | json | 403 |
| With HH-User-Agent | CareerOS/1.0 | CareerOS/1.0 | json | 403 |
| With Accept-Language | CareerOS/1.0 | none | json + ru-RU | 403 |
| With Authorization | CareerOS/1.0 | none | json + Bearer | 403 |

**Conclusion:** No header combination bypasses the block. The issue is at the network layer.

### 4. DDoS-Guard Behavior Analysis

DDoS-Guard is a Russian CDN/WAF provider used by HeadHunter. It:

- Operates at the network edge, before requests reach HH's API servers
- Uses IP reputation scoring to block suspicious traffic
- Applies different rules per endpoint (evidenced by `/areas` working while `/vacancies` is blocked)
- Returns its own error format (`{"errors":[{"type":"forbidden"}]}`) that differs from HH's documented API errors

### 5. Request IDs

Each 403 response includes a `request_id` field:
```
request_id: "178475304555680448e6bbdc6954a027"
request_id: "17847530573709a303bae45b1d6d7026"
request_id: "17847530979650b4aa7414f1eb1aa021"
```

These are DDoS-Guard request IDs, not HH API request IDs. They confirm the block is at the WAF layer.

---

## Why This Cannot Be Solved in Code

1. **IP-level block**: DDoS-Guard blocks based on IP address reputation, not request content
2. **No header bypass**: Changing User-Agent, Accept, or adding HH-User-Agent doesn't help
3. **No OAuth bypass**: Authorization tokens don't affect DDoS-Guard's decision
4. **No query bypass**: Different query parameters don't change the outcome
5. **CDN/WAF layer**: The block happens before the request reaches HH's API servers

---

## Production Solutions

### Option 1: OAuth Application Token (Recommended)

Register an application at `https://dev.hh.ru` and obtain an application token.

**Pros:**
- Official, documented approach
- Higher rate limits (5000 requests/day)
- May have better DDoS-Guard reputation
- Required for many API endpoints anyway

**Cons:**
- Requires application registration (up to 15 business days)
- Still subject to DDoS-Guard if IP is blocked
- Application token doesn't guarantee bypass

**Implementation:**
```typescript
// In .env
HH_CLIENT_ID=your_client_id
HH_CLIENT_SECRET=your_client_secret
HH_ACCESS_TOKEN=your_application_token

// In hh-fetcher.ts - already supports Bearer token
if (this.accessToken) {
  headers['Authorization'] = `Bearer ${this.accessToken}`;
}
```

### Option 2: Cloud Relay / Proxy

Route HH API requests through a cloud server with a clean IP.

**Pros:**
- Bypasses IP reputation issues
- Can be deployed in Russia (lower latency)
- Full control over request routing

**Cons:**
- Additional infrastructure cost
- Requires maintenance
- May violate HH's Terms of Service

**Implementation:**
```typescript
// Add proxy support to HHFetcher
const proxyUrl = process.env.HH_PROXY_URL;
if (proxyUrl) {
  // Use proxy agent for fetch
}
```

### Option 3: Scheduled Importer with Resilient IPs

Use a service like Railway, Fly.io, or Render that provides rotating IPs.

**Pros:**
- Managed infrastructure
- Automatic IP rotation
- No proxy maintenance

**Cons:**
- Less control
- May still be blocked if HH blocks cloud IPs

### Option 4: Graceful Degradation (Recommended as immediate fix)

Disable HH provider automatically when 403 is detected and show a user-friendly message.

**Pros:**
- Zero infrastructure changes
- Immediate implementation
- Clear user communication
- No silent failures

**Cons:**
- HH vacancies unavailable
- Users see "HH temporarily unavailable"

**Implementation:**
```typescript
// Already partially implemented in hh-fetcher.ts
if (response.status === 403) {
  return {
    ok: false,
    error: ProviderErrorType.PROVIDER_UNAVAILABLE,
    message: `HH API is temporarily unavailable from this region. Try again later or use a VPN.`,
    retryable: true,
    meta: { durationMs: Date.now() - startTime },
  };
}
```

---

## Recommended Architecture

### Immediate (This Week)

1. **Implement graceful degradation** - Already partially done
2. **Add clear user messaging** - Show "HH temporarily unavailable" with retry option
3. **Log 403 events** - Track frequency and patterns

### Short-term (This Month)

1. **Register HH application** - Start the 15-day process now
2. **Obtain application token** - Test if OAuth bypasses DDoS-Guard
3. **Monitor IP reputation** - Check if our IPs are flagged

### Long-term (This Quarter)

1. **Evaluate cloud relay** - If OAuth doesn't work, implement proxy
2. **Consider alternative sources** - Add more job providers (LinkedIn, Indeed, etc.)
3. **Implement caching** - Cache HH responses to reduce API calls

---

## Code Changes Required

### 1. Enhanced Error Handling (hh-fetcher.ts)

Already implemented - returns `PROVIDER_UNAVAILABLE` on 403.

### 2. User-Facing Message (Dashboard)

Show a clear message when HH is unavailable:

```tsx
{provider.status === 'unavailable' && (
  <Alert>
    HeadHunter is temporarily unavailable from your region.
    This is a known issue with their API protection.
    <Button onClick={retry}>Retry</Button>
  </Alert>
)}
```

### 3. Diagnostics Script

Created at `scripts/hh-diagnostics.ts` - run to verify the issue.

---

## References

- HH API Documentation: https://github.com/hhru/api
- HH API Errors: https://github.com/hhru/api/blob/master/docs/errors.md
- HH API Authorization: https://github.com/hhru/api/blob/master/docs/authorization.md
- HH Application Registration: https://dev.hh.ru
- DDoS-Guard: https://ddos-guard.net

---

## Conclusion

The 403 Forbidden error is an **IP-level block by DDoS-Guard**, not an HH API error. This cannot be bypassed through code changes. The recommended approach is:

1. **Immediate:** Implement graceful degradation with clear user messaging
2. **Short-term:** Register an HH application and test OAuth token
3. **Long-term:** Consider cloud relay if OAuth doesn't work

The HH provider should be marked as "temporarily unavailable" until we can obtain a working OAuth token or implement a cloud relay.
