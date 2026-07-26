import { z } from 'zod';

export const queueItemSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  payload: z.unknown(),
  createdAt: z.number(),
  attempts: z.number().min(0),
  maxAttempts: z.number().min(1).default(5),
  nextRetryAt: z.number(),
  status: z.enum(['pending', 'processing', 'failed']),
});

export type ValidatedQueueItem = z.infer<typeof queueItemSchema>;

export function validateQueueItem(data: unknown): ValidatedQueueItem | null {
  const result = queueItemSchema.safeParse(data);
  return result.success ? result.data : null;
}
