import { createHash } from 'node:crypto';

export interface MessageExtractionCacheKeyInput {
  readonly contentHash: string;
  readonly provider: string;
  readonly model: string;
  readonly promptChecksum: string;
}

/**
 * Distinct from computePromptHash (cache/prompt-hash.ts) — that one hashes
 * the fully-built prompt text, which for this engine already embeds the raw
 * message content. This key is computed instead of reused so the cache-key
 * contract for MessageExtractionEngine is explicit and independently
 * testable: same message content + same provider/model + same prompt version
 * always resolves to the same cache entry, regardless of how the prompt text
 * itself is assembled.
 */
export function computeMessageExtractionCacheKey(input: MessageExtractionCacheKeyInput): string {
  const payload = JSON.stringify({
    contentHash: input.contentHash,
    provider: input.provider,
    model: input.model,
    promptChecksum: input.promptChecksum,
  });

  return createHash('sha256').update(payload).digest('hex');
}
