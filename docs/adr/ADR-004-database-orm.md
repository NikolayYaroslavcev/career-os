# ADR-004: PostgreSQL with Prisma ORM

## Status

Accepted

## Date

2026-01-15

## Context

CareerOS needs a reliable relational database for:
- User data
- Job listings (structured, relational)
- Application tracking (relationships, status)
- Analytics (aggregations, reporting)

Requirements:
- ACID compliance
- JSON support for flexible data
- Strong ecosystem
- Good TypeScript support

## Decision

PostgreSQL as the database, Prisma as the ORM.

## PostgreSQL Choice

### over MySQL
- Better JSON support (JSONB)
- Array types
- More advanced indexing (GIN, GiST)
- Better full-text search

### over MongoDB
- Relational data fits our domain
- ACID transactions
- JOIN support for queries
- Better for analytics

### over SQLite
- Production-ready
- Concurrent access
- Better performance at scale

## Prisma Choice

### over TypeORM
- Better TypeScript-first approach
- Schema as source of truth
- Better migration system
- Cleaner API

### over Drizzle
- More mature ecosystem
- Better documentation
- More community support
- Prisma Studio for debugging

### over raw SQL
- Type safety
- Migration management
- Query building
- Less boilerplate

## Architecture Rule

**Prisma must NOT be used outside the infrastructure layer.**

```
packages/database/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── src/
    ├── client.ts
    └── repositories/
        └── *.repository.ts
```

Domain layer defines repository interfaces:
```typescript
interface ApplicationRepository {
  findById(id: string): Promise<Application | null>;
  save(application: Application): Promise<void>;
}
```

Infrastructure layer implements them:
```typescript
class PrismaApplicationRepository implements ApplicationRepository {
  constructor(private prisma: PrismaClient) {}
  
  async findById(id: string): Promise<Application | null> {
    const record = await this.prisma.application.findUnique({ where: { id } });
    return record ? toDomain(record) : null;
  }
}
```

## Consequences

### Positive
- Schema version control via migrations
- Type-safe database queries
- Prisma Studio for data inspection
- Automatic query optimization hints

### Negative
- Prisma adds build time
- Some raw SQL still needed for complex queries
- Repository pattern adds boilerplate

### Mitigations
- Use `$queryRaw` for complex analytics queries
- Code generation for repository boilerplate
- Prisma acceleration for read-heavy paths (future)

## Migration Strategy

1. Schema changes go through Prisma Migrate
2. Migrations are version-controlled in git
3. Development: auto-migrate on startup
4. Production: manual migration with rollback plan
5. Large tables: use `prisma migrate deploy` with care

## Alternatives Considered

1. **Raw SQL**: Rejected. Loses type safety and migration management.
2. **Knex.js**: Considered. Prisma chosen for schema-first approach.
3. **Hasura**: Overkill. Would add another service to manage.
