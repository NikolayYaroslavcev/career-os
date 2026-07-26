import {
  SearchProfile,
  createSearchProfileId,
  createUserId,
  Location,
  Salary,
  Technology,
} from '@careeros/career';
import type { SearchProfileRepository, ExperienceLevel } from '@careeros/career';

export interface SearchProfileSalaryInput {
  readonly min: number;
  readonly max: number;
  readonly currency: 'USD' | 'EUR' | 'GBP' | 'UAH' | 'RUB';
  readonly period: 'monthly' | 'yearly' | 'hourly';
}

export interface SearchProfileLocationInput {
  readonly city?: string;
  readonly country?: string;
  readonly workMode: 'remote' | 'hybrid' | 'onsite';
  readonly isRelocationPossible?: boolean;
}

export interface CreateSearchProfileInput {
  readonly userId: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly desiredPositions?: readonly string[];
  readonly desiredTechnologies?: readonly string[];
  readonly experienceLevel: ExperienceLevel;
  readonly desiredSalary?: SearchProfileSalaryInput;
  readonly desiredLocations?: readonly SearchProfileLocationInput[];
  readonly isRemoteOnly?: boolean;
}

export interface UpdateSearchProfileInput {
  readonly name?: string;
  readonly desiredPositions?: readonly string[];
  readonly desiredTechnologies?: readonly string[];
  readonly experienceLevel?: ExperienceLevel;
  readonly desiredSalary?: SearchProfileSalaryInput;
  readonly desiredLocations?: readonly SearchProfileLocationInput[];
  readonly isRemoteOnly?: boolean;
}

export class SearchProfileNotFoundError extends Error {
  constructor(id: string) {
    super(`SearchProfile '${id}' not found`);
    this.name = 'SearchProfileNotFoundError';
  }
}

export class SearchProfileService {
  constructor(private readonly repository: SearchProfileRepository) {}

  async create(input: CreateSearchProfileInput): Promise<SearchProfile> {
    const profile = SearchProfile.create({
      id: createSearchProfileId(crypto.randomUUID()),
      userId: createUserId(input.userId),
      name: input.name,
      desiredPositions: input.desiredPositions ? [...input.desiredPositions] : undefined,
      desiredTechnologies: (input.desiredTechnologies ?? []).map((name) => Technology.create(name, 'other')),
      experienceLevel: input.experienceLevel,
      desiredSalary: input.desiredSalary
        ? Salary.create(input.desiredSalary.min, input.desiredSalary.max, input.desiredSalary.currency, input.desiredSalary.period)
        : undefined,
      desiredLocations: (input.desiredLocations ?? []).map((location) => Location.create(location)),
      isRemoteOnly: input.isRemoteOnly,
    });

    await this.repository.save(profile, { workspaceId: input.workspaceId });
    return profile;
  }

  async update(id: string, userId: string, input: UpdateSearchProfileInput): Promise<SearchProfile> {
    const profile = await this.getOwned(id, userId);

    if (input.name !== undefined) {
      profile.updateName(input.name);
    }

    if (input.desiredPositions !== undefined) {
      for (const position of [...profile.desiredPositions]) {
        profile.removeDesiredPosition(position);
      }
      for (const position of input.desiredPositions) {
        profile.addDesiredPosition(position);
      }
    }

    if (input.desiredTechnologies !== undefined) {
      for (const technology of [...profile.desiredTechnologies]) {
        profile.removeDesiredTechnology(technology);
      }
      for (const name of input.desiredTechnologies) {
        profile.addDesiredTechnology(Technology.create(name, 'other'));
      }
    }

    if (input.experienceLevel !== undefined) {
      profile.updateExperienceLevel(input.experienceLevel);
    }

    if (input.desiredSalary !== undefined) {
      profile.updateDesiredSalary(
        Salary.create(input.desiredSalary.min, input.desiredSalary.max, input.desiredSalary.currency, input.desiredSalary.period)
      );
    }

    if (input.desiredLocations !== undefined) {
      while (profile.desiredLocations.length > 0) {
        profile.removeDesiredLocation(0);
      }
      for (const location of input.desiredLocations) {
        profile.addDesiredLocation(Location.create(location));
      }
    }

    if (input.isRemoteOnly !== undefined) {
      profile.setRemoteOnly(input.isRemoteOnly);
    }

    await this.repository.save(profile, {});
    return profile;
  }

  async enable(id: string, userId: string): Promise<SearchProfile> {
    const profile = await this.getOwned(id, userId);
    profile.activate();
    await this.repository.save(profile, {});
    return profile;
  }

  async disable(id: string, userId: string): Promise<SearchProfile> {
    const profile = await this.getOwned(id, userId);
    profile.deactivate();
    await this.repository.save(profile, {});
    return profile;
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.getOwned(id, userId);
    await this.repository.delete(createSearchProfileId(id));
  }

  async getOwnedById(id: string, userId: string): Promise<SearchProfile | null> {
    const profile = await this.repository.findById(createSearchProfileId(id));
    if (!profile || profile.userId !== createUserId(userId)) {
      return null;
    }
    return profile;
  }

  async listByUser(userId: string): Promise<SearchProfile[]> {
    return this.repository.findByUserId(createUserId(userId));
  }

  async getActiveForUser(userId: string): Promise<SearchProfile | null> {
    return this.repository.findActiveByUserId(createUserId(userId));
  }

  /** Fetches a profile and verifies it belongs to `userId`. Throws (not found — never
   * reveals whether the id belongs to someone else) if missing or owned by another user. */
  private async getOwned(id: string, userId: string): Promise<SearchProfile> {
    const profile = await this.repository.findById(createSearchProfileId(id));
    if (!profile || profile.userId !== createUserId(userId)) {
      throw new SearchProfileNotFoundError(id);
    }
    return profile;
  }
}
