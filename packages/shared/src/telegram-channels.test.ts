import { describe, it, expect } from 'vitest';
import {
  parseTelegramChannelList,
  isValidTelegramChannelUsername,
  validateTelegramChannelUsername,
  InvalidTelegramChannelUsernameError,
} from './telegram-channels.js';

describe('parseTelegramChannelList', () => {
  it('returns an empty array for undefined/empty input', () => {
    expect(parseTelegramChannelList(undefined)).toEqual([]);
    expect(parseTelegramChannelList('')).toEqual([]);
  });

  it('splits, trims, and strips @ and t.me/ prefixes', () => {
    expect(parseTelegramChannelList(' @remoteit, https://t.me/geekjobs , job_python ')).toEqual([
      'remoteit',
      'geekjobs',
      'job_python',
    ]);
  });

  it('filters out empty entries from trailing commas', () => {
    expect(parseTelegramChannelList('remoteit,,geekjobs,')).toEqual(['remoteit', 'geekjobs']);
  });
});

describe('isValidTelegramChannelUsername', () => {
  it('accepts a well-formed username', () => {
    expect(isValidTelegramChannelUsername('remoteit')).toBe(true);
    expect(isValidTelegramChannelUsername('job_python')).toBe(true);
  });

  it('rejects a username that is too short', () => {
    expect(isValidTelegramChannelUsername('abcd')).toBe(false);
  });

  it('rejects a username starting with a digit or underscore', () => {
    expect(isValidTelegramChannelUsername('1channel')).toBe(false);
    expect(isValidTelegramChannelUsername('_channel')).toBe(false);
  });

  it('rejects a leftover @ or URL fragment', () => {
    expect(isValidTelegramChannelUsername('@remoteit')).toBe(false);
    expect(isValidTelegramChannelUsername('t.me/remoteit')).toBe(false);
  });
});

describe('validateTelegramChannelUsername', () => {
  it('does not throw for a valid username', () => {
    expect(() => validateTelegramChannelUsername('remoteit')).not.toThrow();
  });

  it('throws InvalidTelegramChannelUsernameError for an invalid username', () => {
    expect(() => validateTelegramChannelUsername('@bad')).toThrow(InvalidTelegramChannelUsernameError);
  });
});
