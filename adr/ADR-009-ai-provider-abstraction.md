# ADR-009: AI Provider Abstraction

## Status

Accepted

## Date

2025-01-15

## Context

CareerOS uses AI for:

- Vacancy matching
- Resume generation
- Cover letter generation
- Interview question generation
- Salary estimation

We need to support multiple AI providers:

- OpenAI (GPT-4, GPT-4o)
- Anthropic (Claude 3.5)
- Google (Gemini Pro)
- OpenRouter (multi-model)

The system must:

- Allow switching providers via configuration
- Not couple business logic to specific providers
- Handle provider failures gracefully
- Support prompt versioning

## Decision

We will create an AIProvider interface with provider-specific implementations.

## Consequences

### Positive

- Business logic independent of AI vendor
- Easy to switch providers
- Easy to test with mocks
- Prompt versioning supported
- Fallback on provider failure

### Negative

- Need to maintain multiple implementations
- Provider-specific features may not be portable
- Response format normalization needed

### Mitigations

- Standardize response format
- Document provider differences
- Use common prompt templates

## Interface Design

```typescript
// packages/ai/src/domain/AIProvider.ts

export interface AIProvider {
  readonly name: string;
  
  analyzeVacancy(
    vacancy: Vacancy,
    profile: UserProfile,
    options?: AnalysisOptions,
  ): Promise<MatchResult>;
  
  generateResume(
    data: ResumeData,
    vacancy: Vacancy,
    options?: GenerationOptions,
  ): Promise<string>;
  
  generateCoverLetter(
    data: ResumeData,
    vacancy: Vacancy,
    options?: GenerationOptions,
  ): Promise<string>;
  
  generateInterviewQuestions(
    vacancy: Vacancy,
    profile: UserProfile,
    options?: GenerationOptions,
  ): Promise<Question[]>;
  
  estimateSalary(
    vacancy: Vacancy,
    profile: UserProfile,
  ): Promise<SalaryRange>;
}

export interface AnalysisOptions {
  temperature?: number;
  maxTokens?: number;
  promptVersion?: string;
}

export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  style?: 'formal' | 'casual';
  promptVersion?: string;
}
```

## Prompt Management

```typescript
// packages/ai/src/prompts/
export const prompts = {
  vacancyAnalysis: {
    v1: 'Analyze this vacancy against the user profile...',
    v2: 'Analyze this vacancy considering...',
  },
  resumeGeneration: {
    v1: 'Generate a tailored resume...',
    v2: 'Create a professional resume...',
  },
};
```

## Fallback Strategy

> **Superseded by [ADR-025](./ADR-025-ai-provider-resilience.md).** The sketch
> below was illustrative and never implemented. ADR-025 implements the real
> thing — an N-provider fallback chain with retry, health tracking, and
> metrics — as `packages/ai/src/providers/fallback-ai-provider.ts`.

```typescript
// packages/ai/src/FallbackAIProvider.ts
export class FallbackAIProvider implements AIProvider {
  constructor(
    private readonly primary: AIProvider,
    private readonly fallback: AIProvider,
  ) {}

  async analyzeVacancy(vacancy: Vacancy, profile: UserProfile): Promise<MatchResult> {
    try {
      return await this.primary.analyzeVacancy(vacancy, profile);
    } catch (error) {
      logger.warn('Primary AI provider failed, using fallback', { error });
      return await this.fallback.analyzeVacancy(vacancy, profile);
    }
  }
}
```

## Configuration

```bash
# .env
AI_PROVIDER=openai
AI_FALLBACK_PROVIDER=anthropic
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
AI_DEFAULT_MODEL=gpt-4o
AI_TEMPERATURE=0.7
AI_MAX_TOKENS=2000
```

## Alternatives Considered

### LangChain

AI framework with provider abstraction.

**Rejected because:**
- Heavy dependency
- Less control over prompts
- Additional abstraction layer

### AI SDK (Vercel)

TypeScript AI SDK.

**Rejected because:**
- Less mature
- Fewer provider support
- Less control

## References

- [OpenAI API](https://platform.openai.com/docs)
- [Anthropic API](https://docs.anthropic.com/)
- [Prompt Engineering](https://platform.openai.com/docs/guides/prompt-engineering)
