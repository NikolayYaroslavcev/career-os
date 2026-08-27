import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyRequest } from 'fastify';
import { UserRole } from '@careeros/career';
import { socialMessageIngestRoutes } from '../social-messages/social-message-ingest-routes.js';
import { errorHandler } from '../../middleware/error-handler.js';

function createMockContainer(overrides: {
  ingestPushedCandidate: ReturnType<typeof vi.fn>;
  processPendingBySource?: ReturnType<typeof vi.fn>;
}) {
  return {
    repositories: {
      user: {
        findById: vi.fn().mockResolvedValue({ id: 'user-1', workspaceIds: ['ws-1'] }),
      },
    },
    services: {
      socialMessageIngestion: {
        ingestPushedCandidate: overrides.ingestPushedCandidate,
      },
      socialMessagePipeline: {
        processPendingBySource: overrides.processPendingBySource ?? vi.fn().mockResolvedValue({
          processed: 0, skippedPrecheck: 0, extracted: 0, lowConfidence: 0, spam: 0, failed: 0,
        }),
      },
    },
  };
}

const validBody = {
  platform: 'LINKEDIN',
  externalMessageId: 'urn:li:activity:123',
  authorUsername: 'Jane Doe',
  rawText: 'We are hiring a senior engineer',
  links: ['https://example.com/careers'],
};

