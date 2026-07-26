import { z } from 'zod';

const salarySchema = z.object({
  min: z.number().nonnegative(),
  max: z.number().nonnegative(),
  currency: z.enum(['USD', 'EUR', 'GBP', 'UAH', 'RUB']).default('USD'),
  period: z.enum(['monthly', 'yearly', 'hourly']).default('yearly'),
});

const locationSchema = z.object({
  city: z.string().optional(),
  country: z.string().optional(),
  workMode: z.enum(['remote', 'hybrid', 'onsite']),
  isRelocationPossible: z.boolean().optional(),
});

export const CreateSearchProfileDto = z.object({
  name: z.string().min(1),
  desiredPositions: z.array(z.string()).default([]),
  desiredTechnologies: z.array(z.string()).default([]),
  experienceLevel: z.enum(['intern', 'junior', 'middle', 'senior', 'lead', 'principal', 'executive']),
  desiredSalary: salarySchema.optional(),
  desiredLocations: z.array(locationSchema).default([]),
  isRemoteOnly: z.boolean().default(false),
});

export const UpdateSearchProfileDto = z.object({
  name: z.string().min(1).optional(),
  desiredPositions: z.array(z.string()).optional(),
  desiredTechnologies: z.array(z.string()).optional(),
  experienceLevel: z.enum(['intern', 'junior', 'middle', 'senior', 'lead', 'principal', 'executive']).optional(),
  desiredSalary: salarySchema.optional(),
  desiredLocations: z.array(locationSchema).optional(),
  isRemoteOnly: z.boolean().optional(),
});

export type CreateSearchProfileInput = z.infer<typeof CreateSearchProfileDto>;
export type UpdateSearchProfileInput = z.infer<typeof UpdateSearchProfileDto>;
