import { prisma } from '../client.js';
import { getEncryptionService, type EncryptionService } from '@careeros/shared';

export interface AIProviderConfigData {
  id: string;
  userId: string | null;
  provider: string;
  apiKey: string | null;
  baseUrl: string | null;
  model: string | null;
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAIProviderConfigInput {
  userId?: string;
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  isActive?: boolean;
  priority?: number;
}

export interface UpdateAIProviderConfigInput {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  isActive?: boolean;
  priority?: number;
}

export interface AIProviderConfigRepository {
  upsert(input: CreateAIProviderConfigInput): Promise<AIProviderConfigData>;
  findById(id: string): Promise<AIProviderConfigData | null>;
  findByUserAndProvider(userId: string, provider: string): Promise<AIProviderConfigData | null>;
  findByUserId(userId: string): Promise<AIProviderConfigData[]>;
  findGlobal(): Promise<AIProviderConfigData[]>;
  findActiveByPriority(): Promise<AIProviderConfigData[]>;
  delete(id: string): Promise<void>;
  deleteByUserAndProvider(userId: string, provider: string): Promise<void>;
}

export class PrismaAIProviderConfigRepository implements AIProviderConfigRepository {
  private getEncryption(): EncryptionService {
    return getEncryptionService();
  }

  private encryptApiKey(apiKey: string | null | undefined): string | null {
    if (!apiKey) return null;
    const encryption = this.getEncryption();
    if (encryption.isEncrypted(apiKey)) return apiKey;
    return encryption.encrypt(apiKey);
  }

  private decryptApiKey(apiKey: string | null | undefined): string | null {
    if (!apiKey) return null;
    const encryption = this.getEncryption();
    if (!encryption.isEncrypted(apiKey)) {
      if (encryption.isAllowUnencrypted()) {
        return apiKey;
      }
      throw new Error(
        `Plaintext API key detected for provider. ` +
        `Set MASTER_ENCRYPTION_KEY and re-save to encrypt, or set ALLOW_UNENCRYPTED_PROVIDER_KEYS=true for development only.`,
      );
    }
    return encryption.decrypt(apiKey);
  }

  private migratePlaintextApiKey(
    id: string,
    apiKey: string | null | undefined,
  ): string | null {
    if (!apiKey) return null;
    const encryption = this.getEncryption();
    if (encryption.isEncrypted(apiKey)) return apiKey;

    const encrypted = encryption.encrypt(apiKey);
    prisma.aIProviderConfiguration
      .update({ where: { id }, data: { apiKey: encrypted } })
      .catch(() => {});
    return encrypted;
  }

  async upsert(input: CreateAIProviderConfigInput): Promise<AIProviderConfigData> {
    const encryptedApiKey = this.encryptApiKey(input.apiKey);

    const record = await prisma.aIProviderConfiguration.upsert({
      where: {
        userId_provider: {
          userId: input.userId ?? '',
          provider: input.provider,
        },
      },
      create: {
        userId: input.userId ?? null,
        provider: input.provider,
        apiKey: encryptedApiKey,
        baseUrl: input.baseUrl ?? null,
        model: input.model ?? null,
        isActive: input.isActive ?? true,
        priority: input.priority ?? 0,
      },
      update: {
        apiKey: encryptedApiKey ?? undefined,
        baseUrl: input.baseUrl ?? undefined,
        model: input.model ?? undefined,
        isActive: input.isActive ?? undefined,
        priority: input.priority ?? undefined,
      },
    });
    return {
      ...record,
      apiKey: this.decryptApiKey(record.apiKey),
    };
  }

  async findById(id: string): Promise<AIProviderConfigData | null> {
    const record = await prisma.aIProviderConfiguration.findUnique({ where: { id } });
    if (!record) return null;

    const decryptedApiKey = this.migratePlaintextApiKey(id, record.apiKey);
    return {
      ...record,
      apiKey: this.decryptApiKey(decryptedApiKey),
    };
  }

  async findByUserAndProvider(userId: string, provider: string): Promise<AIProviderConfigData | null> {
    const record = await prisma.aIProviderConfiguration.findUnique({
      where: { userId_provider: { userId, provider } },
    });
    if (!record) return null;

    const decryptedApiKey = this.migratePlaintextApiKey(record.id, record.apiKey);
    return {
      ...record,
      apiKey: this.decryptApiKey(decryptedApiKey),
    };
  }

  async findByUserId(userId: string): Promise<AIProviderConfigData[]> {
    const records = await prisma.aIProviderConfiguration.findMany({
      where: { userId, isActive: true },
      orderBy: { priority: 'desc' },
    });
    return records.map((record) => ({
      ...record,
      apiKey: this.decryptApiKey(this.migratePlaintextApiKey(record.id, record.apiKey)),
    }));
  }

  async findGlobal(): Promise<AIProviderConfigData[]> {
    const records = await prisma.aIProviderConfiguration.findMany({
      where: { userId: null, isActive: true },
      orderBy: { priority: 'desc' },
    });
    return records.map((record) => ({
      ...record,
      apiKey: this.decryptApiKey(this.migratePlaintextApiKey(record.id, record.apiKey)),
    }));
  }

  async findActiveByPriority(): Promise<AIProviderConfigData[]> {
    const records = await prisma.aIProviderConfiguration.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });
    return records.map((record) => ({
      ...record,
      apiKey: this.decryptApiKey(this.migratePlaintextApiKey(record.id, record.apiKey)),
    }));
  }

  async delete(id: string): Promise<void> {
    await prisma.aIProviderConfiguration.delete({ where: { id } });
  }

  async deleteByUserAndProvider(userId: string, provider: string): Promise<void> {
    await prisma.aIProviderConfiguration.deleteMany({
      where: { userId, provider },
    });
  }
}
