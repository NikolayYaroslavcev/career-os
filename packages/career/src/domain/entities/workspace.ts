import { AggregateRoot } from '../base/aggregate-root.js';
import type { WorkspaceId, UserId } from '../base/identifier.js';

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER';

interface WorkspaceProps {
  name: string;
  ownerId: UserId;
  memberRoles: Map<UserId, WorkspaceRole>;
  createdAt: Date;
  updatedAt: Date;
}

export class Workspace extends AggregateRoot<WorkspaceId> {
  private props: WorkspaceProps;

  private constructor(id: WorkspaceId, props: WorkspaceProps) {
    super(id);
    this.props = props;
  }

  static create(params: {
    id: WorkspaceId;
    name: string;
    ownerId: UserId;
  }): Workspace {
    const now = new Date();

    return new Workspace(params.id, {
      name: params.name.trim(),
      ownerId: params.ownerId,
      memberRoles: new Map([[params.ownerId, 'OWNER']]),
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(id: WorkspaceId, props: WorkspaceProps): Workspace {
    return new Workspace(id, props);
  }

  get name(): string {
    return this.props.name;
  }

  get ownerId(): UserId {
    return this.props.ownerId;
  }

  get memberIds(): ReadonlyArray<UserId> {
    return [...this.props.memberRoles.keys()];
  }

  get members(): ReadonlyArray<{ userId: UserId; role: WorkspaceRole }> {
    return [...this.props.memberRoles.entries()].map(([userId, role]) => ({ userId, role }));
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  rename(name: string): void {
    this.props.name = name.trim();
    this.touch();
  }

  addMember(userId: UserId, role: Exclude<WorkspaceRole, 'OWNER'> = 'MEMBER'): void {
    if (!this.props.memberRoles.has(userId)) {
      this.props.memberRoles.set(userId, role);
      this.touch();
    }
  }

  removeMember(userId: UserId): void {
    if (userId === this.props.ownerId) {
      throw new Error('Cannot remove workspace owner');
    }

    if (this.props.memberRoles.delete(userId)) {
      this.touch();
    }
  }

  getMemberRole(userId: UserId): WorkspaceRole | undefined {
    return this.props.memberRoles.get(userId);
  }

  updateMemberRole(userId: UserId, role: Exclude<WorkspaceRole, 'OWNER'>): void {
    if (userId === this.props.ownerId) {
      throw new Error('Cannot change the workspace owner\'s role');
    }
    if (!this.props.memberRoles.has(userId)) {
      throw new Error('User is not a member of this workspace');
    }

    this.props.memberRoles.set(userId, role);
    this.touch();
  }

  isMember(userId: UserId): boolean {
    return this.props.memberRoles.has(userId);
  }

  isOwner(userId: UserId): boolean {
    return this.props.ownerId === userId;
  }

  transferOwnership(newOwnerId: UserId): void {
    if (!this.props.memberRoles.has(newOwnerId)) {
      throw new Error('New owner must be a workspace member');
    }

    this.props.memberRoles.set(this.props.ownerId, 'ADMIN');
    this.props.ownerId = newOwnerId;
    this.props.memberRoles.set(newOwnerId, 'OWNER');
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
    this.incrementVersion();
  }
}
