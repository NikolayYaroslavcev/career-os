# ADR-006: AI Provider Abstraction

## Status

Accepted

## Date

2026-01-15

## Context

CareerOS uses AI for:
- Matching resumes to vacancies
- Generating follow-up messages
- Creating tailored resumes
- Writing cover letters
- Interview question generation
- Salary estimation

AI providers differ in:
- API format
- Pricing
- Rate limits
- Model capabilities
- Response quality

We must not lock into one provider.

## Decision

Create an AI provider abstraction with interface-based swapping.

## Interface Design

```typescript
// packages/ai/src/interfaces/ai-provider.ts
interface AIProvider {
  readonly name: string;

  // Core capabilities
  generateText(prompt: string, options?: GenerateOptions): Promise<string>;
  generateStructured<T>(prompt: string, schema: ZodSchema<T>): Promise<T>;

  // Domain-specific
  analyzeMatch(resume: ParsedResume, job: JobData): Promise<MatchAnalysis>;
  generateFollowUp(context: FollowUpContext): Promise<string>;
  generateResumeContent(data: ResumeGenerationRequest): Promise<string>;
  generateCoverLetter(data: CoverLetterRequest): Promise<string>;
  generateInterviewQuestions(data: InterviewRequest): Promise<Question[]>;
  estimateSalary(jobData: JobData, marketData?: MarketData): Promise<SalaryEstimate>;

  // Health
  healthCheck(): Promise<boolean>;
}

interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}
```

## Provider Implementations

```typescript
// packages/ai/src/openai/openai-provider.ts
class OpenAIProvider implements AIProvider {
  readonly name = 'OpenAI';
  private client: OpenAI;

  async generateText(prompt: string, options?: GenerateOptions): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: options?.temperature ?? 0.7,
    });
    return response.choices[0].message.content;
  }

  async generateStructured<T>(prompt: string, schema: ZodSchema<T>): Promise<T> {
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });
    const parsed = JSON.parse(response.choices[0].message.content);
    return schema.parse(parsed);
  }
}
```

## Prompt Management

Prompts are versioned and stored separately:

```typescript
// packages/ai/src/prompts/match-analysis.ts
export const MATCH_ANALYSIS_PROMPT_VERSION = '1.2.0';

export function buildMatchAnalysisPrompt(
  resume: ParsedResume,
  job: JobData
): string {
  return `
You are an expert recruiter analyzing job fit.

Resume:
${formatResume(resume)}

Job:
${formatJob(job)}

Analyze the match and return JSON with:
- score (0-100)
- strengths (array of strings)
- weaknesses (array of strings)
- missingSkills (array of strings)
- explanation (string)
`;
}
```

## Configuration

```bash
# .env
AI_PROVIDER=openai

# Provider-specific
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o

# Fallback
AI_FALLBACK_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

## Consequences

### Positive
- Swap providers via config
- Test with mock providers
- Prompt versions tracked
- Cost optimization across providers

### Negative
- Abstracting provider differences is hard
- Some features provider-specific
- Prompt tuning per provider needed

### Mitigations
- Provider-specific packages for custom features
- Prompt testing suite
- Cost tracking per provider

## Provider Selection Logic

```typescript
// packages/ai/src/provider-factory.ts
class AIProviderFactory {
  static create(config: AIConfig): AIProvider {
    switch (config.provider) {
      case 'openai':
        return new OpenAIProvider(config.openai);
      case 'anthropic':
        return new AnthropicProvider(config.anthropic);
      case 'gemini':
        return new GeminiProvider(config.gemini);
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }
}
```

## Alternatives Considered

1. **LangChain**: Rejected. Too heavy, adds dependency on framework.
2. **Vercel AI SDK**: Considered. Good for streaming, but adds vendor coupling.
3. **OpenRouter**: Considered as aggregator. Chose direct provider access for control.
