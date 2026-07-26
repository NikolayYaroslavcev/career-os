import type { WorkspaceId, UserId } from '../base/identifier.js';
import type { Workspace } from '../entities/workspace.js';

export interface WorkspaceRepository {
  findById(id: WorkspaceId): Promise<Workspace | null>;
  findByOwnerId(ownerId: UserId): Promise<Workspace[]>;
  findByMemberId(memberId: UserId): Promise<Workspace[]>;
  save(workspace: Workspace): Promise<void>;
  delete(id: WorkspaceId): Promise<void>;
  exists(id: WorkspaceId): Promise<boolean>;
}
