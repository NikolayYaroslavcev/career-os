import { describe, it, expect } from 'vitest';
import { Email } from './email.js';

describe('Email', () => {
  it('should create a valid email', () => {
    const email = Email.create('test@example.com');
    expect(email.value).toBe('test@example.com');
  });

  it('should normalize email to lowercase', () => {
    const email = Email.create('Test@Example.COM');
    expect(email.value).toBe('test@example.com');
  });

  it('should trim whitespace', () => {
    const email = Email.create('  test@example.com  ');
    expect(email.value).toBe('test@example.com');
  });

  it('should extract domain', () => {
    const email = Email.create('user@company.org');
    expect(email.domain).toBe('company.org');
  });

  it('should extract local part', () => {
    const email = Email.create('user@company.org');
    expect(email.localPart).toBe('user');
  });

  it('should throw on empty email', () => {
    expect(() => Email.create('')).toThrow('Email cannot be empty');
  });

  it('should throw on invalid format', () => {
    expect(() => Email.create('not-an-email')).toThrow('Invalid email format');
  });

  it('should throw on email without domain', () => {
    expect(() => Email.create('user@')).toThrow('Invalid email format');
  });

  it('should throw on too long email', () => {
    const longLocal = 'a'.repeat(250);
    expect(() => Email.create(`${longLocal}@example.com`)).toThrow('Email is too long');
  });

  it('should implement equals correctly', () => {
    const email1 = Email.create('test@example.com');
    const email2 = Email.create('test@example.com');
    const email3 = Email.create('other@example.com');

    expect(email1.equals(email2)).toBe(true);
    expect(email1.equals(email3)).toBe(false);
  });

  it('should convert to string', () => {
    const email = Email.create('test@example.com');
    expect(email.toString()).toBe('test@example.com');
  });
});
