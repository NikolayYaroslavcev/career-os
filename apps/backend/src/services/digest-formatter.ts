import type { Digest } from './digest-builder.js';

/**
 * Renders a channel-agnostic Digest into a channel-specific payload.
 * Telegram/email/push/dashboard formatters all implement this against the
 * same Digest shape, so DigestBuilder never has to know about any of them.
 */
export interface DigestFormatter<TOutput> {
  format(digest: Digest): TOutput;
}
