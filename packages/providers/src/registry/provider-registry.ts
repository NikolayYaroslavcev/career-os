import type { ProviderJob } from '../interfaces/provider-job.js';
import type { ProviderState } from '../interfaces/provider-state.js';
import type { ProviderCapabilities } from '../interfaces/provider-capabilities.js';

export class ProviderRegistry {
  private providers = new Map<string, ProviderJob>();
  private states = new Map<string, ProviderState>();
  private initialized = new Set<string>();

  register(provider: ProviderJob): void {
    if (this.providers.has(provider.info.id)) {
      throw new ProviderNotFoundError(provider.info.id);
    }
    this.providers.set(provider.info.id, provider);
    this.states.set(provider.info.id, provider.state);
  }

  get(id: string): ProviderJob {
    const provider = this.providers.get(id);
    if (!provider) {
      throw new ProviderNotFoundError(id);
    }
    return provider;
  }

  getAll(): readonly ProviderJob[] {
    return Array.from(this.providers.values());
  }

  getState(id: string): ProviderState | undefined {
    return this.states.get(id);
  }

  getAllStates(): ProviderState[] {
    return Array.from(this.states.values());
  }

  getByCapability<K extends keyof ProviderCapabilities>(
    capability: K,
    value?: ProviderCapabilities[K],
  ): ProviderJob[] {
    return this.getAll().filter((p) => {
      if (value !== undefined) {
        return p.capabilities[capability] === value;
      }
      return Boolean(p.capabilities[capability]);
    });
  }

  async initializeAll(configs: Map<string, Record<string, string>>): Promise<void> {
    const initPromises = this.getAll()
      .filter((p) => !this.initialized.has(p.info.id))
      .map(async (provider) => {
        const credentials = configs.get(provider.info.id);
        await provider.initialize({ credentials });
        this.initialized.add(provider.info.id);
      });

    await Promise.allSettled(initPromises);
  }

  async disposeAll(): Promise<void> {
    const disposePromises = this.getAll()
      .filter((p) => this.initialized.has(p.info.id))
      .map(async (provider) => {
        await provider.dispose();
        this.initialized.delete(provider.info.id);
      });

    await Promise.allSettled(disposePromises);
  }

  isReady(id: string): boolean {
    return this.providers.has(id) && this.initialized.has(id);
  }
}

export class ProviderNotFoundError extends Error {
  constructor(providerId: string) {
    super(`Provider '${providerId}' not found in registry`);
    this.name = 'ProviderNotFoundError';
  }
}
