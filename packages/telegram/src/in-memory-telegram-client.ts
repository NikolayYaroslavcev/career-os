import type { TelegramClient, TelegramSendResult } from './telegram-client.js';

export interface RecordedTelegramMessage {
  readonly chatId: string;
  readonly text: string;
  readonly sentAt: Date;
}

/**
 * Network-free stand-in for TelegramAdapter — records sent messages instead
 * of calling the Bot API. Used by tests and by `pnpm demo:digest` (which has
 * no bot token) to preview what would be delivered.
 */
export class InMemoryTelegramClient implements TelegramClient {
  private readonly messages: RecordedTelegramMessage[] = [];
  private nextMessageId = 1;

  async send(chatId: string, text: string): Promise<TelegramSendResult> {
    this.messages.push({ chatId, text, sentAt: new Date() });
    return { success: true, messageId: this.nextMessageId++ };
  }

  getSentMessages(): readonly RecordedTelegramMessage[] {
    return [...this.messages];
  }

  reset(): void {
    this.messages.length = 0;
    this.nextMessageId = 1;
  }
}
