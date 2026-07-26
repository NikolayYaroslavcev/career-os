import { z } from 'zod';

export const contentVacancySalarySchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  currency: z.string(),
  period: z.enum(['hourly', 'monthly', 'yearly']),
});

export const contentVacancySchema = z.object({
  provider: z.string(),
  externalId: z.string(),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string(),
  salary: contentVacancySalarySchema.optional(),
  experienceLevel: z.enum(['intern', 'junior', 'middle', 'senior', 'lead', 'principal']).optional(),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'freelance', 'internship']).optional(),
  remote: z.enum(['remote_only', 'hybrid', 'onsite', 'unknown']).optional(),
  technologies: z.array(z.string()),
  description: z.string(),
  requirements: z.array(z.string()),
  url: z.string().url(),
  publishedAt: z.string().optional(),
  extractedAt: z.string(),
  contentHash: z.string(),
});

export type ValidatedContentVacancy = z.infer<typeof contentVacancySchema>;

export function validateContentVacancy(data: unknown): ValidatedContentVacancy | null {
  const result = contentVacancySchema.safeParse(data);
  return result.success ? result.data : null;
}
