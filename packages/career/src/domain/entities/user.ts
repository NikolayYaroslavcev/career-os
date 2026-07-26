import { AggregateRoot } from '../base/aggregate-root.js';
import type { UserId, WorkspaceId } from '../base/identifier.js';
import { Email } from '../value-objects/email.js';
import { UserRole } from '../enums/user-role.js';

interface UserProps {
  email: Email;
  firstName: string;
  lastName: string;
  role: UserRole;
  workspaceIds: WorkspaceId[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class User extends AggregateRoot<UserId> {
  private props: UserProps;

  private constructor(id: UserId, props: UserProps) {
    super(id);
    this.props = props;
  }

  static create(params: {
    id: UserId;
    email: Email;
    firstName: string;
    lastName: string;
    role?: UserRole;
  }): User {
    const now = new Date();

    return new User(params.id, {
      email: params.email,
      firstName: params.firstName.trim(),
      lastName: params.lastName.trim(),
      role: params.role ?? UserRole.JOB_SEEKER,
      workspaceIds: [],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(id: UserId, props: UserProps): User {
    return new User(id, props);
  }

  get email(): Email {
    return this.props.email;
  }

  get firstName(): string {
    return this.props.firstName;
  }

  get lastName(): string {
    return this.props.lastName;
  }

  get fullName(): string {
    return `${this.props.firstName} ${this.props.lastName}`;
  }

  get role(): UserRole {
    return this.props.role;
  }

  get workspaceIds(): ReadonlyArray<WorkspaceId> {
    return [...this.props.workspaceIds];
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  changeEmail(email: Email): void {
    this.props.email = email;
    this.touch();
  }

  updateName(firstName: string, lastName: string): void {
    this.props.firstName = firstName.trim();
    this.props.lastName = lastName.trim();
    this.touch();
  }

  assignRole(role: UserRole): void {
    this.props.role = role;
    this.touch();
  }

  addToWorkspace(workspaceId: WorkspaceId): void {
    if (!this.props.workspaceIds.includes(workspaceId)) {
      this.props.workspaceIds.push(workspaceId);
      this.touch();
    }
  }

  removeFromWorkspace(workspaceId: WorkspaceId): void {
    const index = this.props.workspaceIds.indexOf(workspaceId);
    if (index !== -1) {
      this.props.workspaceIds.splice(index, 1);
      this.touch();
    }
  }

  deactivate(): void {
    this.props.isActive = false;
    this.touch();
  }

  activate(): void {
    this.props.isActive = true;
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
    this.incrementVersion();
  }
}
