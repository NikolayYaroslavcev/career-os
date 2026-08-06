export interface AuthConfig {
  jwtSecret: string;
  jwtAccessExpiresIn: string;
  jwtRefreshExpiresIn: string;
  argon2MemoryCost: number;
  argon2TimeCost: number;
  argon2Parallelism: number;
}

export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenData {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export interface AuthProvider {
  hashPassword(password: string): Promise<string>;
  verifyPassword(hash: string, password: string): Promise<boolean>;
  generateAccessToken(payload: { sub: string; email: string; role: string }): string;
  verifyAccessToken(token: string): TokenPayload | null;
  generateRefreshToken(userId: string): Promise<RefreshTokenData>;
  verifyRefreshToken(token: string): Promise<RefreshTokenData | null>;
  revokeRefreshToken(token: string): Promise<void>;
  revokeAllUserRefreshTokens(userId: string): Promise<void>;
}
