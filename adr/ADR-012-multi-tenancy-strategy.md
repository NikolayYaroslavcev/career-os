# ADR-012: Multi-tenancy Strategy

## Status

Accepted

## Date

2025-01-15

## Context

CareerOS needs to support:

- Individual users (MVP)
- Teams/workspaces (future)
- Data isolation per tenant
- Scalability for SaaS

We need a strategy that:

- Works for single-user MVP
- Scales to multi-user SaaS
- Provides data isolation
- Allows future team features

## Decision

### User -> Workspace Model

Design as multi-user SaaS from the beginning:

- User belongs to one or more Workspaces
- Data is scoped to Workspace
- MVP operates with one default Workspace per user
- Future: multiple Workspaces, team invites, roles

## Consequences

### Positive

- Data isolation built-in from start
- Easy to add team features later
- Scales to SaaS model
- Clean separation of concerns

### Negative

- Slightly more complex schema
- Workspace ID in every query
- More joins needed

### Mitigations

- Default workspace per user (transparent in MVP)
- Workspace middleware handles scoping
- Index on workspaceId for performance

## Schema Design

```prisma
model User {
  id            String    @id @default(uuid())
  email         String    @unique
  passwordHash  String
  workspaces    WorkspaceMember[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Workspace {
  id            String    @id @default(uuid())
  name          String
  members       WorkspaceMember[]
  jobs          Vacancy[]
  applications  Application[]
  resumes       Resume[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model WorkspaceMember {
  id            String    @id @default(uuid())
  userId        String
  workspaceId   String
  role          WorkspaceRole @default(MEMBER)
  user          User      @relation(fields: [userId], references: [id])
  workspace     Workspace @relation(fields: [workspaceId], references: [id])
  
  @@unique([userId, workspaceId])
}

enum WorkspaceRole {
  OWNER
  ADMIN
  MEMBER
}
```

## Data Scoping

### Repository Pattern

All repositories accept workspaceId:

```typescript
interface ApplicationRepository {
  findByWorkspace(workspaceId: string): Promise<Application[]>;
  save(application: Application, workspaceId: string): Promise<void>;
}
```

### Middleware

Automatic workspace scoping:

```typescript
// Fastify middleware
async function workspaceScope(request, reply) {
  const workspaceId = request.user.workspaceId;
  request.workspaceId = workspaceId;
}
```

### SQL Queries

All queries include workspaceId:

```sql
-- Applications for workspace
SELECT * FROM applications 
WHERE workspace_id = $1
AND status = 'applied';

-- Jobs for workspace
SELECT * FROM vacancies
WHERE workspace_id = $1
AND created_at > NOW() - INTERVAL '7 days';
```

## MVP Behavior

- User registers → automatic default workspace created
- All data scoped to default workspace
- No workspace switching UI (single workspace)
- Workspace ID passed in API headers or JWT

## Future Features

> **2026-07-24 audit correction:** the 2026-07-23 note above was wrong.
> `apps/backend/src/routes/workspaces/workspace-routes.ts` registers `GET /`,
> `POST /`, `POST /:id/invite`, and `PUT /:id/members/:userId/role`, but every
> handler is a hardcoded placeholder (`// TODO: Implement actual ... logic`)
> that returns static/fake data (e.g. `id: 'placeholder-id'`) without touching
> the database. None of it is backed by real persistence. Routes are
> registered behind `authMiddleware` like every other protected route, so
> there's no auth gap — it's a functionality gap: the API surface exists but
> does nothing yet. `apps/dashboard/src/api/workspaces.ts` only calls
> `listWorkspaces()` — no create/invite/role/switch UI exists either.

### v0.2
- Multiple workspaces per user — route stub only (`POST /workspaces`), no real persistence, no UI
- Workspace switching UI — not built

### v0.3
- Team invites — route stub only (`POST /:id/invite`), no real persistence, no UI
- Role-based access (Owner, Admin, Member) — route stub only (`PUT /:id/members/:userId/role`), no real persistence, no UI

### v0.4
- Workspace settings — not verified
- Billing per workspace — not built (no billing/payment integration found anywhere in the codebase)

## Configuration

```bash
# .env
DEFAULT_WORKSPACE_NAME=My Career
WORKSPACE_SCOPING_ENABLED=true
```

## Alternatives Considered

### User-scoped Only

Data scoped directly to user, no workspace.

**Rejected because:**
- Cannot add teams later
- Requires schema migration
- Less flexible

### Tenant ID in URL

Workspace ID in API URL: `/api/workspaces/:id/...`

**Rejected because:**
- More complex routing
- Harder to switch workspaces
- Less clean API

### Row-Level Security

Database-level isolation with RLS.

**Rejected because:**
- More complex setup
- Harder to debug
- Prisma doesn't support RLS well

## References

- [Multi-tenancy Patterns](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/overview)
- [SaaS Tenant Isolation](https://docs.aws.amazon.com/whitepapers/latest/multi-tenant-saas-isolation-strategies/overview.html)
