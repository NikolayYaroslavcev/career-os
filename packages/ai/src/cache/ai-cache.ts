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

/** Lives for a whole worker process's lifetime (see apps/worker/src/container.ts), so an unbounded Map here is a slow memory leak — most (vacancy, resume) prompt hashes are never requested a second time, so entries only ever accumulate. */
const DEFAULT_MAX_ENTRIES = 5000;

export class InMemoryAICache implements AICache {
  private cache = new Map<string, AICacheEntry>();
  private readonly defaultTtlMs: number;
  private readonly maxEntries: number;

  constructor(defaultTtlMs: number = 60 * 60 * 1000, maxEntries: number = DEFAULT_MAX_ENTRIES) {
    this.defaultTtlMs = defaultTtlMs;
    this.maxEntries = maxEntries;
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
    // Delete-then-set (rather than plain set on an existing key) moves this
    // entry to the end of the Map's iteration order, so the eviction loop
    // below always drops the actual oldest entry, not just the oldest
    // never-since-updated one.
    this.cache.delete(promptHash);
    this.cache.set(promptHash, {
      response,
      cachedAt: new Date(),
      ttlMs: ttlMs ?? this.defaultTtlMs,
    });

    while (this.cache.size > this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey === undefined) break;
      this.cache.delete(oldestKey);
    }
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
