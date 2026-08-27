import { describe, it, expect } from 'vitest';
import { extensionSettingsSchema, defaultSettings } from '@careeros/extension-shared';

describe('extensionSettingsSchema', () => {
  it('parses an empty object without throwing (every top-level field must have a default)', () => {
    expect(() => extensionSettingsSchema.parse({})).not.toThrow();
  });

  it('defaultSettings.backend falls back to the local dev backend/dashboard URLs', () => {
    expect(defaultSettings.backend).toEqual({
      url: 'http://localhost:3000',
      dashboardUrl: 'http://localhost:3001',
    });
  });
});
