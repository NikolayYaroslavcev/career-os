import type { FastifyInstance } from 'fastify';
import { createUserId } from '@careeros/career';
import { UnauthorizedError, NotFoundError, ValidationError, ServiceUnavailableError } from '../../middleware/error-handler.js';
import { ResumeUploadError, ResumeNotFoundError, ResumeNotAuthorizedError } from '../../services/resume-service.js';
import {
  ResumeNotFoundForSuggestionError,
  ResumeNotAuthorizedForSuggestionError,
  ResumeTextUnavailableError,
  SearchProfileSuggestionError,
  SearchProfileSuggestionUnavailableError,
  type SearchProfileSuggestion,
} from '../../services/search-profile-suggestion-service.js';

function requireUserId(request: { user?: { id: string } }): string {
  if (!request.user) {
    throw new UnauthorizedError('User not authenticated');
  }
  return request.user.id;
}

async function getWorkspaceId(fastify: FastifyInstance, userId: string): Promise<string> {
  const user = await fastify.container.repositories.user.findById(createUserId(userId));
  if (!user || user.workspaceIds.length === 0) {
    throw new NotFoundError('User workspace');
  }
  const workspaceId = user.workspaceIds[0];
  if (!workspaceId) {
    throw new NotFoundError('User workspace');
  }
  return workspaceId;
}

function serializeResume(resume: {
  id: string;
  title: string;
  summary: string;
  description: string;
  language?: string;
  tags: ReadonlyArray<string>;
  status: string;
  skills: ReadonlyArray<unknown>;
  technologies: ReadonlyArray<unknown>;
  format: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}): {
  id: string;
  title: string;
  summary: string;
  description: string;
  language: string | null;
  tags: string[];
  status: string;
  skills: unknown[];
  technologies: unknown[];
  format: string;
  createdAt: string;
  updatedAt: string;
} {
  return {
    id: resume.id,
    title: resume.title,
    summary: resume.summary,
    description: resume.description,
    language: resume.language ?? null,
    tags: [...resume.tags],
    status: resume.status,
    skills: [...resume.skills],
    technologies: [...resume.technologies],
    format: resume.format,
    createdAt: resume.createdAt.toISOString(),
    updatedAt: resume.updatedAt.toISOString(),
  };
}

function serializeSuggestion(suggestion: SearchProfileSuggestion): {
  desiredPositions: SearchProfileSuggestion['desiredPositions'];
  technologies: SearchProfileSuggestion['technologies'];
  experienceLevel: SearchProfileSuggestion['experienceLevel'];
  remotePreference: SearchProfileSuggestion['remotePreference'];
  confidence: SearchProfileSuggestion['confidence'];
  reasoning: SearchProfileSuggestion['reasoning'];
} {
  return {
    desiredPositions: [...suggestion.desiredPositions],
    technologies: [...suggestion.technologies],
    experienceLevel: suggestion.experienceLevel,
    remotePreference: suggestion.remotePreference,
    confidence: suggestion.confidence,
    reasoning: suggestion.reasoning,
  };
}

export async function resumeRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            resumes: { type: 'array' },
            total: { type: 'number' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const userId = requireUserId(request);
      const resumes = await fastify.container.services.resume.listByUser(userId);
      return reply.send({
        resumes: resumes.map(serializeResume),
        total: resumes.length,
      });
    },
  });

  fastify.get('/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
    handler: async (request, reply) => {
      const userId = requireUserId(request);
      const params = request.params as { id: string };
      const resume = await fastify.container.services.resume.getById(params.id);
      if (!resume) {
        throw new NotFoundError(`Resume '${params.id}' not found`);
      }
      if (resume.userId !== userId) {
        throw new UnauthorizedError('Not authorized to access this resume');
      }
      return reply.send(serializeResume(resume));
    },
  });

  fastify.post('/', {
    handler: async (request, reply) => {
      const userId = requireUserId(request);
      const data = await request.file();
      if (!data) {
        throw new ValidationError('No file uploaded');
      }

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const fileBuffer = Buffer.concat(chunks);

      try {
        const workspaceId = await getWorkspaceId(fastify, userId);
        const result = await fastify.container.services.resume.upload({
          userId,
          workspaceId,
          fileName: data.filename,
          mimeType: data.mimetype,
          fileBuffer,
        });

        return reply.status(201).send({
          id: result.resume.id,
          title: result.resume.title,
          format: result.resume.format,
          extractedTextLength: result.extractedText.length,
          createdAt: result.resume.createdAt.toISOString(),
        });
      } catch (error) {
        if (error instanceof ResumeUploadError) {
          throw new ValidationError(error.message);
        }
        throw error;
      }
    },
  });

  fastify.post('/:id/search-profile-suggestion', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
    handler: async (request, reply) => {
      const userId = requireUserId(request);
      const params = request.params as { id: string };

      try {
        const suggestion = await fastify.container.services.searchProfileSuggestion.suggest({
          userId,
          resumeId: params.id,
        });
        return reply.send(serializeSuggestion(suggestion));
      } catch (error) {
        if (error instanceof ResumeNotFoundForSuggestionError) {
          throw new NotFoundError(`Resume '${params.id}' not found`);
        }
        if (error instanceof ResumeNotAuthorizedForSuggestionError) {
          throw new UnauthorizedError('Not authorized to access this resume');
        }
        if (error instanceof ResumeTextUnavailableError || error instanceof SearchProfileSuggestionError) {
          throw new ValidationError(error.message);
        }
        if (error instanceof SearchProfileSuggestionUnavailableError) {
          throw new ServiceUnavailableError(error.message);
        }
        throw error;
      }
    },
  });

  fastify.patch('/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          language: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          status: { type: 'string', enum: ['draft', 'active', 'archived'] },
        },
      },
    },
    handler: async (request, reply) => {
      const userId = requireUserId(request);
      const params = request.params as { id: string };
      const body = request.body as {
        title?: string;
        description?: string;
        language?: string;
        tags?: string[];
        status?: 'draft' | 'active' | 'archived';
      };
      try {
        const resume = await fastify.container.services.resume.updateVersionMetadata(params.id, userId, body);
        return reply.send(serializeResume(resume));
      } catch (error) {
        if (error instanceof ResumeNotFoundError) {
          throw new NotFoundError(error.message);
        }
        if (error instanceof ResumeNotAuthorizedError) {
          throw new UnauthorizedError(error.message);
        }
        throw error;
      }
    },
  });

  fastify.delete('/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
    handler: async (request, reply) => {
      const userId = requireUserId(request);
      const params = request.params as { id: string };
      try {
        await fastify.container.services.resume.delete(params.id, userId);
        return reply.send({ success: true });
      } catch (error) {
        if (error instanceof ResumeNotFoundError) {
          throw new NotFoundError(error.message);
        }
        if (error instanceof ResumeNotAuthorizedError) {
          throw new UnauthorizedError(error.message);
        }
        throw error;
      }
    },
  });
}
