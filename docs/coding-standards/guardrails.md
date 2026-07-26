# CareerOS Architecture Guardrails

## Automated Checks

These rules must be enforced via ESLint, TypeScript, and CI.

## Layer Boundaries

### Rule 1: Domain Has Zero Dependencies

```typescript
// packages/career/package.json
{
  "dependencies": {
    // EMPTY - domain has no dependencies
  }
}
```

**ESLint rule:**
```json
{
  "no-restricted-imports": ["error", {
    "patterns": ["@careeros/database", "@careeros/ai", "@careeros/*"]
  }]
}
```

### Rule 2: Prisma Only in Infrastructure

```typescript
// FORBIDDEN in packages/career or packages/resume
import { PrismaClient } from '@prisma/client';

// ALLOWED in packages/database
import { PrismaClient } from '@prisma/client';
```

**ESLint rule:**
```json
{
  "no-restricted-imports": ["error", {
    "patterns": [{
      "group": ["@prisma/client"],
      "message": "Prisma must only be used in packages/database"
    }]
  }]
}
```

### Rule 3: No Direct External API Calls

```typescript
// FORBIDDEN in business logic
import OpenAI from 'openai';
const openai = new OpenAI();

// ALLOWED in packages/ai providers
import OpenAI from 'openai';
```

## Code Quality Guards

### No `any` Type
```json
{
  "@typescript-eslint/no-explicit-any": "error"
}
```

### No Non-Null Assertion
```json
{
  "@typescript-eslint/no-non-null-assertion": "error"
}
```

### No Console.log in Production
```json
{
  "no-console": ["error", { "allow": ["warn", "error"] }]
}
```

## File Structure Guards

### Required Files per Package
Each package must have:
- `package.json` with proper name (@careeros/*)
- `tsconfig.json` extending root
- `src/index.ts` as entry point

### Forbidden Files
- No `dist/` committed
- No `node_modules/` committed
- No `.env` committed

## Database Guards

### Migration Required
Any change to `prisma/schema.prisma` must:
1. Generate migration file
2. Migration must be committed
3. Migration must be reversible

### No Raw SQL in Business Logic
```typescript
// FORBIDDEN in packages/career
await prisma.$queryRaw`SELECT * FROM applications`;

// ALLOWED in packages/database repositories
await prisma.$queryRaw`SELECT * FROM applications WHERE user_id = ${userId}`;
```

## API Guards

### Validation Required
Every API endpoint must validate input with Zod:
```typescript
// FORBIDDEN
app.post('/applications', async (req) => {
  const { jobId } = req.body; // no validation
});

// REQUIRED
const schema = z.object({ jobId: z.string().uuid() });
app.post('/applications', async (req) => {
  const { jobId } = schema.parse(req.body);
});
```

### Response Format
All API responses must follow the standard format:
```typescript
// FORBIDDEN
return { data: applications };

// REQUIRED
return { success: true, data: applications };
```

## Testing Guards

### Coverage Thresholds
```json
{
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 80,
      "lines": 80,
      "statements": 80
    }
  }
}
```

### Test File Naming
Tests must be named `*.test.ts` or `*.spec.ts`.

## CI Enforcement

### Pre-commit Hooks
```yaml
# .github/workflows/ci.yml
- name: Lint
  run: npm run lint

- name: Type Check
  run: npm run typecheck

- name: Test
  run: npm run test
```

### Branch Protection
- Require lint to pass
- Require typecheck to pass
- Require tests to pass
- Require review approval

## Violation Response

| Violation | Response |
|-----------|----------|
| `any` type | Block merge |
| Prisma outside infrastructure | Block merge |
| Missing tests | Block merge |
| Lint errors | Block merge |
| Type errors | Block merge |
| Missing ADR for new tech | Request ADR |
| Architecture deviation | Request ADR + review |

## Exceptions

Exceptions require:
1. ADR document explaining why
2. Technical lead approval
3. Time-bound (review in 30 days)
4. Tracked in tech debt backlog
