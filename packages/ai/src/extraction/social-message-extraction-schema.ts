import { z } from 'zod';

/**
 * Shape of MessageExtraction.extractedFields (packages/database/prisma/schema.prisma).
 * Defined now — ahead of the extraction engine itself (EPIC-12 Phase 4) — so that
 * whatever produces this JSON later is designed from day one to map cleanly onto
 * the existing `NormalizedVacancy` contract (packages/providers/src/interfaces/
 * normalized-vacancy.ts). That's what lets a future Telegram-V2 Normalizer feed
 * the *same* dedup/persistence pipeline every other provider already uses,
 * instead of a second bespoke one. See ADR-032.
 *
 * `salaryMin`/`salaryMax`/`currency`/`country`/`city`/`category`/`seniority`/
 * `remoteType`/`company`/`title` are intentionally mirrored as top-level
 * MessageExtraction columns for querying — this schema is the source of truth
 * for their shape.
 */
export const extractedVacancyFieldsSchema = z.object({
  company: z.string().nullable().default(null),
  title: z.string().nullable().default(null),
  technologies: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  seniority: z.string().nullable().default(null),
  salaryMin: z.number().int().nullable().default(null),
  salaryMax: z.number().int().nullable().default(null),
  currency: z.string().nullable().default(null),
  country: z.string().nullable().default(null),
  city: z.string().nullable().default(null),
  employmentType: z.string().nullable().default(null),
  remoteType: z.string().nullable().default(null),
  contact: z.string().nullable().default(null),
  recruiter: z.string().nullable().default(null),
  links: z.array(z.string()).default([]),
  atsKeywords: z.array(z.string()).default([]),
  responsibilities: z.array(z.string()).default([]),
  requirements: z.array(z.string()).default([]),
  category: z.string().nullable().default(null),
  /** Per-field source spans/quotes from rawText — what deterministic confidence scoring is rubric-scored against. */
  evidence: z.record(z.string(), z.string()).default({}),
});

export type ExtractedVacancyFields = z.infer<typeof extractedVacancyFieldsSchema>;
