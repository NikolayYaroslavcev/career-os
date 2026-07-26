import { z } from 'zod';

export const extensionSettingsSchema = z.object({
  backend: z.object({
    url: z.string().url().default('http://localhost:3000'),
    dashboardUrl: z.string().url().default('http://localhost:3001'),
  }),
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  providers: z.object({
    enabled: z.array(z.string()).default([
      'linkedin', 'hh', 'greenhouse', 'lever', 'ashby',
      'workday', 'teamtailor', 'smartrecruiters', 'recruitee',
      'generic',
    ]),
  }).default({}),
  ai: z.object({
    mode: z.enum(['manual']).default('manual'),
  }).default({ mode: 'manual' as const }),
  notifications: z.object({
    enabled: z.boolean().default(true),
    watchedCompanies: z.boolean().default(true),
    aiCompleted: z.boolean().default(true),
    interviewReminders: z.boolean().default(true),
    followUps: z.boolean().default(true),
  }).default({}),
  privacy: z.object({
    collectAnalytics: z.boolean().default(false),
    activateOnAllPages: z.boolean().default(false),
  }).default({}),
  panel: z.object({
    position: z.object({
      top: z.number().default(20),
      right: z.number().default(20),
    }).default({ top: 20, right: 20 }),
    autoCollapse: z.boolean().default(true),
    collapseAfterMs: z.number().default(5000),
  }).default({}),
});

export type ExtensionSettings = z.infer<typeof extensionSettingsSchema>;

export const defaultSettings: ExtensionSettings = extensionSettingsSchema.parse({});
