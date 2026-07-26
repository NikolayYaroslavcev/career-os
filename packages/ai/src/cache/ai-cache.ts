import type { AIResponse } from '../domain/ai-types.js';

export interface AICacheEntry {
  readonly response: AIResponse;
  readonly cachedAt: Date;
  readonly ttlMs: number;
}

export interface AICache {
  get(promptHash: string): Promise<AICacheEntry | null>;
  set(promptHash: string, response: AIResponse, ttlMs?: number): Promise<void>;
  has(promptHash: string): Promise<boolean>;
  delete(promptHash: string): Promise<void>;
  clear(): Promise<void>;
}

export class InMemoryAICache implements AICache {
  private cache = new Map<string, AICacheEntry>();
  private readonly defaultTtlMs: number;

  constructor(defaultTtlMs: number = 60 * 60 * 1000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  async get(promptHash: string): Promise<AICacheEntry | null> {
    const entry = this.cache.get(promptHash);
    if (!entry) return null;

    if (Date.now() - entry.cachedAt.getTime() > entry.ttlMs) {
      this.cache.delete(promptHash);
      return null;
    }

    return entry;
  }

  async set(promptHash: string, response: AIResponse, ttlMs?: number): Promise<void> {
    this.cache.set(promptHash, {
      response,
      cachedAt: new Date(),
      ttlMs: ttlMs ?? this.defaultTtlMs,
    });
  }

  async has(promptHash: string): Promise<boolean> {
    const entry = await this.get(promptHash);
    return entry !== null;
  }

  async delete(promptHash: string): Promise<void> {
    this.cache.delete(promptHash);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}
