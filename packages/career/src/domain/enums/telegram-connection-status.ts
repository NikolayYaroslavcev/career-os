export const TelegramConnectionStatus = {
  ACTIVE: 'ACTIVE',
  REVOKED: 'REVOKED',
} as const;

export type TelegramConnectionStatus = (typeof TelegramConnectionStatus)[keyof typeof TelegramConnectionStatus];
