import type { SearchProfileRepository, SaveSearchProfileOptions } from '@careeros/career';
import type { SearchProfileId, UserId } from '@careeros/career';
import type { SearchProfile } from '@careeros/career';
import { prisma } from '../client.js';
import { SearchProfileMapper } from '../mappers/search-profile-mapper.js';

export class PrismaSearchProfileRepository implements SearchProfileRepository {
  async findById(id: SearchProfileId): Promise<SearchProfile | null> {
    const record = await prisma.searchProfile.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return SearchProfileMapper.toDomain(record);
  }

  async findByUserId(userId: UserId): Promise<SearchProfile[]> {
    const records = await prisma.searchProfile.findMany({
      where: { userId },
    });

    return records.map(SearchProfileMapper.toDomain);
  }

  async findActiveByUserId(userId: UserId): Promise<SearchProfile | null> {
    const record = await prisma.searchProfile.findFirst({
      where: { userId, isActive: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (!record) {
      return null;
    }

    return SearchProfileMapper.toDomain(record);
  }

  async save(profile: SearchProfile, options: SaveSearchProfileOptions): Promise<void> {
    let workspaceId = options.workspaceId;

    if (!workspaceId) {
      const existing = await prisma.searchProfile.findUnique({
        where: { id: profile.id },
        select: { workspaceId: true },
      });
      workspaceId = existing?.workspaceId ?? 'default';
    }

    const data = SearchProfileMapper.toPersistence(profile, workspaceId);

    await prisma.searchProfile.upsert({
      where: { id: profile.id },
      create: data,
      update: data,
    });
  }

  async delete(id: SearchProfileId): Promise<void> {
    await prisma.searchProfile.delete({
      where: { id },
    });
  }

  async exists(id: SearchProfileId): Promise<boolean> {
    const count = await prisma.searchProfile.count({
      where: { id },
    });

    return count > 0;
  }
}
