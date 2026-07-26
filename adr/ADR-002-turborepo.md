# ADR-002: Turborepo for Monorepo Management

## Status

Accepted

## Date

2025-01-15

## Context

We need a monorepo management tool that provides:

- Fast builds with caching
- Parallel task execution
- Efficient change detection
- Simple configuration
- Good TypeScript support

## Decision

We will use Turborepo as our monorepo build system.

## Consequences

### Positive

- Incremental builds with remote caching
- Parallel task execution across packages
- Efficient change detection (only rebuild what changed)
- Simple `turbo.json` configuration
- Works well with pnpm workspaces
- No daemon required

### Negative

- Additional tooling to learn
- Cache invalidation can be complex
- Requires Turborepo cloud for remote caching (optional)

### Mitigations

- Use `turbo.json` for task configuration
- Configure cache inputs/outputs carefully
- Use local caching for development

## Configuration

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

## Alternatives Considered

### Nx

Full-featured monorepo tool with code generation.

**Rejected because:**
- More complex configuration
- Heavier footprint
- Steeper learning curve

### Lerna

Traditional monorepo management.

**Rejected because:**
- Less actively maintained
- No built-in caching
- Slower than Turborepo

### Rush

Microsoft's monorepo tool.

**Rejected because:**
- More complex setup
- Less community adoption
- Heavier tooling

## References

- [Turborepo Documentation](https://turbo.build/repo)
- [Turborepo vs Nx](https://turbo.build/repo/docs/comparisons/nx)
