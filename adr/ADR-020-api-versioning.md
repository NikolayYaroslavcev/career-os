# ADR-020: API Versioning Strategy

## Status

Accepted

## Date

2025-01-15

## Context

CareerOS needs API versioning for:

- Breaking change management
- Client compatibility
- Gradual migration
- Future API evolution

We need:

- Clear versioning strategy
- Easy to understand
- Supports multiple versions
- Simple to implement

## Decision

### URL Path Versioning

Use `/api/v1` prefix from the beginning:

- All endpoints prefixed with `/api/v1/`
- Future versions: `/api/v2/`, `/api/v3/`
- Clear and explicit

## Consequences

### Positive

- Explicit and clear
- Easy to route
- Browser-cacheable per version
- Simple to understand

### Negative

- URL changes between versions
- More routes to maintain
- Client must update URLs

### Mitigations

- Clear versioning from start
- Deprecation notices
- Migration guides

## API Structure

```
/api/v1/auth/*
/api/v1/users/*
/api/v1/workspaces/*
/api/v1/jobs/*
/api/v1/applications/*
/api/v1/matches/*
/api/v1/resumes/*
/api/v1/notifications/*
/api/v1/analytics/*
```

## Implementation

### Fastify Plugin

```typescript
// apps/backend/src/plugins/versioning.ts
import { FastifyInstance } from 'fastify';

export async function versioningPlugin(fastify: FastifyInstance) {
  // All routes will be registered under /api/v1
  fastify.register(async function v1(fastify) {
    // v1 routes will be registered here
  }, { prefix: '/api/v1' });
}
```

### Route Registration

```typescript
// apps/backend/src/routes/index.ts
import { FastifyInstance } from 'fastify';

export async function apiRoutes(fastify: FastifyInstance) {
  // All routes under /api/v1
  fastify.register(async function v1(fastify) {
    await fastify.register(authRoutes, { prefix: '/auth' });
    await fastify.register(userRoutes, { prefix: '/users' });
    await fastify.register(jobRoutes, { prefix: '/jobs' });
    await fastify.register(applicationRoutes, { prefix: '/applications' });
    await fastify.register(matchRoutes, { prefix: '/matches' });
    await fastify.register(resumeRoutes, { prefix: '/resumes' });
    await fastify.register(notificationRoutes, { prefix: '/notifications' });
  }, { prefix: '/api/v1' });
}
```

### URL Examples

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh

GET    /api/v1/users/me
PUT    /api/v1/users/me

GET    /api/v1/workspaces
POST   /api/v1/workspaces

GET    /api/v1/jobs
GET    /api/v1/jobs/:id
POST   /api/v1/jobs/search

GET    /api/v1/applications
POST   /api/v1/applications
PUT    /api/v1/applications/:id
DELETE /api/v1/applications/:id

POST   /api/v1/matches/calculate
GET    /api/v1/matches/:id

POST   /api/v1/resumes/upload
GET    /api/v1/resumes/:id
```

## Version Lifecycle

### Active Version

- Current stable version
- Receives new features
- Full support

### Deprecated Version

- Still works
- Receives critical fixes only
- Shows deprecation warning
- Removal timeline specified

### Retired Version

- Removed from service
- Returns 410 Gone
- Migration guide available

## Deprecation Headers

```typescript
// When deprecating a version
reply.header('Deprecation', 'true');
reply.header('Sunset', '2025-06-01');
reply.header('Link', '</api/v2>; rel="successor-version"');
```

### Response Example

```json
{
  "warning": "API v1 is deprecated. Please migrate to v2 by 2025-06-01.",
  "migrationGuide": "https://docs.careeros.com/api/migration-v1-to-v2"
}
```

## Future Versioning

### When to Create v2

- Breaking change in response format
- Breaking change in authentication
- Breaking change in data model
- Major feature addition

### Migration Strategy

1. Announce v2 with timeline
2. Support v1 for 6 months
3. Add deprecation headers
4. Provide migration guide
5. Monitor usage
6. Retire v1

## Client Migration

### Version Detection

```typescript
// Client can detect version
const apiVersion = response.headers['x-api-version'];
if (apiVersion !== 'v1') {
  console.warn(`API version mismatch: expected v1, got ${apiVersion}`);
}
```

### Header-Based Version (Future)

If needed, support header-based versioning:

```
Accept: application/json; version=2
X-API-Version: 2
```

## OpenAPI Documentation

### Version-Specific Docs

```
/api/v1/docs    # Swagger UI for v1
/api/v2/docs    # Swagger UI for v2
```

### OpenAPI Spec

```typescript
// apps/backend/src/swagger.ts
export const swaggerOptions = {
  openapi: {
    openapi: '3.0.0',
    info: {
      title: 'CareerOS API',
      version: '1.0.0',
    },
    servers: [
      { url: '/api/v1', description: 'API v1' },
    ],
  },
};
```

## Configuration

```bash
# .env
API_VERSION=v1
API_PREFIX=/api
```

## Alternatives Considered

### Header-Based Versioning

Version in Accept header: `Accept: application/vnd.careeros.v1+json`

**Rejected because:**
- Less explicit
- Harder to test in browser
- More complex routing

### Query Parameter Versioning

Version as query param: `/jobs?version=1`

**Rejected because:**
- Less RESTful
- Cache-unfriendly
- Easy to forget

### No Versioning

Just change the API.

**Rejected because:**
- Breaking clients
- No migration path
- Unprofessional

## References

- [API Versioning Best Practices](https://restfulapi.net/versioning/)
- [Microsoft API Versioning](https://learn.microsoft.com/en-us/azure/api-management/api-versioning)
- [Stripe API Versioning](https://stripe.com/blog/api-versioning)
