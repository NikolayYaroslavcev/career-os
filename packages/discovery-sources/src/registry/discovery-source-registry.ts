import type { DiscoverySourceFetcher, DiscoverySourceId } from '../types.js';

export class DiscoverySourceNotFoundError extends Error {
  constructor(sourceId: string) {
    super(`Discovery source not registered: ${sourceId}`);
    this.name = 'DiscoverySourceNotFoundError';
  }
}

/** Mirrors AtsAdapterRegistry/ProviderRegistry's registration-by-id pattern (ADR §1's reuse table). */
export class DiscoverySourceRegistry {
  private readonly fetchers = new Map<DiscoverySourceId, DiscoverySourceFetcher>();

  register(fetcher: DiscoverySourceFetcher): void {
    this.fetchers.set(fetcher.id, fetcher);
  }

  has(id: DiscoverySourceId): boolean {
    return this.fetchers.has(id);
  }

  get(id: DiscoverySourceId): DiscoverySourceFetcher {
    const fetcher = this.fetchers.get(id);
    if (!fetcher) throw new DiscoverySourceNotFoundError(id);
    return fetcher;
  }

  getAll(): readonly DiscoverySourceFetcher[] {
    return [...this.fetchers.values()];
  }
}
