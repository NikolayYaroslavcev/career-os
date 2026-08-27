import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SocialPlatform, TransportType, createUserId } from '@careeros/career';
import { UnauthorizedError, NotFoundError } from '../../middleware/error-handler.js';

function requireUserId(request: { user?: { id: string } }): string {
  if (!request.user) throw new UnauthorizedError('User not authenticated');
  return request.user.id;
}

async function getWorkspaceId(fastify: FastifyInstance, userId: string): Promise<string> {
  const user = await fastify.container.repositories.user.findById(createUserId(userId));
  if (!user) throw new NotFoundError('User workspace');
  const [workspaceId] = user.workspaceIds;
  if (!workspaceId) throw new NotFoundError('User workspace');
  return workspaceId;
}

const LINKEDIN_FEED_SOURCE_NAME = 'LinkedIn Feed';

// Only LINKEDIN is accepted today — this endpoint exists specifically for the
// browser extension's push-based LinkedIn Feed ingestion (see feed-detector.ts),
// not as a general "any platform" ingestion surface.
const ingestSchema = z.object({
  platform: z.literal('LINKEDIN'),
  externalMessageId: z.string().min(1),
  authorUsername: z.string().optional(),
  publishedAt: z.string().datetime().optional(),
  rawText: z.string(),
  rawHtml: z.string().optional(),
  media: z.unknown().optional(),
  links: z.array(z.string()).optional(),
  language: z.string().optional(),
});

export async function socialMessageIngestRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/ingest', async (request, reply) => {
    const userId = requireUserId(request);
    const workspaceId = await getWorkspaceId(fastify, userId);
    const body = ingestSchema.parse(request.body ?? {});

    // Derived from the authenticated user's own workspace, never taken from
    // the request body — SocialMessage has no workspaceId column of its own
    // (see schema.prisma), so this is what keeps one workspace's LinkedIn
    // Feed ingestion from colliding with or reading another workspace's.
    const sourceId = `linkedin-feed:${workspaceId}`;

    const result = await fastify.container.services.socialMessageIngestion.ingestPushedCandidate(
      'linkedin-feed',
      SocialPlatform.LINKEDIN,
      TransportType.BROWSER_EXTENSION,
      {
        sourceId,
        sourceName: LINKEDIN_FEED_SOURCE_NAME,
        externalMessageId: body.externalMessageId,
        authorUsername: body.authorUsername,
        // LinkedIn Feed rarely exposes a machine-readable post timestamp (see
        // extract.ts's extractPublishedAt) — falling back to ingestion time
        // rather than inventing a new "unknown publishedAt" contract.
        publishedAt: body.publishedAt ? new Date(body.publishedAt) : new Date(),
        rawText: body.rawText,
        rawHtml: body.rawHtml,
        media: body.media,
        links: body.links ?? [],
        language: body.language,
      },
    );

    if (!result.ok) {
      return reply.status(422).send({
        error: 'Validation failed',
        field: result.error.field,
        message: result.error.message,
      });
    }

    if (result.created) {
      // Fire-and-forget: the extension must not wait on an AI extraction call
      // for its 201 response. No new retry mechanism — a failed run here is
      // simply not retried (matches Phase 2's "no uncontrolled retry" choice
      // for this same ingestion path); the message stays PENDING and is
      // picked up by the next processPendingBySource call for this sourceId.
      fastify.container.services.socialMessagePipeline
        .processPendingBySource(SocialPlatform.LINKEDIN, sourceId)
        .catch((error: unknown) => {
          fastify.log.warn({ err: error, sourceId }, 'LinkedIn Feed pipeline run after ingest failed');
        });
    }

    return reply.status(201).send({
      ok: true,
      messageId: result.message.id,
      created: result.created,
    });
  });
}
