import { describe, it, expect } from 'vitest';
import { Url } from './url.js';

describe('Url', () => {
  it('should create a valid URL', () => {
    const url = Url.create('https://example.com');
    expect(url.value).toBe('https://example.com');
  });

  it('should extract hostname', () => {
    const url = Url.create('https://www.example.com/path/to/page');
    expect(url.hostname).toBe('www.example.com');
  });

  it('should extract pathname', () => {
    const url = Url.create('https://example.com/path/to/page');
    expect(url.pathname).toBe('/path/to/page');
  });

  it('should return root path for base URL', () => {
    const url = Url.create('https://example.com');
    expect(url.pathname).toBe('/');
  });

  it('should throw on empty URL', () => {
    expect(() => Url.create('')).toThrow('URL cannot be empty');
  });

  it('should throw on invalid format', () => {
    expect(() => Url.create('not-a-url')).toThrow('Invalid URL format');
    expect(() => Url.create('ftp://example.com')).toThrow('Invalid URL format');
  });

  it('should throw on too long URL', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(2050);
    expect(() => Url.create(longUrl)).toThrow('URL is too long');
  });

  it('should trim whitespace', () => {
    const url = Url.create('  https://example.com  ');
    expect(url.value).toBe('https://example.com');
  });

  it('should implement equals correctly', () => {
    const url1 = Url.create('https://example.com');
    const url2 = Url.create('https://example.com');
    const url3 = Url.create('https://other.com');

    expect(url1.equals(url2)).toBe(true);
    expect(url1.equals(url3)).toBe(false);
  });

  it('should convert to string', () => {
    const url = Url.create('https://example.com');
    expect(url.toString()).toBe('https://example.com');
  });
});
