import { apiClient } from './client';

// ===== Types =====

export interface UsageStats {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  avgLatencyMs: number;
  byProvider: Record<string, { requests: number; tokens: number; cost: number }>;
  byModel: Record<string, { requests: number; tokens: number; cost: number }>;
  byFeature: Record<string, { requests: number; tokens: number; cost: number }>;
}

export interface DashboardData {
  today: UsageStats;
  week: UsageStats;
  month: UsageStats;
  estimatedMonthlyCost: number;
  savedTokens: number;
  mostExpensiveFeature: string;
  mostFrequentFeature: string;
  recentJobs: AIJob[];
}

export interface AIJob {
  id: string;
  feature: string;
  status: string;
  provider: string | null;
  model: string | null;
  totalTokens: number;
  estimatedCost: number;
  createdAt: string;
  result?: unknown;
  error?: string | null;
  vacancyId?: string | null;
  applicationId?: string | null;
}

// ===== AI action result shapes (mirrors packages/ai-orchestrator job handlers) =====

export interface ExecuteAIResult<T> {
  jobId: string;
  status: 'cached' | 'queued' | 'completed' | 'failed';
  cached: boolean;
  result?: T;
}

export interface AnalyzeVacancyResult {
  overallScore: number;
  confidence: number;
  recommendation: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  requiredSkills: string[];
  missingSkills: string[];
  reasoning: string;
}

export interface TailorResumeResultData {
  optimizedSummary: string;
  reorderedExperience: Array<{
    company: string;
    position: string;
    description: string;
    technologies: string[];
    relevanceScore: number;
  }>;
  emphasizedSkills: string[];
  keywordOptimizations: string[];
  tailoredResume: string;
}

export interface CoverLetterResultData {
  coverLetter: string;
  tone: 'formal' | 'conversational' | 'technical';
  keyPoints: string[];
}

export interface InterviewPrepResultData {
  questions: Array<{
    question: string;
    expectedAnswer: string;
    difficulty: 'easy' | 'medium' | 'hard';
    category: string;
  }>;
  tips: string[];
  keyTopics: string[];
}

export interface AICacheStats {
  totalEntries: number;
  totalHits: number;
  totalSavedTokens: number;
}

export interface AIProviderConfig {
  provider: string;
  model?: string;
  baseUrl?: string;
  hasApiKey: boolean;
  isActive?: boolean;
}

export interface AIBudget {
  id: string;
  period: string;
  maxTokens: number | null;
  maxCost: number | null;
  maxRequestsPerFeature: Record<string, number> | null;
  isEnabled: boolean;
}

// ===== API Functions =====

// Usage
export async function getUsageStats(period: 'today' | 'week' | 'month' = 'month'): Promise<UsageStats> {
  return apiClient(`/api/v1/ai/usage?period=${period}`);
}

export async function getDashboardData(): Promise<DashboardData> {
  return apiClient('/api/v1/ai/usage/dashboard');
}

// Jobs
export async function getAIJobs(params?: {
  feature?: string;
  status?: string;
  vacancyId?: string;
  applicationId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ jobs: AIJob[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.feature) searchParams.set('feature', params.feature);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.vacancyId) searchParams.set('vacancyId', params.vacancyId);
  if (params?.applicationId) searchParams.set('applicationId', params.applicationId);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.offset) searchParams.set('offset', String(params.offset));

  return apiClient<{ jobs: AIJob[]; total: number }>(`/api/v1/ai/jobs?${searchParams.toString()}`);
}

export async function getAIJob(jobId: string): Promise<AIJob> {
  return apiClient(`/api/v1/ai/jobs/${jobId}`);
}

export async function cancelAIJob(jobId: string): Promise<void> {
  await apiClient(`/api/v1/ai/jobs/${jobId}`, { method: 'DELETE' });
}

// Budget
export async function getBudget(): Promise<{ daily: AIBudget | null; monthly: AIBudget | null }> {
  return apiClient('/api/v1/ai/budget');
}

