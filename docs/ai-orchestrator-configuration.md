# AI Orchestrator Configuration Guide

## Overview

The AI Orchestrator is a new subsystem that centralizes all AI requests, provides persistent caching, usage tracking, budget enforcement, and provider routing.

## Environment Variables

Add these to your `.env` file:

```bash
# AI Orchestrator Mode: manual | smart | automatic
# - manual (default): Only explicit user actions trigger AI
# - smart: Background AI for high-priority vacancies, watched companies
# - automatic: Analyze every new vacancy (disabled by default)
AI_ORCHESTRATOR_MODE=manual

# Cache TTL in milliseconds (default: 86400000 = 24 hours)
# How long AI responses are cached before requiring re-generation
AI_CACHE_TTL_MS=86400000

# Enable budget enforcement (default: true)
# When true, the system checks daily/monthly limits before executing AI
AI_BUDGET_CHECK_ENABLED=true

# Per-feature provider overrides (JSON format, optional)
# Allows different AI providers for different features
# Example: Cover letter uses OpenAI, resume tailoring uses Anthropic
AI_FEATURE_PROVIDER_MAP={"cover_letter":"openai","tailor_resume":"anthropic"}
```

## AI Modes

### Manual Mode (Default)

Only explicit user actions trigger AI. This is the recommended mode for most users.

**When AI runs:**
- User clicks "Analyze Vacancy"
- User clicks "Tailor Resume"
- User clicks "Generate Cover Letter"
- User clicks "Interview Preparation"
- User clicks "Salary Analysis"
- User clicks "Company Analysis"
- User clicks "Resume Improvement"
- User clicks "Career Advice"

**When AI does NOT run:**
- Opening a vacancy
- Browsing/searching vacancies
- Filtering vacancies
- Saving a vacancy
- Changing application status
- Timeline updates
- Company Watch sync
- Job synchronization

### Smart Mode

Background AI runs for high-priority items only.

**Additional automatic triggers:**
- Vacancies from explicitly watched companies
- Vacancies scoring above configurable threshold

### Automatic Mode

Analyzes every new vacancy. Disabled by default due to high token usage.

**Caution:** This mode can consume significant tokens. Set budget limits when using this mode.

## Budget Configuration

Budget limits are configured via the API or dashboard.

### Setting Limits

```bash
# Set daily token limit
curl -X PUT /api/v1/ai/budget \
  -H "Content-Type: application/json" \
  -d '{
    "period": "DAILY",
    "maxTokens": 100000,
    "maxCost": 5.00,
    "maxRequestsPerFeature": {
      "cover_letter": 10,
      "tailor_resume": 5
    },
    "isEnabled": true
  }'

# Set monthly token limit
curl -X PUT /api/v1/ai/budget \
  -H "Content-Type: application/json" \
  -d '{
    "period": "MONTHLY",
    "maxTokens": 3000000,
    "maxCost": 50.00,
    "isEnabled": true
  }'
```

### When Limits Are Reached

- AI features return a "budget limit reached" error
- The error message indicates which limit was hit (tokens, cost, or per-feature requests)
- Limits reset at midnight (daily) or first of month (monthly)

## Provider Configuration

### Default Provider

Set the default AI provider via environment variable:

```bash
AI_PROVIDER=openai  # or anthropic, gemini, groq, openrouter
```

### Per-Feature Providers

Use `AI_FEATURE_PROVIDER_MAP` to route different features to different providers:

```bash
# Use OpenAI for cover letters (better at formal writing)
# Use Anthropic for resume tailoring (better at technical content)
AI_FEATURE_PROVIDER_MAP={"cover_letter":"openai","tailor_resume":"anthropic"}
```

### User-Specific Providers (BYOK)

Users can configure their own API keys via the API:

```bash
# Add user's OpenAI key
curl -X PUT /api/v1/ai/providers \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "apiKey": "sk-...",
    "model": "gpt-4o",
    "priority": 1
  }'

# Add Ollama for local inference
curl -X PUT /api/v1/ai/providers \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "openai",
    "baseUrl": "http://localhost:11434/v1",
    "model": "llama3",
    "priority": 2
  }'
```

### Provider Priority

Providers are tried in priority order (highest first). If the primary provider fails, the system falls back to the next provider.

## Cache Configuration

### Cache Key Structure

Cache keys are SHA-256 hashes of:
- Provider name
- Model name
- Prompt version
- Feature name
- Content hash (input data)

**Changing the prompt version automatically invalidates all cached responses for that feature.**

### Cache Operations

```bash
# Get cache statistics
curl /api/v1/ai/cache/stats

# Clear cache for a specific feature
curl -X DELETE /api/v1/ai/cache?feature=cover_letter

# Clear all cache
curl -X DELETE /api/v1/ai/cache
```

### Cache TTL

Default TTL is 24 hours. Override per-request:

```bash
# Cache for 1 hour only
curl -X POST /api/v1/ai/salary-analysis \
  -d '{ "jobTitle": "...", "options": { "cacheTtlMs": 3600000 } }'
```

## Monitoring

### Dashboard

Visit `/app/ai` to see:
- Token usage (today/week/month)
- Estimated monthly cost
- Cache hit rate
- Most expensive/frequent features
- Provider breakdown
- Recent jobs

### API Endpoints

```bash
# Get usage stats
curl /api/v1/ai/usage?period=month

# Get dashboard data
curl /api/v1/ai/usage/dashboard

# List recent jobs
curl /api/v1/ai/jobs?limit=20

# Get specific job
curl /api/v1/ai/jobs/{jobId}
```

## Troubleshooting

### "Budget limit reached"

Check your budget settings:
```bash
curl /api/v1/ai/budget
```

Increase limits or disable budget enforcement:
```bash
AI_BUDGET_CHECK_ENABLED=false
```

### "No handler registered"

Ensure the feature name is one of the 8 supported features:
- analyze_vacancy
- tailor_resume
- cover_letter
- interview_prep
- salary_analysis
- company_analysis
- resume_improvement
- career_advice

### Cache not working

1. Check Redis is running: `redis-cli ping`
2. Check cache stats: `curl /api/v1/ai/cache/stats`
3. Clear cache if stale: `curl -X DELETE /api/v1/ai/cache`

### Provider errors

1. Check provider configuration: `curl /api/v1/ai/providers`
2. Test provider connection: `curl -X POST /api/v1/ai/providers/{provider}/test`
3. Check API key is valid
4. Check provider status page for outages
