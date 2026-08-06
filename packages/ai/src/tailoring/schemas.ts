import { z } from 'zod';

/**
 * zod schemas validating raw LLM JSON output before it's trusted anywhere in
 * the tailoring pipeline (ADR-031 Phase 10) — replaces the manual
 * `String(x || '')` / `Array.isArray(x)` coercion pattern used by the older
 * ai-orchestrator job handlers.
 */

export const vacancyRequirementsResultSchema = z.object({
  seniority: z.string().default(''),
  requiredSkills: z.array(z.string()).default([]),
  preferredSkills: z.array(z.string()).default([]),
  responsibilities: z.array(z.string()).default([]),
  atsKeywords: z.array(z.string()).default([]),
  technologies: z.array(z.string()).default([]),
  softSkills: z.array(z.string()).default([]),
  domain: z.string().default(''),
  industry: z.string().default(''),
  education: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
  languageRequirements: z.array(z.string()).default([]),
});

export const tailoringGenerationResultSchema = z.object({
  optimizedSummary: z.string().default(''),
  reorderedExperience: z
    .array(
      z.object({
        sourceJobIndex: z.number().int().default(-1),
        company: z.string().default(''),
        position: z.string().default(''),
        bullets: z
          .array(
            z.object({
              text: z.string(),
              sourceBulletIndex: z.number().int().default(-1),
            }),
          )
          .default([]),
        technologies: z.array(z.string()).default([]),
        relevanceScore: z.number().min(0).max(100).default(0),
      }),
    )
    .default([]),
  emphasizedSkills: z.array(z.string()).default([]),
  keywordOptimizations: z.array(z.string()).default([]),
});

export const tailoringReviewResultSchema = z.object({
  bulletChecks: z
    .array(
      z.object({
        jobIndex: z.number().int(),
        bulletIndex: z.number().int(),
        supported: z.boolean(),
        reason: z.string().optional(),
      }),
    )
    .default([]),
  flaggedEntities: z
    .array(
      z.object({
        text: z.string(),
        type: z.string(),
        reason: z.string(),
      }),
    )
    .default([]),
  overallRisk: z.enum(['low', 'medium', 'high']).default('low'),
});

/** Extracts the first fenced or bare JSON object from an LLM response. */
export function extractJsonObject(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const jsonText = fenced?.[1] ?? content.match(/\{[\s\S]*\}/)?.[0];
  if (!jsonText) {
    throw new Error('No JSON object found in AI response');
  }
  return JSON.parse(jsonText);
}
