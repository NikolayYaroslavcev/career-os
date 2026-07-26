import { extensionSettingsSchema } from '../types/settings.js';

export { extensionSettingsSchema };

export function validateSettings(data: unknown) {
  return extensionSettingsSchema.safeParse(data);
}

export function parseSettings(data: unknown) {
  return extensionSettingsSchema.parse(data);
}