describe('Social Message Ingest Routes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(() => {
    app = Fastify();
    app.setErrorHandler(errorHandler);
  });

  it('creates a SocialMessage for a new LinkedIn candidate', async () => {
    const ingestPushedCandidate = vi.fn().mockResolvedValue({
      ok: true,
      created: true,
      message: { id: 'msg-1' },
    });
    app.addHook('onRequest', async (request: FastifyRequest) => {
      request.user = { id: 'user-1', email: 'user-1@example.com', role: UserRole.JOB_SEEKER };
    });
    app.decorate('container', createMockContainer({ ingestPushedCandidate }));
    await app.register(socialMessageIngestRoutes);

    const response = await app.inject({ method: 'POST', url: '/ingest', payload: validBody });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ ok: true, messageId: 'msg-1', created: true });
    expect(ingestPushedCandidate).toHaveBeenCalledWith(
      'linkedin-feed',
      'LINKEDIN',
      'BROWSER_EXTENSION',
      expect.objectContaining({
        sourceId: 'linkedin-feed:ws-1',
        externalMessageId: 'urn:li:activity:123',
        authorUsername: 'Jane Doe',
        rawText: 'We are hiring a senior engineer',
        links: ['https://example.com/careers'],
      }),
    );
  });

  it('is idempotent: ingesting the same externalMessageId twice does not create a second SocialMessage', async () => {
    const ingestPushedCandidate = vi.fn()
      .mockResolvedValueOnce({ ok: true, created: true, message: { id: 'msg-1' } })
      .mockResolvedValueOnce({ ok: true, created: false, message: { id: 'msg-1' } });
    app.addHook('onRequest', async (request: FastifyRequest) => {
      request.user = { id: 'user-1', email: 'user-1@example.com', role: UserRole.JOB_SEEKER };
    });
    app.decorate('container', createMockContainer({ ingestPushedCandidate }));
    await app.register(socialMessageIngestRoutes);

    const first = await app.inject({ method: 'POST', url: '/ingest', payload: validBody });
    const second = await app.inject({ method: 'POST', url: '/ingest', payload: validBody });

    expect(first.json()).toEqual({ ok: true, messageId: 'msg-1', created: true });
    expect(second.json()).toEqual({ ok: true, messageId: 'msg-1', created: false });
  });

  it('runs the SocialMessage pipeline for this source only when a new message was created', async () => {
    const processPendingBySource = vi.fn().mockResolvedValue({ processed: 1, skippedPrecheck: 0, extracted: 1, lowConfidence: 0, spam: 0, failed: 0 });
    const ingestPushedCandidate = vi.fn()
      .mockResolvedValueOnce({ ok: true, created: true, message: { id: 'msg-1' } })
      .mockResolvedValueOnce({ ok: true, created: false, message: { id: 'msg-1' } });
    app.addHook('onRequest', async (request: FastifyRequest) => {
      request.user = { id: 'user-1', email: 'user-1@example.com', role: UserRole.JOB_SEEKER };
    });
    app.decorate('container', createMockContainer({ ingestPushedCandidate, processPendingBySource }));
    await app.register(socialMessageIngestRoutes);

    await app.inject({ method: 'POST', url: '/ingest', payload: validBody });
    expect(processPendingBySource).toHaveBeenCalledWith('LINKEDIN', 'linkedin-feed:ws-1');

    processPendingBySource.mockClear();
    await app.inject({ method: 'POST', url: '/ingest', payload: validBody });
    expect(processPendingBySource).not.toHaveBeenCalled();
  });

  it('derives sourceId from the authenticated user workspace, never from the request body', async () => {
    const ingestPushedCandidate = vi.fn().mockResolvedValue({ ok: true, created: true, message: { id: 'msg-1' } });
    app.addHook('onRequest', async (request: FastifyRequest) => {
      request.user = { id: 'user-1', email: 'user-1@example.com', role: UserRole.JOB_SEEKER };
    });
    app.decorate('container', createMockContainer({ ingestPushedCandidate }));
    await app.register(socialMessageIngestRoutes);

    await app.inject({
      method: 'POST',
      url: '/ingest',
      payload: { ...validBody, sourceId: 'attacker-supplied-source', workspaceId: 'someone-elses-workspace' },
    });

    expect(ingestPushedCandidate).toHaveBeenCalledWith(
      'linkedin-feed',
      'LINKEDIN',
      'BROWSER_EXTENSION',
      expect.objectContaining({ sourceId: 'linkedin-feed:ws-1' }),
    );
  });

  it('scopes different users to different LinkedIn Feed sources (workspace isolation)', async () => {
    const ingestPushedCandidate = vi.fn().mockResolvedValue({ ok: true, created: true, message: { id: 'msg-1' } });
    const container = {
      repositories: {
        user: {
          findById: vi.fn((id: { toString(): string }) =>
            Promise.resolve(
              id.toString() === 'user-1'
                ? { id: 'user-1', workspaceIds: ['ws-1'] }
                : { id: 'user-2', workspaceIds: ['ws-2'] },
            ),
          ),
        },
      },
      services: {
        socialMessageIngestion: { ingestPushedCandidate },
        socialMessagePipeline: { processPendingBySource: vi.fn().mockResolvedValue({ processed: 0, skippedPrecheck: 0, extracted: 0, lowConfidence: 0, spam: 0, failed: 0 }) },
      },
    };
    app.addHook('onRequest', async (request: FastifyRequest) => {
      request.user = { id: 'user-2', email: 'user-2@example.com', role: UserRole.JOB_SEEKER };
    });
    app.decorate('container', container);
    await app.register(socialMessageIngestRoutes);

    await app.inject({ method: 'POST', url: '/ingest', payload: validBody });

    expect(ingestPushedCandidate).toHaveBeenCalledWith(
      'linkedin-feed',
      'LINKEDIN',
      'BROWSER_EXTENSION',
      expect.objectContaining({ sourceId: 'linkedin-feed:ws-2' }),
    );
  });

  it('returns 401 for an unauthenticated request', async () => {
    const ingestPushedCandidate = vi.fn();
    app.decorate('container', createMockContainer({ ingestPushedCandidate }));
    await app.register(socialMessageIngestRoutes);

    const response = await app.inject({ method: 'POST', url: '/ingest', payload: validBody });

    expect(response.statusCode).toBe(401);
    expect(ingestPushedCandidate).not.toHaveBeenCalled();
  });

  it('rejects a payload for a platform other than LINKEDIN', async () => {
    const ingestPushedCandidate = vi.fn();
    app.addHook('onRequest', async (request: FastifyRequest) => {
      request.user = { id: 'user-1', email: 'user-1@example.com', role: UserRole.JOB_SEEKER };
    });
    app.decorate('container', createMockContainer({ ingestPushedCandidate }));
    await app.register(socialMessageIngestRoutes);

    const response = await app.inject({ method: 'POST', url: '/ingest', payload: { ...validBody, platform: 'TELEGRAM' } });

    expect(response.statusCode).toBe(400);
    expect(ingestPushedCandidate).not.toHaveBeenCalled();
  });

  it('propagates a validation failure (e.g. empty rawText) as 422', async () => {
    const ingestPushedCandidate = vi.fn().mockResolvedValue({
      ok: false,
      error: { field: 'rawText', message: 'rawText must not be empty', severity: 'error' },
    });
    app.addHook('onRequest', async (request: FastifyRequest) => {
      request.user = { id: 'user-1', email: 'user-1@example.com', role: UserRole.JOB_SEEKER };
    });
    app.decorate('container', createMockContainer({ ingestPushedCandidate }));
    await app.register(socialMessageIngestRoutes);

    const response = await app.inject({ method: 'POST', url: '/ingest', payload: { ...validBody, rawText: '' } });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ field: 'rawText' });
  });
});
