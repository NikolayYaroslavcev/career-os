import { apiClient } from './client';

export interface LinkCodeResponse {
  code: string;
  expiresAt: string;
}

export interface ConnectionStatus {
  linked: boolean;
  telegramUsername?: string | null;
  verifiedAt?: string;
}

export async function generateLinkCode(): Promise<LinkCodeResponse> {
  return apiClient('/api/v1/telegram/link-code', {
    method: 'POST',
  });
}

export async function getConnectionStatus(): Promise<ConnectionStatus> {
  return apiClient('/api/v1/telegram/connection');
}
