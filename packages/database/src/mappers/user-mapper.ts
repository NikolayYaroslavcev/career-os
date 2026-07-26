import { User as UserEntity } from '@careeros/career';
import { Email } from '@careeros/career';
import { createUserId, createWorkspaceId } from '@careeros/career';
import type { UserRole } from '@careeros/career';

interface PrismaUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date;
  updatedAt: Date;
  workspaces?: Array<{ workspaceId: string }>;
}

export class UserMapper {
  static toDomain(record: PrismaUser): UserEntity {
    const email = Email.create(record.email);

    return UserEntity.reconstitute(createUserId(record.id), {
      email,
      firstName: record.firstName ?? '',
      lastName: record.lastName ?? '',
      role: 'JOB_SEEKER' as UserRole,
      workspaceIds: (record.workspaces ?? []).map((w) =>
        createWorkspaceId(w.workspaceId)
      ),
      isActive: true,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toPersistence(user: { id: string; email: { value: string }; firstName: string; lastName: string; createdAt: Date; updatedAt: Date }): {
    id: string;
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: user.id,
      email: user.email.value,
      passwordHash: '',
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
