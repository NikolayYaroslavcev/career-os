# ADR-003: Provider/Adapter Pattern for External Services

## Status

Accepted

## Date

2026-01-15

## Context

CareerOS integrates with many external services:
- Job sources: LinkedIn, HH, Habr, RemoteOK
- AI: OpenAI, Anthropic, Gemini
- Notifications: Telegram, Email, Discord

These services have different APIs, data formats, and reliability. We need to:
- Add new providers without changing business logic
- Replace providers without affecting the system
- Test without real external calls

## Decision

Use the Adapter/Provider pattern with interface-based abstraction for all external integrations.

## Pattern

```
Domain Interface
       ↓
Provider Adapter (implements interface)
       ↓
External Service API
```

### Example: Job Provider

```typescript
// packages/shared/src/interfaces/job-provider.ts
interface JobProvider {
  readonly name: string;
  fetchJobs(criteria: SearchCriteria): Promise<RawJob[]>;
  healthCheck(): Promise<boolean>;
}

// packages/providers/src/hh/hh-provider.ts
class HHProvider implements JobProvider {
  readonly name = 'HH';
  async fetchJobs(criteria: SearchCriteria): Promise<RawJob[]> {
    // HH API implementation
  }
}
```

### Example: AI Provider

```typescript
// packages/ai/src/interfaces/ai-provider.ts
interface AIProvider {
  readonly name: string;
  analyzeMatch(resume: Resume, job: Job): Promise<MatchAnalysis>;
  generateText(prompt: string, options?: GenerateOptions): Promise<string>;
  healthCheck(): Promise<boolean>;
}

// packages/ai/src/openai/openai-provider.ts
class OpenAIProvider implements AIProvider {
  readonly name = 'OpenAI';
  async analyzeMatch(resume: Resume, job: Job): Promise<MatchAnalysis> {
    // OpenAI implementation
  }
}
```

## Configuration

Providers are configured via environment variables:

```bash
# Active provider
AI_PROVIDER=openai

# Provider-specific config
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...
```

Provider selection happens at startup, not in business logic.

## Rationale

### Strategy Pattern over inheritance
- Composition over inheritance
- Easy to swap implementations at runtime (future)
- Clearer responsibility boundaries

### Interface-based over abstract classes
- TypeScript interfaces are lighter
- Easier to mock in tests
- No diamond problem

## Consequences

### Positive
- Adding LinkedIn provider = new class implementing interface
- Swapping OpenAI for Anthropic = config change only
- Tests use mock providers
- Business logic never imports provider code

### Negative
- Each provider needs its own adapter
- Provider-specific features need careful abstraction
- Error handling must be normalized across providers

### Mitigations
- Shared error types for provider failures
- Provider health checks for circuit breaking
- Provider-specific packages for isolation

## Provider Registry

```typescript
// packages/providers/src/registry.ts
class ProviderRegistry {
  private providers = new Map<string, JobProvider>();

  register(provider: JobProvider): void {
    this.providers.set(provider.name, provider);
  }

  get(name: string): JobProvider {
    const provider = this.providers.get(name);
    if (!provider) throw new Error(`Provider ${name} not found`);
    return provider;
  }

  getAll(): JobProvider[] {
    return Array.from(this.providers.values());
  }
}
```

## Alternatives Considered

1. **Direct API calls**: Rejected. Creates tight coupling.
2. **Abstract base class**: Rejected. TypeScript interfaces are sufficient.
3. **Plugin system**: Overkill for current needs. Can evolve to this later.
