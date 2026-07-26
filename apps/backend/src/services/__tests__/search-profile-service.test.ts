import { describe, it, expect, beforeEach } from 'vitest';
import { ExperienceLevel } from '@careeros/career';
import { SearchProfileService, SearchProfileNotFoundError } from '../search-profile-service.js';
import { InMemorySearchProfileRepository } from '../../testing/in-memory-repositories.js';

describe('SearchProfileService', () => {
  let repository: InMemorySearchProfileRepository;
  let service: SearchProfileService;
  const userId = '11111111-1111-4111-8111-111111111111';
  const otherUserId = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => {
    repository = new InMemorySearchProfileRepository();
    service = new SearchProfileService(repository);
  });

  it('creates a search profile with the given criteria', async () => {
    const profile = await service.create({
      userId,
      workspaceId: 'workspace-1',
      name: 'Remote Backend Roles',
      desiredPositions: ['Backend Engineer'],
      desiredTechnologies: ['typescript', 'postgresql'],
      experienceLevel: ExperienceLevel.SENIOR,
      isRemoteOnly: true,
    });

    expect(profile.name).toBe('Remote Backend Roles');
    expect(profile.desiredTechnologies.map((t) => t.name)).toEqual(['typescript', 'postgresql']);
    expect(profile.isActive).toBe(true);
    expect(await repository.findById(profile.id)).not.toBeNull();
  });

  it('updates positions, technologies, and remote preference', async () => {
    const profile = await service.create({
      userId,
      workspaceId: 'workspace-1',
      name: 'Initial',
      desiredPositions: ['Backend Engineer'],
      experienceLevel: ExperienceLevel.MIDDLE,
    });

    const updated = await service.update(profile.id, userId, {
      name: 'Updated',
      desiredPositions: ['Staff Engineer'],
      desiredTechnologies: ['go'],
      isRemoteOnly: true,
    });

    expect(updated.name).toBe('Updated');
    expect(updated.desiredPositions).toEqual(['Staff Engineer']);
    expect(updated.desiredTechnologies.map((t) => t.name)).toEqual(['go']);
    expect(updated.isRemoteOnly).toBe(true);
  });

  it('enables and disables a search profile', async () => {
    const profile = await service.create({
      userId,
      workspaceId: 'workspace-1',
      name: 'Toggle Me',
      experienceLevel: ExperienceLevel.JUNIOR,
    });

    const disabled = await service.disable(profile.id, userId);
    expect(disabled.isActive).toBe(false);
    expect(await service.getActiveForUser(userId)).toBeNull();

    const enabled = await service.enable(profile.id, userId);
    expect(enabled.isActive).toBe(true);
    expect((await service.getActiveForUser(userId))?.id).toBe(profile.id);
  });

  it('throws SearchProfileNotFoundError for an unknown id', async () => {
    await expect(service.enable('does-not-exist', userId)).rejects.toThrow(SearchProfileNotFoundError);
  });

  it('deletes a search profile', async () => {
    const profile = await service.create({
      userId,
      workspaceId: 'workspace-1',
      name: 'Delete Me',
      experienceLevel: ExperienceLevel.JUNIOR,
    });

    await service.delete(profile.id, userId);

    expect(await repository.findById(profile.id)).toBeNull();
  });

  it('throws SearchProfileNotFoundError when deleting an unknown id', async () => {
    await expect(service.delete('does-not-exist', userId)).rejects.toThrow(SearchProfileNotFoundError);
  });

  describe('ownership', () => {
    it('getOwnedById returns null when the profile belongs to a different user', async () => {
      const profile = await service.create({
        userId,
        workspaceId: 'workspace-1',
        name: 'Mine',
        experienceLevel: ExperienceLevel.JUNIOR,
      });

      expect(await service.getOwnedById(profile.id, otherUserId)).toBeNull();
      expect(await service.getOwnedById(profile.id, userId)).not.toBeNull();
    });

    it('rejects update/delete/enable/disable from a non-owning user', async () => {
      const profile = await service.create({
        userId,
        workspaceId: 'workspace-1',
        name: 'Mine',
        experienceLevel: ExperienceLevel.JUNIOR,
      });

      await expect(service.update(profile.id, otherUserId, { name: 'Hijacked' })).rejects.toThrow(
        SearchProfileNotFoundError
      );
      await expect(service.enable(profile.id, otherUserId)).rejects.toThrow(SearchProfileNotFoundError);
      await expect(service.disable(profile.id, otherUserId)).rejects.toThrow(SearchProfileNotFoundError);
      await expect(service.delete(profile.id, otherUserId)).rejects.toThrow(SearchProfileNotFoundError);

      // Untouched — still owned by the original user and still active.
      expect((await repository.findById(profile.id))?.userId).toBe(profile.userId);
    });
  });
});
