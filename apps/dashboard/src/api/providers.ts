import { apiClient } from './client';

export interface ProviderConfig {
  id: string;
  providerId: string;
  enabled: boolean;
  syncEnabled: boolean;
  status: string;
  settings: unknown;
  qualityScore: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderInfo {
  config: ProviderConfig | null;
  providerId: string;
  name: string;
  registered: boolean;
  enabled: boolean;
  health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastSync: string | null;
  lastSyncResult: 'success' | 'failed' | 'pending' | null;
  lastError: string | null;
  totalSynced: number;
  importedCount: number;
  failedCount: number;
  consecutiveFailures: number;
  syncInterval: number;
  requiredConfig?: readonly string[];
  ingestionMode?: string;
  bulkSyncStatus?: 'SUPPORTED' | 'NOT_SUPPORTED_FOR_BULK_SYNC';
}

export interface TelegramChannel {
  id: string;
  username: string;
  enabled: boolean;
  category: string | null;
  description: string | null;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QualityMetrics {
  providerId: string;
  totalVacancies: number;
  missingSalary: number;
  missingCompany: number;
  missingLocation: number;
  duplicateRate: number;
  invalidUrls: number;
  extractionSuccessRate: number;
  qualityScore: number;
}

// ── Provider APIs ──

export async function getProviders(): Promise<{ providers: ProviderInfo[] }> {
  return apiClient('/api/v1/providers/providers');
}

export async function getProvider(providerId: string): Promise<{ provider: ProviderInfo }> {
  return apiClient(`/api/v1/providers/providers/${providerId}`);
}

export async function updateProvider(
  providerId: string,
  data: { enabled?: boolean; syncEnabled?: boolean; status?: string; settings?: unknown }
): Promise<{ config: ProviderConfig }> {
  return apiClient(`/api/v1/providers/providers/${providerId}`, {
    method: 'PATCH',
    body: data,
  });
}

// ── Telegram Channel APIs ──

export async function getTelegramChannels(): Promise<{ channels: TelegramChannel[] }> {
  return apiClient('/api/v1/providers/providers/telegram/channels');
}

export async function addTelegramChannel(data: {
  username: string;
  enabled?: boolean;
  category?: string;
  description?: string;
}): Promise<{ channel: TelegramChannel }> {
  return apiClient('/api/v1/providers/providers/telegram/channels', {
    method: 'POST',
    body: data,
  });
}

export async function updateTelegramChannel(
  id: string,
  data: { enabled?: boolean; category?: string; description?: string }
): Promise<{ channel: TelegramChannel }> {
  return apiClient(`/api/v1/providers/providers/telegram/channels/${id}`, {
    method: 'PATCH',
    body: data,
  });
}

export async function deleteTelegramChannel(id: string): Promise<void> {
  return apiClient(`/api/v1/providers/providers/telegram/channels/${id}`, {
    method: 'DELETE',
  });
}

// ── Quality APIs ──

export async function getProviderQualities(): Promise<{ qualities: QualityMetrics[] }> {
  return apiClient('/api/v1/providers/providers/quality');
}

export async function getProviderQuality(providerId: string): Promise<{ quality: QualityMetrics }> {
  return apiClient(`/api/v1/providers/providers/${providerId}/quality`);
}
