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
});
