import { Prisma } from '@prisma/client';
import { prisma } from '../client.js';

type ProviderStatusValue = 'READY' | 'BLOCKED' | 'NEEDS_CONFIGURATION' | 'DISABLED';

function toSettingsInput(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  return value as Prisma.InputJsonValue;
}

export interface ProviderConfigData {
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

export interface CreateProviderConfigInput {
  providerId: string;
  enabled?: boolean;
  syncEnabled?: boolean;
  status?: string;
  settings?: unknown;
  qualityScore?: number;
}

export interface UpdateProviderConfigInput {
  enabled?: boolean;
  syncEnabled?: boolean;
  status?: string;
  settings?: unknown;
  qualityScore?: number;
}

export class PrismaProviderConfigRepository {
  async upsert(input: CreateProviderConfigInput): Promise<ProviderConfigData> {
    const existing = await prisma.providerConfig.findUnique({
      where: { providerId: input.providerId },
    });

    if (existing) {
      return prisma.providerConfig.update({
        where: { providerId: input.providerId },
        data: {
          enabled: input.enabled ?? existing.enabled,
          syncEnabled: input.syncEnabled ?? existing.syncEnabled,
          status: (input.status as ProviderStatusValue | undefined) ?? existing.status,
          settings: input.settings !== undefined ? toSettingsInput(input.settings) : toSettingsInput(existing.settings),
          qualityScore: input.qualityScore ?? existing.qualityScore,
        },
      });
    }

    return prisma.providerConfig.create({
      data: {
        providerId: input.providerId,
        enabled: input.enabled ?? true,
        syncEnabled: input.syncEnabled ?? true,
        status: (input.status as ProviderStatusValue | undefined) ?? 'READY',
        settings: toSettingsInput(input.settings),
        qualityScore: input.qualityScore ?? null,
      },
    });
  }

  async findByProviderId(providerId: string): Promise<ProviderConfigData | null> {
    return prisma.providerConfig.findUnique({ where: { providerId } });
  }

  async findAll(): Promise<ProviderConfigData[]> {
    return prisma.providerConfig.findMany({ orderBy: { providerId: 'asc' } });
  }

  async findEnabled(): Promise<ProviderConfigData[]> {
    return prisma.providerConfig.findMany({ where: { enabled: true }, orderBy: { providerId: 'asc' } });
  }

  async findSyncEnabled(): Promise<ProviderConfigData[]> {
    return prisma.providerConfig.findMany({
      where: { enabled: true, syncEnabled: true },
      orderBy: { providerId: 'asc' },
    });
  }

  async update(providerId: string, input: UpdateProviderConfigInput): Promise<ProviderConfigData | null> {
    const existing = await prisma.providerConfig.findUnique({ where: { providerId } });
    if (!existing) return null;

    return prisma.providerConfig.update({
      where: { providerId },
      data: {
        enabled: input.enabled,
        syncEnabled: input.syncEnabled,
        status: input.status as ProviderStatusValue | undefined,
        settings: toSettingsInput(input.settings),
        qualityScore: input.qualityScore,
      },
    });
  }

  async delete(providerId: string): Promise<void> {
    await prisma.providerConfig.deleteMany({ where: { providerId } });
  }

  async isProviderEnabled(providerId: string): Promise<boolean> {
    const config = await prisma.providerConfig.findUnique({ where: { providerId } });
    if (!config) return true;
    return config.enabled;
  }

  async isProviderSyncEnabled(providerId: string): Promise<boolean> {
    const config = await prisma.providerConfig.findUnique({ where: { providerId } });
    if (!config) return true;
    return config.enabled && config.syncEnabled;
  }
}
