import { prisma } from '../client.js';

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export class PrismaRefreshTokenRepository {
  async create(data: RefreshTokenRecord): Promise<void> {
    await prisma.refreshToken.create({
      data: {
        id: data.id,
        userId: data.userId,
        token: data.token,
        expiresAt: data.expiresAt,
        createdAt: data.createdAt,
      },
    });
  }

  async findByToken(token: string): Promise<RefreshTokenRecord | null> {
    const record = await prisma.refreshToken.findUnique({
      where: { token },
    });

    if (!record) {
      return null;
    }

    return {
      id: record.id,
      userId: record.userId,
      token: record.token,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
    };
  }

  async delete(token: string): Promise<void> {
    await prisma.refreshToken.delete({
      where: { token },
    });
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  async deleteExpired(): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  }
}
