import { Telegraf } from 'telegraf';
import type { TelegramClient, TelegramSendResult } from './telegram-client.js';

export interface TelegramAdapterOptions {
  readonly botToken: string;
  readonly parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML';
}

/**
 * Sole point of contact with the Telegram Bot API. Given a chat id and
 * already-formatted text, delivers it and reports the outcome — nothing
 * here decides *what* the message says.
 */
export class TelegramAdapter implements TelegramClient {
  private readonly bot: Telegraf;
  private readonly parseMode: 'Markdown' | 'MarkdownV2' | 'HTML';

  constructor(options: TelegramAdapterOptions) {
    this.bot = new Telegraf(options.botToken);
    this.parseMode = options.parseMode ?? 'Markdown';
  }

  async send(chatId: string, text: string): Promise<TelegramSendResult> {
    try {
      const message = await this.bot.telegram.sendMessage(chatId, text, {
        parse_mode: this.parseMode,
      });
      return { success: true, messageId: message.message_id };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
