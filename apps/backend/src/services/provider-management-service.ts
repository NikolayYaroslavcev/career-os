import type { ProviderRegistry, Logger, HealthState } from '@careeros/providers';
import type { TelegramChannelStatsData } from '@careeros/database';
import { parseTelegramChannelList } from '@careeros/shared';
import type { SyncSchedulerService } from './sync-scheduler-service.js';
import type { ProviderDiagnosticsService } from './provider-diagnostics-service.js';
import { computeChannelQualityScore } from './telegram-channel-stats-service.js';

interface ProviderConfigData {
  id: string;
  providerId: string;
  enabled: boolean;
  syncEnabled: boolean;
  status: string;
  settings: unknown;
  qualityScore: number | null;
  createdAt: Date;
  updatedAt: Date;
}

interface TelegramChannelData {
  id: string;
  username: string;
  enabled: boolean;
  category: string | null;
  description: string | null;
  lastSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  stats?: TelegramChannelStatsData | null;
}

export type TelegramChannelWithQuality = TelegramChannelData & { qualityScore: number };

interface ProviderConfigRepo {
  upsert(input: { providerId: string; enabled?: boolean; syncEnabled?: boolean; status?: string; settings?: unknown; qualityScore?: number }): Promise<ProviderConfigData>;
  findByProviderId(providerId: string): Promise<ProviderConfigData | null>;
  findAll(): Promise<ProviderConfigData[]>;
  update(providerId: string, input: { enabled?: boolean; syncEnabled?: boolean; status?: string; settings?: unknown; qualityScore?: number }): Promise<ProviderConfigData | null>;
  delete(providerId: string): Promise<void>;
  isProviderEnabled(providerId: string): Promise<boolean>;
  isProviderSyncEnabled(providerId: string): Promise<boolean>;
}

interface TelegramChannelRepo {
  create(input: { username: string; enabled?: boolean; category?: string; description?: string }): Promise<TelegramChannelData>;
  findById(id: string): Promise<TelegramChannelData | null>;
  findByUsername(username: string): Promise<TelegramChannelData | null>;
  findAll(): Promise<TelegramChannelData[]>;
  findEnabled(): Promise<TelegramChannelData[]>;
  findEnabledUsernames(): Promise<string[]>;
  update(id: string, input: { enabled?: boolean; category?: string; description?: string; lastSyncAt?: Date }): Promise<TelegramChannelData | null>;
  delete(id: string): Promise<void>;
  deleteByUsername(username: string): Promise<void>;
  seedFromEnv(envChannels: string): Promise<TelegramChannelData[]>;
}

interface QualityDataRepo {
  findSourcesWithVacancies(providerId: string): Promise<Array<{
    sourceUrl: string | null;
    salaryMin: number | null;
    salaryMax: number | null;
    location: string | null;
  }>>;
  countDistinctCompaniesByProvider(providerId: string): Promise<number>;
}

