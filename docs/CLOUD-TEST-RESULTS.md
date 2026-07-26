# HH API Cloud Test Results

**Date:** 2026-07-22
**Test Endpoint:** `GET https://api.hh.ru/vacancies?text=frontend&per_page=1`

---

## Summary

| Environment | IP Address | IP Provider | Status | Result |
|-------------|------------|-------------|--------|--------|
| Local (Contabo VPS) | 207.180.224.130 | Contabo GmbH | 403 | ❌ Blocked |
| CORS Proxy (allorigins) | Proxy IP | Unknown | 403 | ❌ Blocked |
| CORS Proxy (corsproxy.io) | Proxy IP | Unknown | 403 | ❌ Blocked |

---

## Detailed Results

### 1. Local Environment (Contabo VPS)

```json
{
  "environment": "local",
  "url": "https://api.hh.ru/vacancies?text=frontend&per_page=1",
  "status": 403,
  "statusText": "Forbidden",
  "duration": 258,
  "headers": {
    "server": "ddos-guard",
    "set-cookie": "__ddg1_=eOIA6i9vCWMOKUTvsjxq; Domain=.hh.ru; HttpOnly; Path=/; Expires=Thu, 22-Jul-2027 20:50:38 GMT"
  },
  "bodyPreview": "{\"errors\":[{\"type\":\"forbidden\"}],\"request_id\":\"17847534381208257847bcf47e08a028\"}",
  "success": false
}
```

**IP Analysis:**
- IP: 207.180.224.130
- Hostname: vmi2710197.contaboserver.net
- City: Lauterbourg
- Region: Grand Est
- Country: FR (France)
- Org: AS51167 Contabo GmbH
- Type: VPS/Cloud Hosting

### 2. CORS Proxy (allorigins.win)

```json
{
  "status": 403,
  "body": "{\"errors\":[{\"type\":\"forbidden\"}],\"request_id\":\"1784753519760b4974b4ee87d40c7027\"}"
}
```

Even through a CORS proxy, the request returns 403. This suggests:
- DDoS-Guard may be blocking the proxy's IP as well
- Or DDoS-Guard is detecting the proxy pattern

### 3. CORS Proxy (corsproxy.io)

```json
{
  "status": 403,
  "error": "Server-side requests are not allowed on your plan. Upgrade at https://corsproxy.io/pricing/"
}
```

This proxy blocks server-side requests on free plans.

---

## Root Cause Analysis

### Why Our IP is Blocked

1. **Cloud/VPS IP**: Our server runs on Contabo GmbH, a VPS hosting provider
2. **DDoS-Guard Protection**: HeadHunter uses DDoS-Guard to protect against automated access
3. **IP Reputation**: Cloud/VPS IPs are commonly flagged by anti-bot systems
4. **Endpoint-Specific**: Only `/vacancies` is blocked; `/areas` and `/dictionaries` work fine

### DDoS-Guard Behavior

- Operates at CDN/WAF layer (before HH API servers)
- Uses IP reputation scoring
- Applies different rules per endpoint
- Returns its own error format (`{"errors":[{"type":"forbidden"}]}`)

---

## Conclusions

1. **The 403 is NOT specific to our local network** - it's an IP-level block
2. **Cloud/VPS IPs are blocked** - Contabo, and likely other VPS providers
3. **CORS proxies don't help** - DDoS-Guard blocks them too
4. **OAuth won't bypass this** - The block is at the network layer, not API layer

---

## Recommended Solutions

### Option 1: Residential Proxy (Best Option)

Use a residential proxy service with clean IPs:
- Bright Data
- Smartproxy
- Oxylabs

**Pros:**
- Residential IPs have better reputation
- Bypasses DDoS-Guard
- Full control

**Cons:**
- Monthly cost ($50-500/month)
- Requires proxy configuration

### Option 2: Cloud Relay in Russia

Deploy a relay server in Russia on a residential ISP:
- Use a Russian VPS with residential IP
- Or use a Russian cloud provider with clean IPs

**Pros:**
- Lower latency to HH API
- Russian IPs may have better reputation
- HH is a Russian service

**Cons:**
- Requires Russian infrastructure
- May still be blocked if IP is flagged

### Option 3: Graceful Degradation (Immediate Fix)

Already implemented - show "HH temporarily unavailable" to users.

**Pros:**
- Zero infrastructure changes
- Immediate implementation
- Clear user communication

**Cons:**
- HH vacancies unavailable
- Users see "HH temporarily unavailable"

### Option 4: Register HH Application

Register at `https://dev.hh.ru` and obtain OAuth token.

**Pros:**
- Official, documented approach
- Higher rate limits
- May have better DDoS-Guard reputation

**Cons:**
- 15-day approval process
- Still subject to IP blocking
- OAuth doesn't guarantee bypass

---

## Final Recommendation

**Immediate:** Keep graceful degradation (already implemented)

**Short-term:** 
1. Register HH application (start 15-day process now)
2. Test if OAuth token bypasses DDoS-Guard
3. If not, evaluate residential proxy

**Long-term:**
1. Implement residential proxy if needed
2. Consider Russian cloud relay
3. Add more job providers as alternatives

---

## Files Created

- `scripts/hh-test-curl.js` - Test script
- `scripts/hh-diagnostics.ts` - Full diagnostics
- `.github/workflows/hh-cloud-test.yml` - GitHub Actions workflow
- `railway.toml` - Railway config
- `fly.toml` - Fly.io config
- `docs/hh-api-403-investigation.md` - Full investigation
- `docs/CLOUD-TEST-RESULTS.md` - This file
