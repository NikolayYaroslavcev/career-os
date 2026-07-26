import type { Telegraf } from 'telegraf';

export interface LinkingCommandInput {
  readonly code: string;
  readonly telegramChatId: string;
  readonly telegramUsername?: string;
}

/** Outcome modeled as a discriminated union so the bot layer never has to guess what to say — the handler always supplies the reply text. */
export type LinkingCommandResult =
  | { readonly success: true; readonly message: string }
  | { readonly success: false; readonly message: string };

/**
 * The one use-case the bot layer is allowed to call into. Implemented by the
 * application service (outside this package) — this interface exists purely
 * so the bot can depend on an abstraction instead of the concrete service.
 */
export interface LinkingCommandHandler {
  handleLinkCommand(input: LinkingCommandInput): Promise<LinkingCommandResult>;
}

const WELCOME_MESSAGE =
  'Welcome to CareerOS! Generate a linking code from your dashboard, then send /start <code> or /link <code> here.';
const MISSING_CODE_MESSAGE = 'Usage: /link <code>';

/**
 * Registers the /start and /link commands. This is the entire surface of the
 * bot's linking responsibility: parse the incoming command, forward the code
 * and chat identity to the handler, relay its reply. No expiry, single-use,
 * or duplicate-account logic lives here — that's the handler's job.
 */
export function registerTelegramLinkingBot(bot: Telegraf, handler: LinkingCommandHandler): void {
  bot.start(async (ctx) => {
    const code = ctx.startPayload?.trim();

    if (!code) {
      await ctx.reply(WELCOME_MESSAGE);
      return;
    }

    const result = await handler.handleLinkCommand({
      code,
      telegramChatId: String(ctx.from.id),
      telegramUsername: ctx.from.username,
    });

    await ctx.reply(result.message);
  });

  bot.command('link', async (ctx) => {
    const code = ctx.message.text.split(' ')[1]?.trim();

    if (!code) {
      await ctx.reply(MISSING_CODE_MESSAGE);
      return;
    }

    const result = await handler.handleLinkCommand({
      code,
      telegramChatId: String(ctx.from.id),
      telegramUsername: ctx.from.username,
    });

    await ctx.reply(result.message);
  });
}
