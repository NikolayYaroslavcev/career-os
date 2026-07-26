# ADR-006: Prisma ORM

## Status

Accepted

## Date

2025-01-15

## Context

We need an ORM that provides:

- Type-safe database queries
- Schema management
- Migrations
- Good TypeScript support
- PostgreSQL support

## Decision

We will use Prisma as the ORM for database access.

## Consequences

### Positive

- Type-safe queries
- Schema-first approach
- Automatic migrations
- Good TypeScript integration
- Visual database browser (Prisma Studio)
- Active development

### Negative

- Query performance overhead
- Limited raw SQL support
- Schema file can become large
- Some advanced queries require raw SQL

### Mitigations

- Use `$queryRaw` for complex queries
- Optimize with indexes
- Keep schema modular

## Constraints

- Prisma client only in infrastructure layer
- Domain layer uses repository interfaces
- No Prisma types leaked to domain

```typescript
// ❌ BAD - Prisma in domain
import { PrismaClient } from '@prisma/client';
class Application {
  constructor(private prisma: PrismaClient) {}
}

// ✅ GOOD - Repository interface
interface ApplicationRepository {
  save(application: Application): Promise<void>;
  findById(id: string): Promise<Application | null>;
}
```

## Alternatives Considered

### TypeORM

Decorators-based ORM.

**Rejected because:**
- Less type safety
- More boilerplate
- Decorator-based (we prefer explicit)

### Drizzle

Lightweight, SQL-like ORM.

**Rejected because:**
- Less mature
- Smaller ecosystem
- Less tooling

### Kysely

Type-safe SQL query builder.

**Rejected because:**
- No schema management
- No automatic migrations
- More manual work

## References

- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma vs TypeORM](https://www.prisma.io/docs/concepts/more/comparisons/prisma-and-typeorm)
