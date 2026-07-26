/** Outcome of a single send attempt. Modeled as a discriminated union so callers must branch on `success` before touching `messageId`/`error`. */
export type TelegramSendResult =
  | { readonly success: true; readonly messageId: number }
  | { readonly success: false; readonly error: string };

/**
 * Pure communication port to Telegram. Implementations must not make
 * formatting or business decisions — they only deliver text that has
 * already been prepared by the caller.
 */
export interface TelegramClient {
  send(chatId: string, text: string): Promise<TelegramSendResult>;
}
