# ADR-003: Fastify for Backend API

## Status

Accepted

## Date

2025-01-15

## Context

We need an HTTP framework for the backend API that provides:

- High performance
- TypeScript support
- Schema validation
- Plugin architecture
- Good ecosystem

## Decision

We will use Fastify as the HTTP framework for the backend API.

## Consequences

### Positive

- 2x faster than Express
- Built-in JSON schema validation
- Plugin-based architecture
- Native TypeScript support
- Excellent performance benchmarks
- Good request/response typing

### Negative

- Smaller ecosystem than Express
- Different API patterns from Express
- Less community content/tutorials

### Mitigations

- Fastify has growing community
- Official plugins for common needs
- Good documentation

## Comparison

| Feature | Fastify | Express | NestJS |
|---------|---------|---------|--------|
| Performance | Excellent | Good | Good |
| TypeScript | Native | Add-on | Native |
| Validation | Built-in | Add-on | Built-in |
| Learning Curve | Medium | Low | High |
| Bundle Size | Small | Small | Large |
| Decorators | No | No | Yes |

## Alternatives Considered

### Express

Traditional Node.js framework.

**Rejected because:**
- Slower performance
- No built-in validation
- Requires more middleware
- Less TypeScript support

### NestJS

Full-featured framework with decorators.

**Rejected because:**
- Heavier footprint
- Steeper learning curve
- More opinionated
- Decorator-based DI adds complexity

### Hono

Newer, lightweight framework.

**Rejected because:**
- Smaller ecosystem
- Less mature
- Fewer plugins

## References

- [Fastify Documentation](https://fastify.dev/)
- [Fastify vs Express](https://fastify.dev/docs/latest/Guides/Comparison-to-Express/)
- [Fastify Benchmarks](https://github.com/fastify/benchmarks)
