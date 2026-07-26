import { describe, it, expect } from 'vitest';
import { SearchProfile, createSearchProfileId, createUserId, ExperienceLevel, Location, Salary, Technology } from '@careeros/career';
import { SearchProfileMapper } from '../search-profile-mapper.js';

describe('SearchProfileMapper', () => {
  it('round-trips a fully populated SearchProfile through the persistence shape', () => {
    const profile = SearchProfile.create({
      id: createSearchProfileId('11111111-1111-4111-8111-111111111111'),
      userId: createUserId('22222222-2222-4222-8222-222222222222'),
      name: 'Remote Backend Roles',
      desiredPositions: ['Backend Engineer'],
      desiredTechnologies: [Technology.create('typescript', 'language')],
      experienceLevel: ExperienceLevel.SENIOR,
      desiredSalary: Salary.create(80000, 120000, 'USD', 'yearly'),
      desiredLocations: [Location.create({ city: 'Berlin', country: 'DE', workMode: 'remote', isRelocationPossible: true })],
      isRemoteOnly: true,
    });

    const persisted = SearchProfileMapper.toPersistence(profile, 'workspace-1');
    expect(persisted.desiredPositions).toEqual(['Backend Engineer']);
    expect(persisted.desiredTechnologies).toEqual(['typescript']);
    expect(persisted.experienceLevel).toBe('senior');
    expect(persisted.salaryMin).toBe(80000);
    expect(persisted.salaryMax).toBe(120000);
    expect(persisted.locations).toEqual([
      { city: 'Berlin', country: 'DE', workMode: 'remote', isRelocationPossible: true },
    ]);
    expect(persisted.isRemoteOnly).toBe(true);

    const roundTripped = SearchProfileMapper.toDomain({
      id: persisted.id,
      name: persisted.name,
      desiredPositions: persisted.desiredPositions,
      desiredTechnologies: persisted.desiredTechnologies,
      experienceLevel: persisted.experienceLevel,
      salaryMin: persisted.salaryMin ?? null,
      salaryMax: persisted.salaryMax ?? null,
      salaryCurrency: persisted.salaryCurrency ?? null,
      salaryPeriod: persisted.salaryPeriod ?? null,
      locations: persisted.locations,
      isRemoteOnly: persisted.isRemoteOnly,
      isActive: persisted.isActive,
      createdAt: persisted.createdAt,
      updatedAt: persisted.updatedAt,
      userId: persisted.userId,
    });

    expect(roundTripped.name).toBe('Remote Backend Roles');
    expect(roundTripped.desiredPositions).toEqual(['Backend Engineer']);
    expect(roundTripped.desiredTechnologies.map((t) => t.name)).toEqual(['typescript']);
    expect(roundTripped.experienceLevel).toBe(ExperienceLevel.SENIOR);
    expect(roundTripped.desiredSalary?.min).toBe(80000);
    expect(roundTripped.desiredSalary?.max).toBe(120000);
    expect(roundTripped.desiredLocations[0]?.city).toBe('Berlin');
    expect(roundTripped.desiredLocations[0]?.workMode).toBe('remote');
    expect(roundTripped.isRemoteOnly).toBe(true);
  });

  it('handles a minimal profile with no salary or locations', () => {
    const profile = SearchProfile.create({
      id: createSearchProfileId('33333333-3333-4333-8333-333333333333'),
      userId: createUserId('44444444-4444-4444-8444-444444444444'),
      name: 'Minimal Profile',
      experienceLevel: ExperienceLevel.JUNIOR,
    });

    const persisted = SearchProfileMapper.toPersistence(profile, 'workspace-1');
    expect(persisted.salaryMin).toBeUndefined();
    expect(persisted.locations).toEqual([]);
    expect(persisted.isActive).toBe(true);
  });
});
