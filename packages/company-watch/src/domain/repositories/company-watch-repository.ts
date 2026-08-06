import type { CompanyWatchHealthStatus } from '../health.js';

export interface CompanyWatchData {
  id: string;
  name: string;
  aliases: string[];
  country?: string;
  languages: string[];
  tags: string[];
  atsType: string;
  careerUrl: string;
  atsEndpoint?: string;
  pollingInterval: number;
  active: boolean;
  lastSyncAt?: Date;
  lastSyncStatus?: string;
  lastSyncError?: string;
  metadata?: Record<string, unknown>;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
  consecutiveFailureCount: number;
  healthStatus: CompanyWatchHealthStatus;
  priorityScore: number;
  lastSuccessfulSyncAt?: Date;
}

export interface CompanyWatchRepository {
  findById(id: string): Promise<CompanyWatchData | null>;
  findByName(workspaceId: string, name: string): Promise<CompanyWatchData | null>;
  findAllByWorkspace(workspaceId: string): Promise<CompanyWatchData[]>;
  findAllActive(): Promise<CompanyWatchData[]>;
  create(company: CompanyWatchData): Promise<CompanyWatchData>;
  update(company: CompanyWatchData): Promise<CompanyWatchData>;
  delete(id: string): Promise<void>;
  upsert(data: { where: { workspaceId_name: { workspaceId: string; name: string } }; create: Partial<CompanyWatchData>; update: Partial<CompanyWatchData> }): Promise<CompanyWatchData>;
}
