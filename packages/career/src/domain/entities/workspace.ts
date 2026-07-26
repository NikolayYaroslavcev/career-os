import { AggregateRoot } from '../base/aggregate-root.js';
import type { WorkspaceId, UserId } from '../base/identifier.js';

interface WorkspaceProps {
  name: string;
  ownerId: UserId;
  memberIds: UserId[];
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
      memberIds: [params.ownerId],
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
    return [...this.props.memberIds];
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

  addMember(userId: UserId): void {
    if (!this.props.memberIds.includes(userId)) {
      this.props.memberIds.push(userId);
      this.touch();
    }
  }

  removeMember(userId: UserId): void {
    if (userId === this.props.ownerId) {
      throw new Error('Cannot remove workspace owner');
    }

    const index = this.props.memberIds.indexOf(userId);
    if (index !== -1) {
      this.props.memberIds.splice(index, 1);
      this.touch();
    }
  }

  isMember(userId: UserId): boolean {
    return this.props.memberIds.includes(userId);
  }

  isOwner(userId: UserId): boolean {
    return this.props.ownerId === userId;
  }

  transferOwnership(newOwnerId: UserId): void {
    if (!this.props.memberIds.includes(newOwnerId)) {
      throw new Error('New owner must be a workspace member');
    }

    this.props.ownerId = newOwnerId;
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
    this.incrementVersion();
  }
}
