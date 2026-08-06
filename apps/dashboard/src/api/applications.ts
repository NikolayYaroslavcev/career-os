import { apiClient } from './client';
import type {
  ExecuteAIResult,
  AnalyzeVacancyResult,
  TailoringStatusResult,
  CoverLetterResultData,
  InterviewPrepResultData,
} from './ai';

export const APPLICATION_STATUSES = [
  'saved',
  'started',
  'submitted',
  'waiting',
  'hr_interview',
  'technical_interview',
  'final_interview',
  'offer',
  'rejected',
  'archived',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface ApplicationNote {
  content: string;
  createdAt: string;
}

export interface Application {
  id: string;
  userId: string;
  vacancyId: string;
  resumeId: string | null;
  matchResultId: string | null;
  recruiterId: string | null;
  status: ApplicationStatus;
  notes: ApplicationNote[];
  startedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Informational only — no activity and no pending follow-up for a while. Never affects ranking. */
  coolingDown: boolean;
}

export interface PipelineGroup {
  status: ApplicationStatus;
  count: number;
  applications: Application[];
}

export type FollowUpStatus = 'pending' | 'sent' | 'completed' | 'snoozed' | 'cancelled';
export type FollowUpType = 'follow_up' | 'interview' | 'reply_expected' | 'custom';

export interface FollowUp {
  id: string;
  applicationId: string;
  scheduledAt: string;
  status: FollowUpStatus;
  message: string | null;
  sentAt: string | null;
  snoozedUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApplicationInput {
  vacancyId: string;
  matchResultId?: string;
  resumeId?: string;
}

export async function createApplication(data: CreateApplicationInput): Promise<Application> {
  return apiClient('/api/v1/applications', {
    method: 'POST',
    body: data,
  });
}

export async function listApplications(status?: ApplicationStatus): Promise<{ applications: Application[]; total: number }> {
  const query = status ? `?status=${status}` : '';
  return apiClient(`/api/v1/applications${query}`);
}

export async function getPipeline(): Promise<{ pipeline: PipelineGroup[] }> {
  return apiClient('/api/v1/applications/pipeline');
}

export async function getApplication(id: string): Promise<Application> {
  return apiClient(`/api/v1/applications/${id}`);
}

export async function updateApplicationStatus(id: string, status: ApplicationStatus): Promise<Application> {
  return apiClient(`/api/v1/applications/${id}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

export async function addApplicationNote(id: string, content: string): Promise<Application> {
  return apiClient(`/api/v1/applications/${id}/notes`, {
    method: 'POST',
    body: { content },
  });
}

export async function listFollowUps(applicationId: string): Promise<{ followUps: FollowUp[] }> {
  return apiClient(`/api/v1/applications/${applicationId}/follow-ups`);
}

export async function scheduleFollowUp(
  applicationId: string,
  date: string,
  message?: string
): Promise<FollowUp> {
  return apiClient(`/api/v1/applications/${applicationId}/follow-ups`, {
    method: 'POST',
    body: { date, message },
  });
}

export async function snoozeFollowUp(followUpId: string, date: string): Promise<FollowUp> {
  return apiClient(`/api/v1/applications/follow-ups/${followUpId}/snooze`, {
    method: 'POST',
    body: { date },
  });
}

export async function completeFollowUp(followUpId: string): Promise<FollowUp> {
  return apiClient(`/api/v1/applications/follow-ups/${followUpId}/complete`, {
    method: 'POST',
  });
}

export async function cancelFollowUp(followUpId: string): Promise<FollowUp> {
  return apiClient(`/api/v1/applications/follow-ups/${followUpId}`, {
    method: 'DELETE',
  });
}

export interface Communication {
  id: string;
  applicationId: string;
  type: 'email' | 'phone' | 'linkedin' | 'telegram' | 'other';
  direction: 'inbound' | 'outbound';
  content: string | null;
  subject: string | null;
  sentAt: string;
}

export interface CreateCommunicationInput {
  type: Communication['type'];
  direction: Communication['direction'];
  content: string;
  subject?: string;
}

export async function listCommunications(applicationId: string): Promise<{ communications: Communication[] }> {
  return apiClient(`/api/v1/applications/${applicationId}/communications`);
}

export async function addCommunication(applicationId: string, data: CreateCommunicationInput): Promise<Communication> {
  return apiClient(`/api/v1/applications/${applicationId}/communications`, {
    method: 'POST',
    body: data,
  });
}

export interface Interview {
  id: string;
  applicationId: string;
  type: 'hr' | 'technical' | 'system_design' | 'behavioral' | 'coding' | 'cultural' | 'final';
  scheduledAt: string | null;
  durationMinutes: number | null;
  interviewerName: string | null;
  interviewerEmail: string | null;
  location: string | null;
  notes: string | null;
  isCompleted: boolean;
  feedback: Record<string, unknown> | null;
}

export interface ScheduleInterviewInput {
  type: Interview['type'];
  scheduledAt: string;
  durationMinutes?: number;
  interviewerName?: string;
  interviewerEmail?: string;
  notes?: string;
}

export async function listInterviews(applicationId: string): Promise<{ interviews: Interview[] }> {
  return apiClient(`/api/v1/applications/${applicationId}/interviews`);
}

export async function scheduleInterview(applicationId: string, data: ScheduleInterviewInput): Promise<Interview> {
  return apiClient(`/api/v1/applications/${applicationId}/interviews`, {
    method: 'POST',
    body: data,
  });
}

export async function tailorResumeForApplication(
  applicationId: string,
  resumeId: string,
  forceRegenerate?: boolean,
): Promise<TailoringStatusResult> {
  return apiClient(`/api/v1/applications/${applicationId}/tailor-resume`, {
    method: 'POST',
    body: { resumeId, forceRegenerate },
  });
}

export type CoverLetterResult = ExecuteAIResult<CoverLetterResultData>;

export async function generateCoverLetterForApplication(applicationId: string, resumeId: string): Promise<CoverLetterResult> {
  return apiClient(`/api/v1/applications/${applicationId}/cover-letter`, {
    method: 'POST',
    body: { resumeId },
  });
}

export type AnalyzeApplicationResult = ExecuteAIResult<AnalyzeVacancyResult>;

export async function analyzeVacancyForApplication(applicationId: string): Promise<AnalyzeApplicationResult> {
  return apiClient(`/api/v1/applications/${applicationId}/analyze`, {
    method: 'POST',
  });
}

export type InterviewPrepApplicationResult = ExecuteAIResult<InterviewPrepResultData>;

export async function interviewPrepForApplication(
  applicationId: string,
  interviewType: string
): Promise<InterviewPrepApplicationResult> {
  return apiClient(`/api/v1/applications/${applicationId}/interview-prep`, {
    method: 'POST',
    body: { interviewType },
  });
}
