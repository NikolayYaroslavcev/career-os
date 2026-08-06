import type { Container } from '../container.js';
import type { Config } from '@careeros/shared';
import type { UserRole } from '@careeros/career';

declare module 'fastify' {
  interface FastifyInstance {
    container: Container;
    config: Config;
  }

  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      role: UserRole;
    };
  }
}
