# ADR-008: Provider-Based Architecture

## Status

Accepted

## Date

2025-01-15

## Context

CareerOS integrates with multiple external services:

- Job providers (LinkedIn, HH, Habr, etc.)
- AI providers (OpenAI, Anthropic, etc.)
- Notification providers (Telegram, Email, etc.)

We need a pattern that:

- Allows adding new providers without changing business logic
- Makes providers replaceable
- Keeps business logic independent of external services
- Supports testing with mocks

## Decision

We will use the Provider Pattern (Adapter Pattern) for all external integrations.

## Consequences

### Positive

- Business logic independent of providers
- Easy to add new providers
- Easy to replace providers
- Testable with mocks
- Configuration-driven provider selection

### Negative

- More interfaces to maintain
- Additional abstraction layer
- Requires discipline to follow

### Mitigations

- Clear interface definitions
- Provider registry pattern
- Documentation of provider contracts

## Pattern Structure

```
Domain Layer
    ↓ defines interfaces
Application Layer
    ↓ uses interfaces
Infrastructure Layer
    ↓ implements adapters
External Services
```

## Example: AI Provider

```typescript
// packages/ai/src/domain/AIProvider.ts
export interface AIProvider {
  analyzeVacancy(vacancy: Vacancy, profile: UserProfile): Promise<MatchResult>;
  generateResume(data: ResumeData, vacancy: Vacancy): Promise<string>;
  generateCoverLetter(data: ResumeData, vacancy: Vacancy): Promise<string>;
}

// packages/ai/src/infrastructure/OpenAIProvider.ts
export class OpenAIProvider implements AIProvider {
  async analyzeVacancy(vacancy: Vacancy, profile: UserProfile): Promise<MatchResult> {
    // OpenAI-specific implementation
  }
}

// packages/ai/src/infrastructure/AnthropicProvider.ts
export class AnthropicProvider implements AIProvider {
  async analyzeVacancy(vacancy: Vacancy, profile: UserProfile): Promise<MatchResult> {
    // Anthropic-specific implementation
  }
}
```

## Provider Registry

```typescript
// packages/ai/src/registry.ts
const providers: Map<string, AIProvider> = new Map();

export function registerProvider(name: string, provider: AIProvider): void {
  providers.set(name, provider);
}

export function getProvider(name: string): AIProvider {
  const provider = providers.get(name);
  if (!provider) throw new Error(`Provider ${name} not found`);
  return provider;
}
```

## Provider Categories

### Job Providers

| Provider | Interface | Status |
|----------|-----------|--------|
| HH.ru | JobProvider | Planned |
| LinkedIn | JobProvider | Planned |
| Habr Career | JobProvider | Planned |
| RemoteOK | JobProvider | Future |

### AI Providers

| Provider | Interface | Status |
|----------|-----------|--------|
| OpenAI | AIProvider | Planned |
| Anthropic | AIProvider | Planned |
| Google | AIProvider | Future |
| OpenRouter | AIProvider | Future |

### Notification Providers

| Provider | Interface | Status |
|----------|-----------|--------|
| Telegram | NotificationProvider | Planned |
| Email | NotificationProvider | Planned |
| Discord | NotificationProvider | Future |
| Slack | NotificationProvider | Future |

## Alternatives Considered

### Direct Integration

Call external APIs directly in business logic.

**Rejected because:**
- Couples business logic to providers
- Hard to test
- Hard to replace providers

### Strategy Pattern

Similar pattern but focused on algorithm selection.

**Rejected because:**
- Provider pattern is more appropriate for external services
- Better separation of concerns

## References

- [Adapter Pattern](https://refactoring.guru/design-patterns/adapter)
- [Strategy Pattern](https://refactoring.guru/design-patterns/strategy)
