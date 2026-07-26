import type { Workspace } from '@careeros/career';
import { Workspace as WorkspaceEntity } from '@careeros/career';
import { createWorkspaceId, createUserId } from '@careeros/career';

interface PrismaWorkspace {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  members?: Array<{
    userId: string;
    role: string;
  }>;
}

export class WorkspaceMapper {
  static toDomain(record: PrismaWorkspace): Workspace {
    const members = record.members ?? [];
    const owner = members.find((m) => m.role === 'OWNER');

    return WorkspaceEntity.reconstitute(createWorkspaceId(record.id), {
      name: record.name,
      ownerId: owner ? createUserId(owner.userId) : createUserId(''),
      memberIds: members.map((m) => createUserId(m.userId)),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toPersistence(workspace: Workspace): {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    members: { userId: string; role: string }[];
  } {
    return {
      id: workspace.id,
      name: workspace.name,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      members: workspace.memberIds.map((userId) => ({
        userId,
        role: workspace.isOwner(userId) ? 'OWNER' : 'MEMBER',
      })),
    };
  }
}
