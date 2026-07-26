import { BaseAIProvider } from '@careeros/ai';
import type { AIRequest, AIResponse, AICapabilities, AIProviderConfig } from '@careeros/ai';

const TECH_KEYWORDS = [
  'typescript',
  'javascript',
  'node.js',
  'python',
  'java',
  'go',
  'rust',
  'react',
  'vue',
  'angular',
  'postgresql',
  'mysql',
  'mongodb',
  'redis',
  'docker',
  'kubernetes',
  'aws',
  'gcp',
  'azure',
  'graphql',
];

const ROLE_KEYWORDS = [
  'backend engineer',
  'frontend engineer',
  'full stack engineer',
  'fullstack engineer',
  'software engineer',
  'data engineer',
  'devops engineer',
  'engineering manager',
];

/**
 * Deterministic, network-free AIProvider used by tests for the resume ->
 * search-profile-suggestion flow. Fields are derived from keyword matches in
 * the resume text embedded in the prompt by SearchProfileSuggestionPromptBuilder,
 * so different fixture resumes produce different — but reproducible — suggestions.
 */
export class MockSuggestionAIProvider extends BaseAIProvider {
  readonly name = 'mock';
  readonly defaultModel = 'mock-model';
  lastRequest: AIRequest | undefined;

  constructor(config: AIProviderConfig = { apiKey: 'mock' }) {
    super(config);
  }

  getCapabilities(): AICapabilities {
    return {
      supportsStreaming: false,
      supportsVision: false,
      maxTokens: 8000,
      supportedModels: ['mock-model'],
    };
  }

  protected async doComplete(request: AIRequest): Promise<Omit<AIResponse, 'latencyMs' | 'provider'>> {
    this.lastRequest = request;
    const content = JSON.stringify(this.buildSuggestion(request.prompt));

    return {
      content,
      usage: { promptTokens: 100, completionTokens: 120, totalTokens: 220 },
      model: this.defaultModel,
      confidence: 0.85,
      requestId: crypto.randomUUID(),
    };
  }

  private buildSuggestion(prompt: string): Record<string, unknown> {
    const lower = prompt.toLowerCase();

    const technologies = TECH_KEYWORDS.filter((t) => lower.includes(t));
    const positions = ROLE_KEYWORDS.filter((r) => lower.includes(r)).map(titleCase);

    return {
      desiredPositions: positions.length > 0 ? positions : ['Software Engineer'],
      technologies,
      experienceLevel: detectExperienceLevel(lower),
      remotePreference: detectRemotePreference(lower),
      confidence: 0.85,
      reasoning: `Mock analysis derived ${technologies.length} technologies and ${positions.length || 1} position(s) from resume keywords.`,
    };
  }
}

function detectExperienceLevel(lower: string): string {
  if (lower.includes('principal')) return 'principal';
  if (lower.includes('executive') || lower.includes(' cto') || lower.includes('vp of')) return 'executive';
  if (lower.includes('lead')) return 'lead';
  if (lower.includes('senior') || lower.includes('sr.')) return 'senior';
  if (lower.includes('junior') || lower.includes('jr.')) return 'junior';
  if (lower.includes('intern')) return 'intern';
  return 'middle';
}

function detectRemotePreference(lower: string): string {
  if (lower.includes('remote')) return 'remote';
  if (lower.includes('hybrid')) return 'hybrid';
  if (lower.includes('onsite') || lower.includes('on-site')) return 'onsite';
  return 'unknown';
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (c) => c.toUpperCase());
}
