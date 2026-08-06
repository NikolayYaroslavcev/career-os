import type { UserRepository, WorkspaceRepository, WorkspaceRole } from '@careeros/career';
import { Workspace, Email, createUserId, createWorkspaceId } from '@careeros/career';
import { ForbiddenError, NotFoundError } from '../middleware/error-handler.js';

export interface WorkspaceSummary {
  id: string;
  name: string;
  role: WorkspaceRole;
}

type ManageableRole = Exclude<WorkspaceRole, 'OWNER'>;

export class WorkspaceService {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly userRepository: UserRepository
  ) {}

  async listForUser(userId: string): Promise<WorkspaceSummary[]> {
    const requesterId = createUserId(userId);
    const workspaces = await this.workspaceRepository.findByMemberId(requesterId);

    return workspaces.map((workspace) => ({
      id: workspace.id,
      name: workspace.name,
      // Always defined: findByMemberId only returns workspaces this user belongs to.
      role: workspace.getMemberRole(requesterId) as WorkspaceRole,
    }));
  }

  async create(userId: string, name: string): Promise<WorkspaceSummary> {
    const workspace = Workspace.create({
      id: createWorkspaceId(crypto.randomUUID()),
      name,
      ownerId: createUserId(userId),
    });

    await this.workspaceRepository.save(workspace);

    return { id: workspace.id, name: workspace.name, role: 'OWNER' };
  }

  async inviteMember(workspaceId: string, requesterId: string, email: string, role: ManageableRole): Promise<void> {
    const workspace = await this.requireWorkspace(workspaceId);
    this.requireManager(workspace, requesterId);

    const targetUser = await this.userRepository.findByEmail(Email.create(email));
    if (!targetUser) {
      throw new NotFoundError('User');
    }

    workspace.addMember(targetUser.id, role);
    await this.workspaceRepository.save(workspace);
  }

  async updateMemberRole(workspaceId: string, requesterId: string, targetUserId: string, role: ManageableRole): Promise<void> {
    const workspace = await this.requireWorkspace(workspaceId);
    this.requireManager(workspace, requesterId);

    const targetId = createUserId(targetUserId);
    if (workspace.isOwner(targetId)) {
      throw new ForbiddenError("Cannot change the workspace owner's role");
    }
    if (!workspace.isMember(targetId)) {
      throw new NotFoundError('Member');
    }

    workspace.updateMemberRole(targetId, role);
    await this.workspaceRepository.save(workspace);
  }

  private async requireWorkspace(workspaceId: string): Promise<Workspace> {
    const workspace = await this.workspaceRepository.findById(createWorkspaceId(workspaceId));
    if (!workspace) {
      throw new NotFoundError('Workspace');
    }
    return workspace;
  }

  private requireManager(workspace: Workspace, requesterId: string): void {
    const role = workspace.getMemberRole(createUserId(requesterId));
    if (role !== 'OWNER' && role !== 'ADMIN') {
      throw new ForbiddenError('Only workspace owners or admins can manage members');
    }
  }
}
