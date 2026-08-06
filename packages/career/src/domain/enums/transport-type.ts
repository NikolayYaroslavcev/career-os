/**
 * How a SocialMessage was fetched. Platform-agnostic — not every platform will
 * support every value (e.g. MTPROTO/EXPORT are Telegram-only reserved kinds),
 * but the type itself must not be named after any one platform since Discord/
 * Slack/Reddit transports will produce SocialMessage rows through this same enum.
 */
export const TransportType = {
  HTML_PREVIEW: 'HTML_PREVIEW',
  BOT_API: 'BOT_API',
  MTPROTO: 'MTPROTO',
  EXPORT: 'EXPORT',
} as const;

export type TransportType = (typeof TransportType)[keyof typeof TransportType];
