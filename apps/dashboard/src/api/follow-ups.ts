import { apiClient } from './client';
import type { FollowUpStatus, FollowUpType } from './applications';

export interface EnrichedFollowUp {
  id: string;
  applicationId: string;
  type: FollowUpType | null;
  status: FollowUpStatus;
  scheduledAt: string;
  message: string | null;
  vacancyTitle: string;
  companyName: string;
  daysSinceApplied: number | null;
}

export interface FollowUpBuckets {
  overdue: EnrichedFollowUp[];
  today: EnrichedFollowUp[];
  upcoming: EnrichedFollowUp[];
  completed: EnrichedFollowUp[];
}

export async function listFollowUpBuckets(): Promise<FollowUpBuckets> {
  return apiClient('/api/v1/follow-ups');
}

export interface CreateFollowUpInput {
  applicationId: string;
  date: string;
  message?: string;
  type?: FollowUpType;
}

export async function createFollowUp(input: CreateFollowUpInput): Promise<EnrichedFollowUp> {
  return apiClient('/api/v1/follow-ups', {
    method: 'POST',
    body: input,
  });
}

export async function rescheduleFollowUp(id: string, date: string): Promise<EnrichedFollowUp> {
  return apiClient(`/api/v1/follow-ups/${id}`, {
    method: 'PATCH',
    body: { date },
  });
}

export async function deleteFollowUp(id: string): Promise<void> {
  return apiClient(`/api/v1/follow-ups/${id}`, {
    method: 'DELETE',
  });
}

export async function completeFollowUpById(id: string): Promise<EnrichedFollowUp> {
  return apiClient(`/api/v1/follow-ups/${id}/complete`, {
    method: 'POST',
  });
}
