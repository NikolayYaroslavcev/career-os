import { describe, it, expect, vi } from 'vitest';
import type { Telegraf } from 'telegraf';
import { registerTelegramLinkingBot } from '../telegram-linking-bot.js';
import type { LinkingCommandHandler, LinkingCommandResult } from '../telegram-linking-bot.js';

type StartHandler = (ctx: { startPayload?: string; from: { id: number; username?: string }; reply: (text: string) => Promise<void> }) => Promise<void>;
type CommandHandler = (ctx: { message: { text: string }; from: { id: number; username?: string }; reply: (text: string) => Promise<void> }) => Promise<void>;

function buildFakeBot() {
  let startHandler: StartHandler | undefined;
  let linkCommandHandler: CommandHandler | undefined;

  const bot = {
    start: vi.fn((handler: StartHandler) => {
      startHandler = handler;
    }),
    command: vi.fn((name: string, handler: CommandHandler) => {
      if (name === 'link') linkCommandHandler = handler;
    }),
  };

  return {
    bot: bot as unknown as Telegraf,
    triggerStart: (ctx: Parameters<StartHandler>[0]) => startHandler!(ctx),
    triggerLink: (ctx: Parameters<CommandHandler>[0]) => linkCommandHandler!(ctx),
  };
}

function buildHandler(result: LinkingCommandResult): LinkingCommandHandler {
  return { handleLinkCommand: vi.fn().mockResolvedValue(result) };
}

describe('registerTelegramLinkingBot', () => {
  it('replies with a welcome message when /start has no payload, without calling the handler', async () => {
    const { bot, triggerStart } = buildFakeBot();
    const handler = buildHandler({ success: true, message: 'unused' });
    registerTelegramLinkingBot(bot, handler);
    const reply = vi.fn();

    await triggerStart({ startPayload: undefined, from: { id: 111 }, reply });

    expect(handler.handleLinkCommand).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith(expect.stringContaining('/start <code>'));
  });

  it('forwards the /start payload and chat identity to the handler, then relays its reply verbatim', async () => {
    const { bot, triggerStart } = buildFakeBot();
    const handler = buildHandler({ success: true, message: 'Linked!' });
    registerTelegramLinkingBot(bot, handler);
    const reply = vi.fn();

    await triggerStart({ startPayload: '  ABC123  ', from: { id: 111, username: 'jdoe' }, reply });

    expect(handler.handleLinkCommand).toHaveBeenCalledWith({
      code: 'ABC123',
      telegramChatId: '111',
      telegramUsername: 'jdoe',
    });
    expect(reply).toHaveBeenCalledWith('Linked!');
  });

  it('relays a failure message from the handler without throwing (no business logic in the bot layer)', async () => {
    const { bot, triggerStart } = buildFakeBot();
    const handler = buildHandler({ success: false, message: 'That code has expired.' });
    registerTelegramLinkingBot(bot, handler);
    const reply = vi.fn();

    await triggerStart({ startPayload: 'EXPIRED1', from: { id: 222 }, reply });

    expect(reply).toHaveBeenCalledWith('That code has expired.');
  });

  it('/link with no code prompts for usage without calling the handler', async () => {
    const { bot, triggerLink } = buildFakeBot();
    const handler = buildHandler({ success: true, message: 'unused' });
    registerTelegramLinkingBot(bot, handler);
    const reply = vi.fn();

    await triggerLink({ message: { text: '/link' }, from: { id: 333 }, reply });

    expect(handler.handleLinkCommand).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith('Usage: /link <code>');
  });

  it('/link <code> forwards the code and chat identity to the handler', async () => {
    const { bot, triggerLink } = buildFakeBot();
    const handler = buildHandler({ success: true, message: 'Linked!' });
    registerTelegramLinkingBot(bot, handler);
    const reply = vi.fn();

    await triggerLink({ message: { text: '/link XYZ789' }, from: { id: 444, username: 'asmith' }, reply });

    expect(handler.handleLinkCommand).toHaveBeenCalledWith({
      code: 'XYZ789',
      telegramChatId: '444',
      telegramUsername: 'asmith',
    });
    expect(reply).toHaveBeenCalledWith('Linked!');
  });
});
