import { describe, it, expect } from 'vitest';
import { formatShortDate } from './format';

describe('formatShortDate', () => {
  // Local Date (not a UTC string) so the assertion isn't sensitive to the
  // test runner's timezone offset shifting the calendar day.
  const date = new Date(2026, 7, 6);

  it('formats in English regardless of the host environment default locale', () => {
    expect(formatShortDate(date, 'en')).toBe('Aug 6');
  });

  it('formats in Russian when the app locale is ru, instead of leaking the host locale', () => {
    expect(formatShortDate(date, 'ru')).toBe('6 авг.');
  });
});
