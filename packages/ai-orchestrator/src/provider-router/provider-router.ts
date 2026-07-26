import type { AIProvider } from '@careeros/ai';
import type { AIProviderConfigRepository } from '@careeros/database';
import type { AIFeature } from '../orchestrator-config.js';

export interface ProviderRouterConfig {
  readonly defaultProvider: string;
  readonly defaultModel?: string;
  readonly featureProviderMap?: Partial<Record<AIFeature, string>>;
}

export class ProviderRouter {
  private readonly providerConfigRepository: AIProviderConfigRepository;
  private readonly config: ProviderRouterConfig;
  private readonly providerFactory: (name: string, config?: { apiKey?: string; baseUrl?: string; model?: string }) => AIProvider;

  constructor(
    providerConfigRepository: AIProviderConfigRepository,
    config: ProviderRouterConfig,
    providerFactory: (name: string, config?: { apiKey?: string; baseUrl?: string; model?: string }) => AIProvider
  ) {
    this.providerConfigRepository = providerConfigRepository;
    this.config = config;
    this.providerFactory = providerFactory;
  }

  async resolveProvider(
    feature: AIFeature,
    userId: string,
    override?: { provider?: string; model?: string }
  ): Promise<AIProvider> {
    // Priority: override > per-feature > per-user > global default
    const providerName = override?.provider
      ?? this.config.featureProviderMap?.[feature]
      ?? this.config.defaultProvider;

    // Check for user-specific provider config
    const userConfig = await this.providerConfigRepository.findByUserAndProvider(userId, providerName);
    if (userConfig?.apiKey || userConfig?.baseUrl) {
      return this.providerFactory(providerName, {
        apiKey: userConfig.apiKey ?? undefined,
        baseUrl: userConfig.baseUrl ?? undefined,
        model: override?.model ?? userConfig.model ?? this.config.defaultModel,
      });
    }

    // Check for global provider config
    const globalConfigs = await this.providerConfigRepository.findGlobal();
    const globalConfig = globalConfigs.find(c => c.provider === providerName);
    if (globalConfig?.apiKey || globalConfig?.baseUrl) {
      return this.providerFactory(providerName, {
        apiKey: globalConfig.apiKey ?? undefined,
        baseUrl: globalConfig.baseUrl ?? undefined,
        model: override?.model ?? globalConfig.model ?? this.config.defaultModel,
      });
    }

    // Fall back to default (env-based) provider
    return this.providerFactory(providerName, {
      model: override?.model ?? this.config.defaultModel,
    });
  }

  async listProviders(userId: string): Promise<Array<{
    name: string;
    isActive: boolean;
    hasApiKey: boolean;
    hasCustomUrl: boolean;
    priority: number;
  }>> {
    const userConfigs = await this.providerConfigRepository.findByUserId(userId);
    const globalConfigs = await this.providerConfigRepository.findGlobal();

    const allProviders = new Map<string, {
      name: string;
      isActive: boolean;
      hasApiKey: boolean;
      hasCustomUrl: boolean;
      priority: number;
    }>();

    // Add global configs first
    for (const config of globalConfigs) {
      allProviders.set(config.provider, {
        name: config.provider,
        isActive: config.isActive,
        hasApiKey: !!config.apiKey,
        hasCustomUrl: !!config.baseUrl,
        priority: config.priority,
      });
    }

    // Override with user configs
    for (const config of userConfigs) {
      allProviders.set(config.provider, {
        name: config.provider,
        isActive: config.isActive,
        hasApiKey: !!config.apiKey,
        hasCustomUrl: !!config.baseUrl,
        priority: config.priority,
      });
    }

    return Array.from(allProviders.values()).sort((a, b) => b.priority - a.priority);
  }
}
