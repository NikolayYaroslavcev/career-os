import { prisma } from '@careeros/database';
import type { PrismaClient } from '@careeros/database';
import type { IAuthProvider, AuthResult } from '@careeros/auth';
import type { UserRepository } from '@careeros/career';
import { User, Email, createUserId, createWorkspaceId } from '@careeros/career';
import type { WorkspaceRepository } from '@careeros/career';
import { Workspace } from '@careeros/career';
import { ConflictError, UnauthorizedError, NotFoundError } from '../middleware/error-handler.js';

type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export interface RefreshTokenData {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export class AuthService {
  constructor(
    private readonly authProvider: IAuthProvider,
    private readonly userRepository: UserRepository,
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly refreshTokenRepository: {
      create(data: RefreshTokenData): Promise<void>;
      findByToken(token: string): Promise<RefreshTokenData | null>;
      delete(token: string): Promise<void>;
      deleteAllForUser(userId: string): Promise<void>;
    }
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const email = Email.create(input.email);

    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    const passwordHash = await this.authProvider.hashPassword(input.password);
    const userId = createUserId(crypto.randomUUID());

    const user = User.create({
      id: userId,
      email,
      firstName: input.firstName,
      lastName: input.lastName,
    });

    const workspace = Workspace.create({
      id: createWorkspaceId(crypto.randomUUID()),
      name: `${input.firstName}'s Workspace`,
      ownerId: userId,
    });

    const accessToken = this.authProvider.generateAccessToken({
      sub: userId,
      email: email.value,
    });
    const refreshTokenData = await this.authProvider.generateRefreshToken(userId);

    // Every write below must succeed or none must apply — a partial failure
    // used to leave a user with no workspace and/or no password hash,
    // permanently locked out (and unable to re-register, since the email
    // conflict check above would already see them as existing).
    await prisma.$transaction(async (tx: TransactionClient) => {
      await tx.user.create({
        data: {
          id: user.id,
          email: email.value,
          passwordHash,
          firstName: user.firstName,
          lastName: user.lastName,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });

      await tx.workspace.create({
        data: {
          id: workspace.id,
          name: workspace.name,
          createdAt: workspace.createdAt,
          updatedAt: workspace.updatedAt,
          members: {
            create: [{ userId: user.id, role: 'OWNER' }],
          },
        },
      });

      await tx.refreshToken.create({
        data: {
          id: refreshTokenData.id,
          userId: refreshTokenData.userId,
          token: refreshTokenData.token,
          expiresAt: refreshTokenData.expiresAt,
          createdAt: refreshTokenData.createdAt,
        },
      });
    });

    return {
      accessToken,
      refreshToken: refreshTokenData.token,
      user: {
        id: userId,
        email: email.value,
      },
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const email = Email.create(input.email);

    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const passwordHash = await this.getPasswordHash(user.id);
    if (!passwordHash) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isValid = await this.authProvider.verifyPassword(passwordHash, input.password);
    if (!isValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const accessToken = this.authProvider.generateAccessToken({
      sub: user.id,
      email: email.value,
    });

    const refreshTokenData = await this.authProvider.generateRefreshToken(user.id);
    await this.refreshTokenRepository.create({
      id: refreshTokenData.id,
      userId: refreshTokenData.userId,
      token: refreshTokenData.token,
      expiresAt: refreshTokenData.expiresAt,
      createdAt: refreshTokenData.createdAt,
    });

    return {
      accessToken,
      refreshToken: refreshTokenData.token,
      user: {
        id: user.id,
        email: email.value,
      },
    };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenData = await this.refreshTokenRepository.findByToken(refreshToken);
    if (!tokenData) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    if (new Date(tokenData.expiresAt) < new Date()) {
      await this.refreshTokenRepository.delete(refreshToken);
      throw new UnauthorizedError('Refresh token expired');
    }

    const user = await this.userRepository.findById(createUserId(tokenData.userId));
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    await this.refreshTokenRepository.delete(refreshToken);

    const accessToken = this.authProvider.generateAccessToken({
      sub: user.id,
      email: user.email.value,
    });

    const newRefreshTokenData = await this.authProvider.generateRefreshToken(user.id);
    await this.refreshTokenRepository.create({
      id: newRefreshTokenData.id,
      userId: newRefreshTokenData.userId,
      token: newRefreshTokenData.token,
      expiresAt: newRefreshTokenData.expiresAt,
      createdAt: newRefreshTokenData.createdAt,
    });

    return {
      accessToken,
      refreshToken: newRefreshTokenData.token,
    };
  }

  /** Revokes a single refresh token (single-device logout). Idempotent — succeeds even if the token is already gone
   * (Prisma's delete throws P2025 on a missing row, so existence is checked first rather than delete-and-catch). */
  async logout(refreshToken: string): Promise<void> {
    const tokenData = await this.refreshTokenRepository.findByToken(refreshToken);
    if (!tokenData) return;
    await this.refreshTokenRepository.delete(refreshToken);
  }

  /** Revokes every refresh token for a user ("log out everywhere" / forced session invalidation). */
  async logoutAll(userId: string): Promise<void> {
    await this.refreshTokenRepository.deleteAllForUser(userId);
  }

  async getUserById(userId: string): Promise<{ id: string; email: string; firstName: string; lastName: string }> {
    const user = await this.userRepository.findById(createUserId(userId));
    if (!user) {
      throw new NotFoundError('User');
    }

    return {
      id: user.id,
      email: user.email.value,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }

  async updateProfile(
    userId: string,
    input: { firstName?: string; lastName?: string }
  ): Promise<{ id: string; email: string; firstName: string; lastName: string }> {
    const user = await this.userRepository.findById(createUserId(userId));
    if (!user) {
      throw new NotFoundError('User');
    }

    user.updateName(input.firstName ?? user.firstName, input.lastName ?? user.lastName);
    await this.userRepository.save(user);

    return {
      id: user.id,
      email: user.email.value,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }

  private async getPasswordHash(userId: string): Promise<string | null> {
    const record = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    return record?.passwordHash ?? null;
  }
}