export async function updateBudget(data: {
  period: 'DAILY' | 'MONTHLY';
  maxTokens?: number;
  maxCost?: number;
  maxRequestsPerFeature?: Record<string, number>;
  isEnabled?: boolean;
}): Promise<AIBudget> {
  return apiClient('/api/v1/ai/budget', {
    method: 'PUT',
    body: data,
  });
}

// Mode
export async function getAIMode(): Promise<{ mode: string }> {
  return apiClient('/api/v1/ai/mode');
}

export async function setAIMode(mode: 'manual' | 'smart' | 'automatic'): Promise<{ mode: string }> {
  return apiClient('/api/v1/ai/mode', {
    method: 'PUT',
    body: { mode },
  });
}

// Cache
export async function getCacheStats(): Promise<AICacheStats> {
  return apiClient('/api/v1/ai/cache/stats');
}

export async function clearCache(feature?: string): Promise<{ deleted: number }> {
  const params = feature ? `?feature=${feature}` : '';
  return apiClient(`/api/v1/ai/cache${params}`, { method: 'DELETE' });
}

// Providers
export async function getProviders(): Promise<{ providers: AIProviderConfig[] }> {
  return apiClient('/api/v1/ai/providers');
}

export async function updateProvider(data: {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  isActive?: boolean;
  priority?: number;
}): Promise<AIProviderConfig> {
  return apiClient('/api/v1/ai/providers', {
    method: 'PUT',
    body: data,
  });
}

export async function deleteProvider(provider: string): Promise<void> {
  await apiClient(`/api/v1/ai/providers/${provider}`, { method: 'DELETE' });
}

// AI Actions
export async function analyzeVacancy(data: { vacancyId: string; searchProfileId: string }): Promise<ExecuteAIResult<AnalyzeVacancyResult>> {
  return apiClient<ExecuteAIResult<AnalyzeVacancyResult>>('/api/v1/ai/analyze-vacancy', {
    method: 'POST',
    body: data,
  });
}

export async function tailorResume(data: { vacancyId: string; resumeId: string }): Promise<ExecuteAIResult<TailorResumeResultData>> {
  return apiClient<ExecuteAIResult<TailorResumeResultData>>('/api/v1/ai/tailor-resume', {
    method: 'POST',
    body: data,
  });
}

export async function generateCoverLetter(data: { vacancyId: string; resumeId: string }): Promise<ExecuteAIResult<CoverLetterResultData>> {
  return apiClient<ExecuteAIResult<CoverLetterResultData>>('/api/v1/ai/cover-letter', {
    method: 'POST',
    body: data,
  });
}

export async function getInterviewPrep(data: { vacancyId: string; interviewType: string }): Promise<ExecuteAIResult<InterviewPrepResultData>> {
  return apiClient<ExecuteAIResult<InterviewPrepResultData>>('/api/v1/ai/interview-prep', {
    method: 'POST',
    body: data,
  });
}

export async function getSalaryAnalysis(data: {
  jobTitle: string;
  location: string;
  technologies?: string[];
  experienceLevel: string;
  companySize?: string;
  industry?: string;
}): Promise<unknown> {
  return apiClient('/api/v1/ai/salary-analysis', {
    method: 'POST',
    body: data,
  });
}

export async function getCompanyAnalysis(data: {
  companyName: string;
  industry?: string;
  size?: string;
  website?: string;
  technologies?: string[];
}): Promise<unknown> {
  return apiClient('/api/v1/ai/company-analysis', {
    method: 'POST',
    body: data,
  });
}

export async function getResumeImprovement(data: {
  resumeId: string;
  targetRole?: string;
  targetTechnologies?: string[];
}): Promise<unknown> {
  return apiClient('/api/v1/ai/resume-improvement', {
    method: 'POST',
    body: data,
  });
}

export async function getCareerAdvice(data: {
  question: string;
  currentRole?: string;
  experience?: string;
  skills?: string[];
  goals?: string;
}): Promise<unknown> {
  return apiClient('/api/v1/ai/career-advice', {
    method: 'POST',
    body: data,
  });
}
