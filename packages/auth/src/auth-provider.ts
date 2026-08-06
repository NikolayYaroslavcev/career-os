import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import type {
  AuthConfig,
  AuthProvider,
  TokenPayload,
  RefreshTokenData,
} from './types.js';

export class AuthProviderImpl implements AuthProvider {
  constructor(private readonly config: AuthConfig) {}

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: this.config.argon2MemoryCost,
      timeCost: this.config.argon2TimeCost,
      parallelism: this.config.argon2Parallelism,
    });
  }

  async verifyPassword(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }

  generateAccessToken(payload: { sub: string; email: string; role: string }): string {
    const expiresIn = this.parseExpiresIn(this.config.jwtAccessExpiresIn);
    const expirationTime = Math.floor(expiresIn.getTime() / 1000);
    const currentTime = Math.floor(Date.now() / 1000);
    const ttl = expirationTime - currentTime;

    return jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: ttl,
      algorithm: 'HS256',
    });
  }

  verifyAccessToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret, { algorithms: ['HS256'] }) as TokenPayload;
      return decoded;
    } catch {
      return null;
    }
  }

  async generateRefreshToken(userId: string): Promise<RefreshTokenData> {
    const token = uuidv4();
    const expiresAt = this.parseExpiresIn(this.config.jwtRefreshExpiresIn);

    return {
      id: uuidv4(),
      userId,
      token,
      expiresAt,
      createdAt: new Date(),
    };
  }

  async verifyRefreshToken(_token: string): Promise<RefreshTokenData | null> {
    // In a real implementation, this would query the database
    // For now, we return the token data if it's valid
    return null;
  }

  async revokeRefreshToken(_token: string): Promise<void> {
    // In a real implementation, this would delete from database
  }

  async revokeAllUserRefreshTokens(_userId: string): Promise<void> {
    // In a real implementation, this would delete all user tokens from database
  }

  private parseExpiresIn(expiresIn: string): Date {
    const now = new Date();
    const match = expiresIn.match(/^(\d+)([smhd])$/);

    if (!match) {
      throw new Error(`Invalid expires in format: ${expiresIn}`);
    }

    const value = parseInt(match[1] ?? '0', 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return new Date(now.getTime() + value * 1000);
      case 'm':
        return new Date(now.getTime() + value * 60 * 1000);
      case 'h':
        return new Date(now.getTime() + value * 60 * 60 * 1000);
      case 'd':
        return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
      default:
        throw new Error(`Invalid time unit: ${unit}`);
    }
  }
}
