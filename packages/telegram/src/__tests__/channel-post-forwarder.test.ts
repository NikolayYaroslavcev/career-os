import { describe, it, expect, vi } from 'vitest';
import type { Telegraf } from 'telegraf';
import { registerChannelPostForwarder } from '../channel-post-forwarder.js';
import type { ChannelPostCandidate } from '../channel-post-forwarder.js';

type OnHandler = (ctx: Record<string, unknown>) => void;

function buildFakeBot() {
  const handlers = new Map<string, OnHandler>();

  const bot = {
    on: vi.fn((event: string, handler: OnHandler) => {
      handlers.set(event, handler);
    }),
  };

  return {
    bot: bot as unknown as Telegraf,
    triggerChannelPost: (ctx: Record<string, unknown>) => handlers.get('channel_post')!(ctx),
    triggerEditedChannelPost: (ctx: Record<string, unknown>) => handlers.get('edited_channel_post')!(ctx),
  };
}

const baseMessage = {
  message_id: 42,
  date: 1_800_000_000, // seconds since epoch
  chat: { id: -100123, username: 'remoteit', title: 'Remote IT Jobs', type: 'channel' as const },
};

describe('registerChannelPostForwarder', () => {
  it('forwards a text channel_post as a ChannelPostCandidate', () => {
    const { bot, triggerChannelPost } = buildFakeBot();
    const onPost = vi.fn();
    registerChannelPostForwarder(bot, onPost);

    triggerChannelPost({ channelPost: { ...baseMessage, text: 'We are hiring a backend developer' } });

    expect(onPost).toHaveBeenCalledTimes(1);
    const candidate = onPost.mock.calls[0]?.[0] as ChannelPostCandidate;
    expect(candidate).toMatchObject({
      sourceId: 'remoteit',
      sourceName: 'Remote IT Jobs',
      externalMessageId: '42',
      rawText: 'We are hiring a backend developer',
    });
    expect(candidate.publishedAt.getTime()).toBe(1_800_000_000 * 1000);
  });

  it('falls back to the numeric chat id when the channel has no public username', () => {
    const { bot, triggerChannelPost } = buildFakeBot();
    const onPost = vi.fn();
    registerChannelPostForwarder(bot, onPost);

    triggerChannelPost({ channelPost: { ...baseMessage, chat: { id: -100999, title: 'Private Jobs', type: 'channel' as const }, text: 'Hiring now' } });

    expect(onPost).toHaveBeenCalledWith(expect.objectContaining({ sourceId: '-100999' }));
  });

  it('uses caption text for media posts that have no plain text field', () => {
    const { bot, triggerChannelPost } = buildFakeBot();
    const onPost = vi.fn();
    registerChannelPostForwarder(bot, onPost);

    triggerChannelPost({ channelPost: { ...baseMessage, caption: 'Hiring a designer, see photo' } });

    expect(onPost).toHaveBeenCalledWith(expect.objectContaining({ rawText: 'Hiring a designer, see photo' }));
  });

  it('extracts URL entities into links', () => {
    const { bot, triggerChannelPost } = buildFakeBot();
    const onPost = vi.fn();
    registerChannelPostForwarder(bot, onPost);
    const text = 'Apply at https://example.com/jobs now';

    triggerChannelPost({
      channelPost: {
        ...baseMessage,
        text,
        entities: [{ type: 'url', offset: text.indexOf('https://'), length: 'https://example.com/jobs'.length }],
      },
    });

    expect(onPost).toHaveBeenCalledWith(expect.objectContaining({ links: ['https://example.com/jobs'] }));
  });

  it('extracts text_link entity urls (hidden behind display text)', () => {
    const { bot, triggerChannelPost } = buildFakeBot();
    const onPost = vi.fn();
    registerChannelPostForwarder(bot, onPost);
    const text = 'Apply here';

    triggerChannelPost({
      channelPost: {
        ...baseMessage,
        text,
        entities: [{ type: 'text_link', offset: 0, length: text.length, url: 'https://example.com/apply' }],
      },
    });

    expect(onPost).toHaveBeenCalledWith(expect.objectContaining({ links: ['https://example.com/apply'] }));
  });

  it('silently skips posts with neither text nor caption (e.g. a bare photo)', () => {
    const { bot, triggerChannelPost } = buildFakeBot();
    const onPost = vi.fn();
    registerChannelPostForwarder(bot, onPost);

    triggerChannelPost({ channelPost: { ...baseMessage } });

    expect(onPost).not.toHaveBeenCalled();
  });

  it('forwards edited_channel_post the same way as channel_post', () => {
    const { bot, triggerEditedChannelPost } = buildFakeBot();
    const onPost = vi.fn();
    registerChannelPostForwarder(bot, onPost);

    triggerEditedChannelPost({ editedChannelPost: { ...baseMessage, text: 'Updated: now hiring 2 developers' } });

    expect(onPost).toHaveBeenCalledWith(expect.objectContaining({ rawText: 'Updated: now hiring 2 developers' }));
  });
});
