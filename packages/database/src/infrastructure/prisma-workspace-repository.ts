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
    const memberIds = data.members.map((m) => m.userId);

    await prisma.$transaction(async (tx) => {
      await tx.workspace.upsert({
        where: { id: workspace.id },
        create: {
          id: data.id,
          name: data.name,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        },
        update: {
          name: data.name,
          updatedAt: data.updatedAt,
        },
      });

      await tx.workspaceMember.deleteMany({
        where: { workspaceId: workspace.id, userId: { notIn: memberIds } },
      });

      for (const member of data.members) {
        await tx.workspaceMember.upsert({
          where: { userId_workspaceId: { userId: member.userId, workspaceId: workspace.id } },
          create: {
            userId: member.userId,
            workspaceId: workspace.id,
            role: member.role as 'OWNER' | 'ADMIN' | 'MEMBER',
          },
          update: {
            role: member.role as 'OWNER' | 'ADMIN' | 'MEMBER',
          },
        });
      }
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
