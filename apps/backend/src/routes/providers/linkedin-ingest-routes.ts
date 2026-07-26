import type { FastifyInstance } from 'fastify';
import { validateIngestionPayload, ingestionPayloadToRawJob, LinkedInMapper, LinkedInNormalizer } from '@careeros/providers';
import { UnauthorizedError } from '../../middleware/error-handler.js';

function requireUserId(request: { user?: { id: string } }): string {
  if (!request.user) throw new UnauthorizedError('User not authenticated');
  return request.user.id;
}

export async function linkedinIngestRoutes(fastify: FastifyInstance): Promise<void> {
  const mapper = new LinkedInMapper();
  const normalizer = new LinkedInNormalizer();

  fastify.post('/ingest', async (request, reply) => {
    requireUserId(request);

    const payload = request.body;
    if (!validateIngestionPayload(payload)) {
      return reply.status(400).send({
        error: 'Invalid payload',
        message: 'Required fields: jobId, title, company, url',
      });
    }

    const rawJob = ingestionPayloadToRawJob(payload);
    const mapped = mapper.map(rawJob);
    const validationError = normalizer.validate(mapped);

    if (validationError && validationError.severity === 'error') {
      return reply.status(422).send({
        error: 'Validation failed',
        field: validationError.field,
        message: validationError.message,
      });
    }

    const normalized = normalizer.normalize(mapped);

    return reply.status(201).send({
      ok: true,
      vacancy: normalized,
      message: 'Job ingested successfully',
    });
  });

  fastify.get('/health', async (_request, reply) => {
    return reply.send({ status: 'ok', provider: 'linkedin' });
  });
}
