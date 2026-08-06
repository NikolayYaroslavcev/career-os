import type { Telegraf } from 'telegraf';
import type { Message } from 'telegraf/types';

/**
 * A channel post reduced to plain data — no Telegraf types leak past this
 * module, so consumers (e.g. BotApiTransport in packages/providers) never
 * need a telegraf dependency of their own.
 */
export interface ChannelPostCandidate {
  readonly sourceId: string;
  readonly sourceName?: string;
  readonly externalMessageId: string;
  readonly publishedAt: Date;
  readonly rawText: string;
  readonly links: readonly string[];
}

export type ChannelPostHandler = (post: ChannelPostCandidate) => void;

function extractText(message: Message): string {
  if ('text' in message && message.text) return message.text;
  if ('caption' in message && message.caption) return message.caption;
  return '';
}

function extractLinks(message: Message): readonly string[] {
  const entities = 'entities' in message ? message.entities : 'caption_entities' in message ? message.caption_entities : undefined;
  const text = extractText(message);
  if (!entities || !text) return [];

  const links: string[] = [];
  for (const entity of entities) {
    if (entity.type === 'url') {
      links.push(text.slice(entity.offset, entity.offset + entity.length));
    } else if (entity.type === 'text_link') {
      links.push(entity.url);
    }
  }
  return links;
}

function toChannelPostCandidate(message: Message): ChannelPostCandidate | null {
  const rawText = extractText(message);
  // Posts with no text/caption (a bare photo/sticker) carry nothing this
  // transport can produce a candidate from — silently skipped, not an error.
  if (!rawText) return null;

  const chat = message.chat;
  const sourceId = 'username' in chat && chat.username ? chat.username : String(chat.id);
  const sourceName = 'title' in chat ? chat.title : undefined;

  return {
    sourceId,
    sourceName,
    externalMessageId: String(message.message_id),
    publishedAt: new Date(message.date * 1000),
    rawText,
    links: extractLinks(message),
  };
}

/**
 * Registers `channel_post`/`edited_channel_post` listeners on an already-
 * running Telegraf bot instance — the same one apps/backend/src/app.ts
 * already constructs and launches for the linking bot — and forwards each
 * post as a plain ChannelPostCandidate. Does not call bot.launch()/bot.stop()
 * itself: this bot's polling lifecycle is owned by whoever constructed it, so
 * a second listener here never risks a competing getUpdates poller.
 */
export function registerChannelPostForwarder(bot: Telegraf, onPost: ChannelPostHandler): void {
  bot.on('channel_post', (ctx) => {
    const candidate = toChannelPostCandidate(ctx.channelPost);
    if (candidate) onPost(candidate);
  });

  bot.on('edited_channel_post', (ctx) => {
    const candidate = toChannelPostCandidate(ctx.editedChannelPost);
    if (candidate) onPost(candidate);
  });
}
