# ADR-005: PostgreSQL for Primary Database

## Status

Accepted

## Date

2025-01-15

## Context

We need a relational database that provides:

- ACID compliance
- JSON support for flexible data
- Full-text search
- Good performance
- Mature ecosystem
- Docker support

## Decision

We will use PostgreSQL 16 as the primary database.

## Consequences

### Positive

- ACID compliance
- JSONB for flexible metadata
- Full-text search capabilities
- Excellent indexing
- Mature and battle-tested
- Strong community
- Good Docker images

### Negative

- More complex than SQLite
- Requires separate server
- Memory usage

### Mitigations

- Docker Compose for easy setup
- Connection pooling with Prisma
- Proper indexing strategy

## Features Used

- **JSONB** for metadata fields
- **Full-text search** for job descriptions
- **Array types** for skills, tags
- **UUID** for primary keys
- **Timestamps** with timezone

## Alternatives Considered

### MySQL

Popular relational database.

**Rejected because:**
- Less JSON support
- No array types
- Weaker full-text search

### SQLite

File-based database.

**Rejected because:**
- No concurrent writes
- Limited features
- Not suitable for production

### MongoDB

Document database.

**Rejected because:**
- No ACID across documents
- Less suitable for relational data
- Different query patterns

## References

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [PostgreSQL vs MySQL](https://www.postgresql.org/docs/current/comparison.html)
