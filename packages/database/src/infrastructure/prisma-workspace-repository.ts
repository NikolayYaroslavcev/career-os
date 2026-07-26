import type { WorkspaceRepository } from '@careeros/career';
import type { WorkspaceId, UserId } from '@careeros/career';
import type { Workspace } from '@careeros/career';
import { prisma } from '../client.js';
import { WorkspaceMapper } from '../mappers/workspace-mapper.js';

export class PrismaWorkspaceRepository implements WorkspaceRepository {
  async findById(id: WorkspaceId): Promise<Workspace | null> {
    const record = await prisma.workspace.findUnique({
      where: { id },
      include: { members: true },
    });

    if (!record) {
      return null;
    }

    return WorkspaceMapper.toDomain(record);
  }

  async findByOwnerId(ownerId: UserId): Promise<Workspace[]> {
    const records = await prisma.workspace.findMany({
      where: {
        members: {
          some: {
            userId: ownerId,
            role: 'OWNER',
          },
        },
      },
      include: { members: true },
    });

    return records.map(WorkspaceMapper.toDomain);
  }

  async findByMemberId(memberId: UserId): Promise<Workspace[]> {
    const records = await prisma.workspace.findMany({
      where: {
        members: {
          some: {
            userId: memberId,
          },
        },
      },
      include: { members: true },
    });

    return records.map(WorkspaceMapper.toDomain);
  }

  async save(workspace: Workspace): Promise<void> {
    const data = WorkspaceMapper.toPersistence(workspace);

    await prisma.workspace.upsert({
      where: { id: workspace.id },
      create: {
        id: data.id,
        name: data.name,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        members: {
          create: data.members.map((m) => ({
            userId: m.userId,
            role: m.role as 'OWNER' | 'ADMIN' | 'MEMBER',
          })),
        },
      },
      update: {
        name: data.name,
        updatedAt: data.updatedAt,
      },
    });
  }

  async delete(id: WorkspaceId): Promise<void> {
    await prisma.workspace.delete({
      where: { id },
    });
  }

  async exists(id: WorkspaceId): Promise<boolean> {
    const count = await prisma.workspace.count({
      where: { id },
    });

    return count > 0;
  }
}
