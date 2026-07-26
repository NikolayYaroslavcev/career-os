import type { UserRepository } from '@careeros/career';
import type { UserId } from '@careeros/career';
import type { User } from '@careeros/career';
import type { Email } from '@careeros/career';
import { prisma } from '../client.js';
import { UserMapper } from '../mappers/user-mapper.js';

export class PrismaUserRepository implements UserRepository {
  async findById(id: UserId): Promise<User | null> {
    const record = await prisma.user.findUnique({
      where: { id },
      include: { workspaces: { select: { workspaceId: true } } },
    });

    if (!record) {
      return null;
    }

    return UserMapper.toDomain(record);
  }

  async findByEmail(email: Email): Promise<User | null> {
    const record = await prisma.user.findUnique({
      where: { email: email.value },
      include: { workspaces: { select: { workspaceId: true } } },
    });

    if (!record) {
      return null;
    }

    return UserMapper.toDomain(record);
  }

  async save(user: User): Promise<void> {
    const data = UserMapper.toPersistence(user);

    await prisma.user.upsert({
      where: { id: user.id },
      create: data,
      update: data,
    });
  }

  async delete(id: UserId): Promise<void> {
    await prisma.user.delete({
      where: { id },
    });
  }

  async exists(id: UserId): Promise<boolean> {
    const count = await prisma.user.count({
      where: { id },
    });

    return count > 0;
  }
}
