export interface CompanyWatchEventData {
  id: string;
  type: 'NEW_JOB' | 'REMOVED_JOB' | 'CHANGED_JOB';
  externalId?: string;
  title?: string;
  description?: string;
  url?: string;
  location?: string;
  salary?: { min?: number; max?: number; currency?: string };
  technologies: string[];
  publishedAt?: Date;
  detectedAt: Date;
  processed: boolean;
  notifiedAt?: Date;
  metadata?: Record<string, unknown>;
  companyWatchId: string;
}

export interface CompanyWatchEventRepository {
  findById(id: string): Promise<CompanyWatchEventData | null>;
  findAllByCompanyWatch(companyWatchId: string, options?: { type?: string; limit?: number; offset?: number }): Promise<CompanyWatchEventData[]>;
  create(event: CompanyWatchEventData): Promise<CompanyWatchEventData>;
  update(event: CompanyWatchEventData): Promise<CompanyWatchEventData>;
  delete(id: string): Promise<void>;
  countByCompanyWatch(companyWatchId: string, type?: string): Promise<number>;
}
