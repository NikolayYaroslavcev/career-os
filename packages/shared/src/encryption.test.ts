import { describe, it, expect, beforeEach } from 'vitest';
import {
  EncryptionService,
  getEncryptionService,
  resetEncryptionService,
  validateEncryptionConfig,
} from './encryption.js';

describe('EncryptionService', () => {
  const validKey = 'a'.repeat(64);

  beforeEach(() => {
    resetEncryptionService();
    process.env.MASTER_ENCRYPTION_KEY = validKey;
    delete process.env.ALLOW_UNENCRYPTED_PROVIDER_KEYS;
    delete process.env.NODE_ENV;
  });

  describe('constructor', () => {
    it('throws if no key provided', () => {
      expect(() => new EncryptionService('')).toThrow('MASTER_ENCRYPTION_KEY is required');
    });

    it('throws if key is wrong length', () => {
      expect(() => new EncryptionService('abc')).toThrow(
        'MASTER_ENCRYPTION_KEY must be 64 hex characters',
      );
    });

    it('throws if key contains non-hex characters', () => {
      expect(() => new EncryptionService('g'.repeat(64))).toThrow(
        'MASTER_ENCRYPTION_KEY must be a valid hex string',
      );
    });

    it('accepts valid 64 hex character key', () => {
      expect(() => new EncryptionService(validKey)).not.toThrow();
    });

    it('accepts config object', () => {
      expect(
        () => new EncryptionService({ masterKeyHex: validKey, keyId: 'test-key' }),
      ).not.toThrow();
    });

    it('defaults keyId to primary', () => {
      const service = new EncryptionService(validKey);
      expect(service.getKeyId()).toBe('primary');
    });

    it('uses custom keyId', () => {
      const service = new EncryptionService({ masterKeyHex: validKey, keyId: 'custom-2026' });
      expect(service.getKeyId()).toBe('custom-2026');
    });

    it('defaults allowUnencrypted to false', () => {
      const service = new EncryptionService(validKey);
      expect(service.isAllowUnencrypted()).toBe(false);
    });

    it('respects allowUnencrypted option', () => {
      const service = new EncryptionService({ masterKeyHex: validKey, allowUnencrypted: true });
      expect(service.isAllowUnencrypted()).toBe(true);
    });
  });

  describe('encrypt/decrypt', () => {
    it('encrypts and decrypts plaintext', () => {
      const service = new EncryptionService(validKey);
      const plaintext = 'sk-1234567890abcdef';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('produces different ciphertext for same input (random IV)', () => {
      const service = new EncryptionService(validKey);
      const plaintext = 'test-key';
      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('handles empty string', () => {
      const service = new EncryptionService(validKey);
      const encrypted = service.encrypt('');
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe('');
    });

    it('handles long strings', () => {
      const service = new EncryptionService(validKey);
      const plaintext = 'x'.repeat(10000);
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('handles special characters', () => {
      const service = new EncryptionService(validKey);
      const plaintext = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('handles unicode', () => {
      const service = new EncryptionService(validKey);
      const plaintext = 'Hello 世界 🌍';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('includes keyId in encrypted payload', () => {
      const service = new EncryptionService({ masterKeyHex: validKey, keyId: 'master-2026-07' });
      const encrypted = service.encrypt('test');
      const payload = JSON.parse(
        Buffer.from(encrypted.slice('enc:v1:'.length), 'base64').toString('utf8'),
      );
      expect(payload.kid).toBe('master-2026-07');
    });
  });

  describe('isEncrypted', () => {
    it('returns true for encrypted values', () => {
      const service = new EncryptionService(validKey);
      const encrypted = service.encrypt('test');
      expect(service.isEncrypted(encrypted)).toBe(true);
    });

    it('returns false for plaintext', () => {
      const service = new EncryptionService(validKey);
      expect(service.isEncrypted('sk-1234')).toBe(false);
    });

    it('returns false for empty string', () => {
      const service = new EncryptionService(validKey);
      expect(service.isEncrypted('')).toBe(false);
    });
  });

  describe('decryption errors', () => {
    it('throws on invalid format', () => {
      const service = new EncryptionService(validKey);
      expect(() => service.decrypt('not-encrypted')).toThrow('Invalid encrypted value format');
    });

    it('throws on wrong key', () => {
      const service1 = new EncryptionService(validKey);
      const service2 = new EncryptionService('b'.repeat(64));
      const encrypted = service1.encrypt('test');
      expect(() => service2.decrypt(encrypted)).toThrow();
    });

    it('throws on corrupted ciphertext', () => {
      const service = new EncryptionService(validKey);
      const encrypted = service.encrypt('test');
      const corrupted = encrypted.slice(0, -10) + 'XXXXXXXXXX';
      expect(() => service.decrypt(corrupted)).toThrow();
    });

    it('throws on tampered auth tag', () => {
      const service = new EncryptionService(validKey);
      const encrypted = service.encrypt('test');
      const parts = encrypted.split('.');
      const lastPart = parts[parts.length - 1]!;
      const tampered = lastPart.slice(0, -4) + 'AAAA';
      const tamperedEncrypted = parts.slice(0, -1).join('.') + '.' + tampered;
      expect(() => service.decrypt(tamperedEncrypted)).toThrow();
    });
  });

  describe('getEncryptionService', () => {
    it('returns singleton instance', () => {
      const service1 = getEncryptionService();
      const service2 = getEncryptionService();
      expect(service1).toBe(service2);
    });

    it('throws if MASTER_ENCRYPTION_KEY not set', () => {
      delete process.env.MASTER_ENCRYPTION_KEY;
      resetEncryptionService();
      expect(() => getEncryptionService()).toThrow('MASTER_ENCRYPTION_KEY environment variable is required');
    });

    it('resets singleton', () => {
      const service1 = getEncryptionService();
      resetEncryptionService();
      const service2 = getEncryptionService();
      expect(service1).not.toBe(service2);
    });

    it('respects ALLOW_UNENCRYPTED_PROVIDER_KEYS', () => {
      process.env.ALLOW_UNENCRYPTED_PROVIDER_KEYS = 'true';
      resetEncryptionService();
      const service = getEncryptionService();
      expect(service.isAllowUnencrypted()).toBe(true);
    });
  });

  describe('validateEncryptionConfig', () => {
    it('throws if MASTER_ENCRYPTION_KEY not set', () => {
      delete process.env.MASTER_ENCRYPTION_KEY;
      expect(() => validateEncryptionConfig()).toThrow('MASTER_ENCRYPTION_KEY environment variable is required');
    });

    it('throws if key is not valid hex', () => {
      process.env.MASTER_ENCRYPTION_KEY = 'xyz';
      expect(() => validateEncryptionConfig()).toThrow('valid hex string');
    });

    it('throws if key is wrong length', () => {
      process.env.MASTER_ENCRYPTION_KEY = 'abc';
      expect(() => validateEncryptionConfig()).toThrow('64 hex characters');
    });

    it('throws if production mode with allowUnencrypted', () => {
      process.env.NODE_ENV = 'production';
      process.env.MASTER_ENCRYPTION_KEY = validKey;
      process.env.ALLOW_UNENCRYPTED_PROVIDER_KEYS = 'true';
      expect(() => validateEncryptionConfig()).toThrow('not permitted in production');
    });

    it('passes with valid config in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.MASTER_ENCRYPTION_KEY = validKey;
      expect(() => validateEncryptionConfig()).not.toThrow();
    });

    it('passes with valid config in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.MASTER_ENCRYPTION_KEY = validKey;
      delete process.env.ALLOW_UNENCRYPTED_PROVIDER_KEYS;
      expect(() => validateEncryptionConfig()).not.toThrow();
    });
  });

  describe('backward compatibility', () => {
    it('v1 format can be decrypted', () => {
      const service = new EncryptionService(validKey);
      const encrypted = service.encrypt('test');
      expect(encrypted).toMatch(/^enc:v1:/);
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe('test');
    });

    it('v1 format with keyId can be decrypted', () => {
      const service = new EncryptionService({ masterKeyHex: validKey, keyId: 'master-2026-07' });
      const encrypted = service.encrypt('test');
      expect(encrypted).toMatch(/^enc:v1:/);
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe('test');
    });
  });
});