export interface ProviderWithInfo {
  config: ProviderConfigData | null;
  providerId: string;
  name: string;
  registered: boolean;
  enabled: boolean;
  health: HealthState;
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

function attachQualityScore(channel: TelegramChannelData): TelegramChannelWithQuality {
  return { ...channel, qualityScore: channel.stats ? computeChannelQualityScore(channel.stats) : 0 };
}

const KNOWN_PROVIDER_NAMES: Record<string, string> = {
  hh: 'HeadHunter',
  adzuna: 'Adzuna',
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  ashby: 'Ashby',
  workday: 'Workday',
  teamtailor: 'Teamtailor',
  remotive: 'Remotive',
  arbeitnow: 'Arbeitnow',
  jobicy: 'Jobicy',
  we_work_remotely: 'We Work Remotely',
  working_nomads: 'Working Nomads',
  nodesk: 'NoDesk',
  hn_hiring: 'HN Who Is Hiring',
  smartrecruiters: 'SmartRecruiters',
  recruitee: 'Recruitee',
  comeet: 'Comeet',
  habr_career: 'Habr Career',
  superjob: 'SuperJob',
  telegram: 'Telegram',
  linkedin: 'LinkedIn',
  personio: 'Personio',
  workable: 'Workable',
  pyjobs: 'PyJobs',
  django_jobs: 'Django Jobs',
  speedrun: 'a16z Speedrun',
  france_travail: 'France Travail',
};

const DEFAULT_SYNC_INTERVALS: Record<string, number> = {
  hh: 60 * 60 * 1000,
  adzuna: 60 * 60 * 1000,
  remotive: 60 * 60 * 1000,
  arbeitnow: 60 * 60 * 1000,
  jobicy: 60 * 60 * 1000,
  we_work_remotely: 2 * 60 * 60 * 1000,
  working_nomads: 2 * 60 * 60 * 1000,
  nodesk: 2 * 60 * 60 * 1000,
  hn_hiring: 24 * 60 * 60 * 1000,
  habr_career: 2 * 60 * 60 * 1000,
  greenhouse: 60 * 60 * 1000,
  lever: 60 * 60 * 1000,
  ashby: 60 * 60 * 1000,
  workday: 60 * 60 * 1000,
  teamtailor: 60 * 60 * 1000,
  smartrecruiters: 60 * 60 * 1000,
  recruitee: 60 * 60 * 1000,
  comeet: 60 * 60 * 1000,
  superjob: 60 * 60 * 1000,
  telegram: 15 * 60 * 1000,
  personio: 60 * 60 * 1000,
  workable: 60 * 60 * 1000,
  linkedin: 60 * 60 * 1000,
  pyjobs: 60 * 60 * 1000,
  django_jobs: 2 * 60 * 60 * 1000,
  speedrun: 60 * 60 * 1000,
  france_travail: 60 * 60 * 1000,
};

export class ProviderManagementService {
  constructor(
    private readonly providerConfigRepo: ProviderConfigRepo,
    private readonly telegramChannelRepo: TelegramChannelRepo,
    private readonly providerRegistry: ProviderRegistry,
    private readonly syncScheduler: SyncSchedulerService,
    private readonly logger: Logger,
    private readonly qualityDataRepo?: QualityDataRepo,
    private readonly diagnostics?: ProviderDiagnosticsService,
  ) {}

  // ── Provider Config ──

