import type Redis from 'ioredis';
import { getRedis } from '../redis.js';

const KEY_PREFIX = 'careeros:ai-batch:';

/**
 * Ordered backlog of vacancy IDs still awaiting an AI match for a given
 * search profile, beyond the first Top-N batch already enqueued. Backed by
 * Redis (already a hard dependency via BullMQ, see ADR-007) rather than a new
 * Postgres table — this is derived, ephemeral state, not a record of truth.
 *
 * apps/backend pushes triage-ranked-but-not-yet-enqueued vacancies here right
 * after enqueuing the first batch; apps/worker pops the next batch once the
 * current one finishes, continuing until the backlog for that search profile
 * is empty (see ADR-027).
 */
export interface AiBatchBacklog {
  push(searchProfileId: string, vacancyIds: readonly string[]): Promise<void>;
  popBatch(searchProfileId: string, size: number): Promise<string[]>;
  remaining(searchProfileId: string): Promise<number>;
}

export class RedisAiBatchBacklog implements AiBatchBacklog {
  private readonly redis: Redis;

  constructor(redis?: Redis) {
    this.redis = redis ?? getRedis();
  }

  async push(searchProfileId: string, vacancyIds: readonly string[]): Promise<void> {
    if (vacancyIds.length === 0) return;
    await this.redis.rpush(this.key(searchProfileId), ...vacancyIds);
  }

  async popBatch(searchProfileId: string, size: number): Promise<string[]> {
    if (size <= 0) return [];
    const popped = await this.redis.lpop(this.key(searchProfileId), size);
    if (!popped) return [];
    return Array.isArray(popped) ? popped : [popped];
  }

  async remaining(searchProfileId: string): Promise<number> {
    return this.redis.llen(this.key(searchProfileId));
  }

  private key(searchProfileId: string): string {
    return `${KEY_PREFIX}${searchProfileId}`;
  }
}

/** In-memory stand-in for tests and any environment without Redis configured. */
export class InMemoryAiBatchBacklog implements AiBatchBacklog {
  private readonly backlogs = new Map<string, string[]>();

  async push(searchProfileId: string, vacancyIds: readonly string[]): Promise<void> {
    if (vacancyIds.length === 0) return;
    const existing = this.backlogs.get(searchProfileId) ?? [];
    this.backlogs.set(searchProfileId, [...existing, ...vacancyIds]);
  }

  async popBatch(searchProfileId: string, size: number): Promise<string[]> {
    if (size <= 0) return [];
    const existing = this.backlogs.get(searchProfileId) ?? [];
    const batch = existing.slice(0, size);
    const rest = existing.slice(size);
    if (rest.length > 0) {
      this.backlogs.set(searchProfileId, rest);
    } else {
      this.backlogs.delete(searchProfileId);
    }
    return batch;
  }

  async remaining(searchProfileId: string): Promise<number> {
    return this.backlogs.get(searchProfileId)?.length ?? 0;
  }
}
