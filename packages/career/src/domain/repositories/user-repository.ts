import type { UserId } from '../base/identifier.js';
import type { User } from '../entities/user.js';
import type { Email } from '../value-objects/email.js';

export interface UserRepository {
  findById(id: UserId): Promise<User | null>;
  findByEmail(email: Email): Promise<User | null>;
  save(user: User): Promise<void>;
  delete(id: UserId): Promise<void>;
  exists(id: UserId): Promise<boolean>;
}