  async getAllProviders(workspaceId: string): Promise<ProviderWithInfo[]> {
    const configs = await this.providerConfigRepo.findAll();
    const configMap = new Map(configs.map((c) => [c.providerId, c]));
    const registered = this.providerRegistry.getAll();
    const registeredIds = new Set(registered.map((p) => p.info.id));

    const allProviderIds = new Set([...registeredIds, ...configs.map((c) => c.providerId)]);

    const result: ProviderWithInfo[] = [];
    const diagnosticsSnapshot = this.diagnostics?.getSnapshot() ?? [];
    const diagnosticsMap = new Map(diagnosticsSnapshot.map((d) => [d.providerId, d]));

    for (const providerId of allProviderIds) {
      const config = configMap.get(providerId) ?? null;
      const isEnabled = config?.enabled !== false && registeredIds.has(providerId);
      // SyncSchedulerService is the sole owner of live provider state (health,
      // sync results, counts) — ProviderRegistry.getState() only ever returns
      // the boot-time snapshot and is never updated after registration.
      const syncStatus = this.syncScheduler.getStatus(workspaceId, providerId);
      const diag = diagnosticsMap.get(providerId);

      result.push({
        config,
        providerId,
        name: KNOWN_PROVIDER_NAMES[providerId] ?? providerId,
        registered: registeredIds.has(providerId),
        enabled: isEnabled,
        health: syncStatus?.health ?? 'unknown',
        lastSync: syncStatus?.lastSyncAt?.toISOString() ?? null,
        lastSyncResult: syncStatus?.lastSyncResult ?? null,
        lastError: syncStatus?.lastError ?? null,
        totalSynced: syncStatus?.totalJobsSynced ?? 0,
        importedCount: syncStatus?.importedCount ?? 0,
        failedCount: syncStatus?.failedCount ?? 0,
        consecutiveFailures: syncStatus?.consecutiveFailures ?? 0,
        syncInterval: DEFAULT_SYNC_INTERVALS[providerId] ?? 60 * 60 * 1000,
        requiredConfig: diag?.requiredConfig,
        ingestionMode: diag?.ingestionMode,
        bulkSyncStatus: diag?.bulkSyncStatus,
      });
    }

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getProvider(providerId: string, workspaceId: string): Promise<ProviderWithInfo | null> {
    const config = await this.providerConfigRepo.findByProviderId(providerId);
    const isRegistered = this.providerRegistry.getAll().some((p) => p.info.id === providerId);
    const isEnabled = config?.enabled !== false && isRegistered;
    const syncStatus = this.syncScheduler.getStatus(workspaceId, providerId);
    const diag = this.diagnostics?.getSnapshot().find((d) => d.providerId === providerId);

    return {
      config,
      providerId,
      name: KNOWN_PROVIDER_NAMES[providerId] ?? providerId,
      registered: isRegistered,
      enabled: isEnabled,
      health: syncStatus?.health ?? 'unknown',
      lastSync: syncStatus?.lastSyncAt?.toISOString() ?? null,
      lastSyncResult: syncStatus?.lastSyncResult ?? null,
      lastError: syncStatus?.lastError ?? null,
      totalSynced: syncStatus?.totalJobsSynced ?? 0,
      importedCount: syncStatus?.importedCount ?? 0,
      failedCount: syncStatus?.failedCount ?? 0,
      consecutiveFailures: syncStatus?.consecutiveFailures ?? 0,
      syncInterval: DEFAULT_SYNC_INTERVALS[providerId] ?? 60 * 60 * 1000,
      requiredConfig: diag?.requiredConfig,
      ingestionMode: diag?.ingestionMode,
      bulkSyncStatus: diag?.bulkSyncStatus,
    };
  }

  async updateProvider(providerId: string, input: { enabled?: boolean; syncEnabled?: boolean; status?: string; settings?: unknown }): Promise<ProviderConfigData> {
    const config = await this.providerConfigRepo.upsert({
      providerId,
      enabled: input.enabled,
      syncEnabled: input.syncEnabled,
      status: input.status,
      settings: input.settings,
    });

    if (input.enabled === false) {
      this.syncScheduler.stopProvider(providerId);
      this.logger.info('Provider disabled, sync stopped', { providerId });
    } else if (input.enabled === true && input.syncEnabled !== false) {
      const interval = DEFAULT_SYNC_INTERVALS[providerId] ?? 60 * 60 * 1000;
      const workspaceId = 'global';
      this.syncScheduler.startProvider(providerId, interval, workspaceId);
      this.logger.info('Provider enabled, sync started', { providerId });
    }

    return config;
  }

  async toggleProvider(providerId: string, enabled: boolean): Promise<ProviderConfigData> {
    return this.updateProvider(providerId, { enabled });
  }

  async isProviderEnabled(providerId: string): Promise<boolean> {
    return this.providerConfigRepo.isProviderEnabled(providerId);
  }

  async isProviderSyncEnabled(providerId: string): Promise<boolean> {
    return this.providerConfigRepo.isProviderSyncEnabled(providerId);
  }

  // ── Telegram Channels ──

  async getAllTelegramChannels(): Promise<TelegramChannelWithQuality[]> {
    const channels = await this.telegramChannelRepo.findAll();
    return channels.map(attachQualityScore);
  }

  async getEnabledTelegramChannels(): Promise<TelegramChannelWithQuality[]> {
    const channels = await this.telegramChannelRepo.findEnabled();
    return channels.map(attachQualityScore);
  }

  async getEnabledTelegramUsernames(): Promise<string[]> {
    return this.telegramChannelRepo.findEnabledUsernames();
  }

  async addTelegramChannel(input: { username: string; enabled?: boolean; category?: string; description?: string }): Promise<TelegramChannelData> {
    const existing = await this.telegramChannelRepo.findByUsername(input.username);
    if (existing) {
      throw new Error(`Channel @${input.username} already exists`);
    }

    return this.telegramChannelRepo.create(input);
  }

  async updateTelegramChannel(id: string, input: { enabled?: boolean; category?: string; description?: string }): Promise<TelegramChannelData> {
    const updated = await this.telegramChannelRepo.update(id, input);
    if (!updated) throw new Error('Telegram channel not found');
    return updated;
  }

  async removeTelegramChannel(id: string): Promise<void> {
    await this.telegramChannelRepo.delete(id);
  }

  async removeTelegramChannelByUsername(username: string): Promise<void> {
    await this.telegramChannelRepo.deleteByUsername(username);
  }

  async toggleTelegramChannel(id: string, enabled: boolean): Promise<TelegramChannelData> {
    const updated = await this.telegramChannelRepo.update(id, { enabled });
    if (!updated) throw new Error('Telegram channel not found');
    return updated;
  }

  /**
   * Get Telegram channels for the fetcher.
   * Priority: DB enabled channels > ENV fallback.
   */
  async getTelegramChannelsForFetcher(envChannels?: string): Promise<string[]> {
    const dbChannels = await this.telegramChannelRepo.findEnabledUsernames();
    if (dbChannels.length > 0) return dbChannels;

    return parseTelegramChannelList(envChannels);
  }

  /**
   * Seed Telegram channels from ENV for migration compatibility.
   */
  async seedTelegramChannelsFromEnv(envChannels: string): Promise<TelegramChannelData[]> {
    return this.telegramChannelRepo.seedFromEnv(envChannels);
  }

  // ── Quality Score ──

  async calculateProviderQuality(providerId: string): Promise<QualityMetrics> {
    const baseMetrics: QualityMetrics = {
      providerId,
      totalVacancies: 0,
      missingSalary: 0,
      missingCompany: 0,
      missingLocation: 0,
      duplicateRate: 0,
      invalidUrls: 0,
      extractionSuccessRate: 100,
      qualityScore: 50,
    };

    if (!this.qualityDataRepo) return baseMetrics;

    try {
      const sources = await this.qualityDataRepo.findSourcesWithVacancies(providerId);

      if (sources.length === 0) return baseMetrics;

      baseMetrics.totalVacancies = sources.length;
      let missingSalary = 0;
      let missingCompany = 0;
      let missingLocation = 0;
      let invalidUrls = 0;

      for (const source of sources) {
        if (!source.salaryMin && !source.salaryMax) missingSalary++;
        if (!source.location) missingLocation++;
        if (!source.sourceUrl || !source.sourceUrl.startsWith('http')) invalidUrls++;
      }

      const companyCount = await this.qualityDataRepo.countDistinctCompaniesByProvider(providerId);
      missingCompany = sources.length - companyCount;

      baseMetrics.missingSalary = missingSalary;
      baseMetrics.missingCompany = Math.max(0, missingCompany);
      baseMetrics.missingLocation = missingLocation;
      baseMetrics.invalidUrls = invalidUrls;

      const total = sources.length;
      const salaryScore = Math.max(0, 100 - (missingSalary / total) * 100);
      const companyScore = Math.max(0, 100 - (Math.max(0, missingCompany) / total) * 100);
      const locationScore = Math.max(0, 100 - (missingLocation / total) * 100);
      const urlScore = Math.max(0, 100 - (invalidUrls / total) * 100);

      baseMetrics.qualityScore = Math.round(salaryScore * 0.3 + companyScore * 0.3 + locationScore * 0.25 + urlScore * 0.15);

      await this.providerConfigRepo.upsert({
        providerId,
        qualityScore: baseMetrics.qualityScore,
      });
    } catch (error) {
      this.logger.error('Failed to calculate quality score', error instanceof Error ? error : undefined, { providerId });
    }

    return baseMetrics;
  }

  async getAllProviderQualities(workspaceId: string): Promise<QualityMetrics[]> {
    const providers = await this.getAllProviders(workspaceId);
    const qualities: QualityMetrics[] = [];
    for (const p of providers) {
      qualities.push(await this.calculateProviderQuality(p.providerId));
    }
    return qualities;
  }
}
