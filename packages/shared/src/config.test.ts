import { describe, it, expect, beforeEach } from 'vitest';
import { loadConfig, getConfig, resetConfig } from './config.js';

describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
    process.env.JWT_SECRET = 'test-secret-key-at-least-32-characters-long';
    resetConfig();
  });

  it('should load config with valid environment variables', () => {
    const config = loadConfig();
    expect(config).toBeDefined();
    expect(config.DATABASE_URL).toBe('postgresql://localhost:5432/test');
  });

  it('should return same config on multiple calls', () => {
    const config1 = loadConfig();
    const config2 = getConfig();
    expect(config1).toBe(config2);
  });

  it('should throw on invalid config', () => {
    delete process.env.DATABASE_URL;
    delete process.env.JWT_SECRET;
    resetConfig();
    expect(() => loadConfig()).toThrow();
  });

  describe('production secret validation', () => {
    it('rejects a well-known placeholder JWT_SECRET in production even if it is 32+ chars', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'changeme'.repeat(4);
      resetConfig();
      expect(() => loadConfig()).toThrow(/JWT_SECRET/);
    });

    it('rejects a low-entropy JWT_SECRET (e.g. a repeated character) in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'a'.repeat(40);
      resetConfig();
      expect(() => loadConfig()).toThrow(/JWT_SECRET/);
    });

    it('accepts a strong random JWT_SECRET and non-default MinIO credentials in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'K7x!pQ9zR2mN8vT5wL1cB6yH4jF3sD0g';
      process.env.MINIO_ACCESS_KEY = 'prod-access-key';
      process.env.MINIO_SECRET_KEY = 'prod-secret-key';
      resetConfig();
      expect(() => loadConfig()).not.toThrow();
    });

    it('rejects the default "minioadmin" MinIO credentials in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'K7x!pQ9zR2mN8vT5wL1cB6yH4jF3sD0g';
      process.env.MINIO_ACCESS_KEY = 'minioadmin';
      process.env.MINIO_SECRET_KEY = 'minioadmin';
      resetConfig();
      expect(() => loadConfig()).toThrow(/MINIO/);
    });

    it('does not enforce placeholder rejection outside production', () => {
      process.env.NODE_ENV = 'development';
      process.env.JWT_SECRET = 'test-secret-key-at-least-32-characters-long';
      resetConfig();
      expect(() => loadConfig()).not.toThrow();
    });
  });

  describe('AI_ENABLED', () => {
    it('defaults to true when unset', () => {
      delete process.env.AI_ENABLED;
      resetConfig();
      expect(loadConfig().AI_ENABLED).toBe(true);
    });

    it('parses the literal string "false" as false (not JS Boolean() truthy-string coercion)', () => {
      process.env.AI_ENABLED = 'false';
      resetConfig();
      expect(loadConfig().AI_ENABLED).toBe(false);
    });

    it('parses "true" as true', () => {
      process.env.AI_ENABLED = 'true';
      resetConfig();
      expect(loadConfig().AI_ENABLED).toBe(true);
    });

    it('treats a blank value the same as unset (default true)', () => {
      process.env.AI_ENABLED = '';
      resetConfig();
      expect(loadConfig().AI_ENABLED).toBe(true);
    });
  });

  describe('EPIC-17 configurable pipeline limits', () => {
    it('defaults every new pipeline knob when unset', () => {
      resetConfig();
      const config = loadConfig();

      expect(config.AI_MAX_CANDIDATES).toBe(15);
      expect(config.AI_MATCHING_CONCURRENCY).toBe(5);
      expect(config.AI_BATCH_SIZE).toBe(15);
      expect(config.PROVIDER_SEARCH_LIMIT).toBe(50);
      expect(config.PROVIDER_TIMEOUT_MS).toBe(15_000);
      expect(config.MIN_RELEVANCE_SCORE).toBe(2);
      expect(config.WORKER_CONCURRENCY).toBe(5);
      expect(config.DIAGNOSTICS_ENABLED).toBe(false);
    });

    it('reads overrides from the environment', () => {
      process.env.AI_MAX_CANDIDATES = '25';
      process.env.PROVIDER_TIMEOUT_MS = '30000';
      process.env.DIAGNOSTICS_ENABLED = 'true';
      resetConfig();

      const config = loadConfig();
      expect(config.AI_MAX_CANDIDATES).toBe(25);
      expect(config.PROVIDER_TIMEOUT_MS).toBe(30_000);
      expect(config.DIAGNOSTICS_ENABLED).toBe(true);
    });

    it('treats a blank numeric value the same as unset (uses the default, not 0)', () => {
      process.env.PROVIDER_SEARCH_LIMIT = '';
      resetConfig();
      expect(loadConfig().PROVIDER_SEARCH_LIMIT).toBe(50);
    });

    it('parses DIAGNOSTICS_ENABLED="false" as false, not JS Boolean() truthy-string coercion', () => {
      process.env.DIAGNOSTICS_ENABLED = 'false';
      resetConfig();
      expect(loadConfig().DIAGNOSTICS_ENABLED).toBe(false);
    });
  });
});
