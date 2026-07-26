import type { SearchProfileId, UserId } from '../base/identifier.js';
import type { SearchProfile } from '../entities/search-profile.js';

export interface SaveSearchProfileOptions {
  workspaceId?: string;
}

export interface SearchProfileRepository {
  findById(id: SearchProfileId): Promise<SearchProfile | null>;
  findByUserId(userId: UserId): Promise<SearchProfile[]>;
  findActiveByUserId(userId: UserId): Promise<SearchProfile | null>;
  save(searchProfile: SearchProfile, options: SaveSearchProfileOptions): Promise<void>;
  delete(id: SearchProfileId): Promise<void>;
  exists(id: SearchProfileId): Promise<boolean>;
}
