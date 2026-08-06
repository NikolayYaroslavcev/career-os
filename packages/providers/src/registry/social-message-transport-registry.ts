import type { SocialMessageTransport } from '../interfaces/social-message-transport.js';
import type { TransportCapability } from '../interfaces/transport-capability.js';

export class TransportNotFoundError extends Error {
  constructor(providerId: string, capability?: TransportCapability) {
    super(
      capability
        ? `No ${capability} transport registered for provider "${providerId}"`
        : `No transport registered for provider "${providerId}"`
    );
    this.name = 'TransportNotFoundError';
  }
}

/**
 * Dispatches transports by capability, not by provider identity — mirrors
 * ProviderRegistry.getByCapability() (registry/provider-registry.ts), applied
 * to transports instead of whole providers. A provider can register several
 * transports covering different capabilities (Telegram: PULL via HTML
 * preview, API via Bot API, STREAM via MTProto); callers ask "give me this
 * provider's API transport" rather than special-casing "if providerId ===
 * 'telegram' use HtmlPreviewTransport". Adding Discord/Slack/Reddit means
 * registering their transports here — this class never changes.
 */
export class SocialMessageTransportRegistry {
  private transports = new Map<string, SocialMessageTransport[]>();

  register(providerId: string, transport: SocialMessageTransport): void {
    const existing = this.transports.get(providerId) ?? [];
    this.transports.set(providerId, [...existing, transport]);
  }

  getForProvider(providerId: string): readonly SocialMessageTransport[] {
    return this.transports.get(providerId) ?? [];
  }

  getByCapability(capability: TransportCapability): readonly SocialMessageTransport[] {
    return Array.from(this.transports.values())
      .flat()
      .filter((transport) => transport.capability === capability);
  }

  /**
   * Resolves the transport a provider should use right now. Preference among
   * a provider's multiple transports (e.g. prefer API over PULL once a bot
   * token is configured) is expressed by registration order, not a hardcoded
   * rule here — the container decides what to register and in what order.
   */
  resolve(providerId: string, capability?: TransportCapability): SocialMessageTransport {
    const providerTransports = this.getForProvider(providerId);
    const [first] = providerTransports;

    if (!capability) {
      if (!first) throw new TransportNotFoundError(providerId);
      return first;
    }

    const match = providerTransports.find((transport) => transport.capability === capability);
    if (!match) {
      throw new TransportNotFoundError(providerId, capability);
    }
    return match;
  }
}
