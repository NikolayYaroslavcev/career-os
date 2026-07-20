import type { Container } from '../container.js';
import type { Config } from '@careeros/shared';

declare module 'fastify' {
  interface FastifyInstance {
    container: Container;
    config: Config;
  }

  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
    };
  }
}
