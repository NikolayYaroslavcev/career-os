// Telegram bot integration
export type { TelegramClient, TelegramSendResult } from './telegram-client.js';
export { TelegramAdapter } from './telegram-adapter.js';
export type { TelegramAdapterOptions } from './telegram-adapter.js';
export { InMemoryTelegramClient } from './in-memory-telegram-client.js';
export type { RecordedTelegramMessage } from './in-memory-telegram-client.js';
export { registerTelegramLinkingBot } from './telegram-linking-bot.js';
export type { LinkingCommandHandler, LinkingCommandInput, LinkingCommandResult } from './telegram-linking-bot.js';

