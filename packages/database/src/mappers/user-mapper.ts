import { User as UserEntity } from '@careeros/career';
import { Email } from '@careeros/career';
import { createUserId, createWorkspaceId } from '@careeros/career';
import type { UserRole } from '@careeros/career';

interface PrismaUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
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
      role: record.role.toLowerCase() as UserRole,
      workspaceIds: (record.workspaces ?? []).map((w) =>
        createWorkspaceId(w.workspaceId)
      ),
      isActive: true,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  // Deliberately excludes passwordHash: the domain User entity never carries
  // it (registration writes the real hash directly via a separate Prisma
  // call — see AuthService.register), so this mapper has no real value to
  // persist here. It previously defaulted to '', and since save() below used
  // to upsert this payload, every profile update silently wiped the user's
  // real password hash, permanently locking them out.
  static toPersistence(user: { id: string; email: { value: string }; firstName: string; lastName: string; role: UserRole; createdAt: Date; updatedAt: Date }): {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: 'JOB_SEEKER' | 'RECRUITER' | 'ADMIN';
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: user.id,
      email: user.email.value,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role.toUpperCase() as 'JOB_SEEKER' | 'RECRUITER' | 'ADMIN',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
