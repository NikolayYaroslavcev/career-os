/**
 * Single source of truth for parsing the TELEGRAM_CHANNELS env var and for
 * validating a bare channel username. Previously duplicated independently in
 * apps/backend/src/container.ts (resolveTelegramChannelSource) and
 * ProviderManagementService.getTelegramChannelsForFetcher() — both now call
 * this instead of re-declaring the same trim/strip-prefix/filter logic.
 */
export function parseTelegramChannelList(envValue: string | undefined | null): string[] {
  if (!envValue) return [];
  return envValue
    .split(',')
    .map((c) => c.trim().replace(/^@/, '').replace(/^https?:\/\/t\.me\//i, ''))
    .filter(Boolean);
}

/**
 * Telegram bare usernames are 5-32 chars, start with a letter, and contain
 * only letters/digits/underscores (https://core.telegram.org/method/account.checkUsername).
 * Rejecting anything else at write time catches a stray `@`, a pasted `t.me/...`
 * URL fragment, or a typo before it's silently scraped as a dead channel.
 */
const TELEGRAM_USERNAME_PATTERN = /^[A-Za-z]\w{4,31}$/;

export function isValidTelegramChannelUsername(username: string): boolean {
  return TELEGRAM_USERNAME_PATTERN.test(username);
}

export class InvalidTelegramChannelUsernameError extends Error {
  constructor(readonly username: string) {
    super(`Invalid Telegram channel username "${username}": must be 5-32 characters, start with a letter, and contain only letters, digits, and underscores`);
    this.name = 'InvalidTelegramChannelUsernameError';
  }
}

export function validateTelegramChannelUsername(username: string): void {
  if (!isValidTelegramChannelUsername(username)) {
    throw new InvalidTelegramChannelUsernameError(username);
  }
}
