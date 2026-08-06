import type { MessageExtraction } from './message-extraction.js';

export interface MessageExtractionRepository {
  /** Every call inserts a new row — MessageExtraction is an append-only history, never overwritten (see schema.prisma comment on the model). */
  save(extraction: MessageExtraction): Promise<MessageExtraction>;
  findById(id: string): Promise<MessageExtraction | null>;
  /** Full extraction history for a message, newest first. */
  findByMessageId(messageId: string): Promise<readonly MessageExtraction[]>;
  findLatestByMessageId(messageId: string): Promise<MessageExtraction | null>;
  /**
   * The engine's idempotency check: an exact replay of the same message
   * content against the same (provider, model, promptChecksum) tuple must
   * reuse the existing row instead of calling the AI provider again or
   * writing a duplicate.
   */
  findByContentHashAndPrompt(
    contentHash: string,
    provider: string,
    model: string,
    promptChecksum: string,
  ): Promise<MessageExtraction | null>;
}
