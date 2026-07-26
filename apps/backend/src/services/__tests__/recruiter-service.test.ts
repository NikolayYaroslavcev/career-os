import { describe, it, expect, beforeEach } from 'vitest';
import { RecruiterService, RecruiterNotFoundError } from '../recruiter-service.js';
import { InMemoryRecruiterRepository } from '../../testing/in-memory-repositories.js';

describe('RecruiterService', () => {
  let repository: InMemoryRecruiterRepository;
  let service: RecruiterService;
  const workspaceId = 'workspace-1';
  const otherWorkspaceId = 'workspace-2';

  beforeEach(() => {
    repository = new InMemoryRecruiterRepository();
    service = new RecruiterService(repository);
  });

  it('creates a recruiter scoped to a workspace', async () => {
    const recruiter = await service.create({
      workspaceId,
      name: 'Jane Doe',
      email: 'jane@example.com',
    });

    expect(recruiter.name).toBe('Jane Doe');
    expect(await repository.findById(recruiter.id)).not.toBeNull();
    expect(await repository.findByWorkspaceId(workspaceId)).toHaveLength(1);
  });

  it('only lists recruiters within the given workspace', async () => {
    await service.create({ workspaceId, name: 'Jane Doe' });
    await service.create({ workspaceId: otherWorkspaceId, name: 'John Smith' });

    const workspaceOne = await service.listByWorkspace(workspaceId);
    expect(workspaceOne).toHaveLength(1);
    expect(workspaceOne[0]?.name).toBe('Jane Doe');
  });

  it('updates contact info', async () => {
    const recruiter = await service.create({ workspaceId, name: 'Jane Doe' });
    const updated = await service.update(recruiter.id, workspaceId, { phone: '+1 555 0100' });
    expect(updated.phone).toBe('+1 555 0100');
  });

  it('throws RecruiterNotFoundError when updating an unknown recruiter', async () => {
    await expect(service.update('does-not-exist', workspaceId, { name: 'X' })).rejects.toThrow(
      RecruiterNotFoundError
    );
  });

  it('deletes a recruiter', async () => {
    const recruiter = await service.create({ workspaceId, name: 'Jane Doe' });
    await service.delete(recruiter.id, workspaceId);
    expect(await repository.findById(recruiter.id)).toBeNull();
  });

  it('throws RecruiterNotFoundError when deleting an unknown recruiter', async () => {
    await expect(service.delete('does-not-exist', workspaceId)).rejects.toThrow(RecruiterNotFoundError);
  });

  describe('ownership', () => {
    it('getOwnedById returns null when the recruiter belongs to a different workspace', async () => {
      const recruiter = await service.create({ workspaceId, name: 'Jane Doe' });

      expect(await service.getOwnedById(recruiter.id, otherWorkspaceId)).toBeNull();
      expect(await service.getOwnedById(recruiter.id, workspaceId)).not.toBeNull();
    });

    it('rejects update/delete from a non-owning workspace', async () => {
      const recruiter = await service.create({ workspaceId, name: 'Jane Doe' });

      await expect(service.update(recruiter.id, otherWorkspaceId, { name: 'Hijacked' })).rejects.toThrow(
        RecruiterNotFoundError
      );
      await expect(service.delete(recruiter.id, otherWorkspaceId)).rejects.toThrow(RecruiterNotFoundError);

      const stillThere = await repository.findById(recruiter.id);
      expect(stillThere?.name).toBe('Jane Doe');
    });
  });
});
