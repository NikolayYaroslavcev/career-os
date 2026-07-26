# CareerOS Coding Standards

## TypeScript Rules

### Strict Mode
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### Forbidden
- `any` type - use `unknown` or proper types
- `@ts-ignore` or `@ts-expect-error` without justification
- Type assertions (`as`) - use type guards instead
- `enum` - use `const` objects with `as const`
- Non-null assertion (`!`) - use proper null checks

### Required
- Explicit return types on exported functions
- Interface over type for object shapes
- Discriminated unions for state machines
- Zod schemas for runtime validation

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Variables | camelCase | `applicationStatus` |
| Functions | camelCase | `getMatchScore()` |
| Classes | PascalCase | `ApplicationService` |
| Interfaces | PascalCase, no I prefix | `ApplicationRepository` |
| Types | PascalCase | `ApplicationStatus` |
| Constants | SCREAMING_SNAKE | `MAX_RETRY_COUNT` |
| Files | kebab-case | `application.service.ts` |
| Directories | kebab-case | `job-discovery/` |

## File Organization

### Feature-First Structure
```
packages/career/src/
├── domain/
│   ├── entities/
│   │   ├── application.entity.ts
│   │   └── follow-up.entity.ts
│   ├── value-objects/
│   │   ├── application-status.ts
│   │   └── match-analysis.ts
│   ├── events/
│   │   ├── application-created.event.ts
│   │   └── status-changed.event.ts
│   └── interfaces/
│       ├── application.repository.ts
│       └── follow-up.repository.ts
├── application/
│   ├── services/
│   │   └── application.service.ts
│   └── use-cases/
│       ├── create-application.use-case.ts
│       └── update-status.use-case.ts
└── infrastructure/
    └── (empty - lives in packages/database)
```

### File Naming Patterns
- Entity: `application.entity.ts`
- Value Object: `application-status.ts`
- Service: `application.service.ts`
- Use Case: `create-application.use-case.ts`
- Repository Interface: `application.repository.ts`
- Repository Implementation: `prisma-application.repository.ts`
- Event: `application-created.event.ts`

## Function Rules

### Small Functions
```typescript
// Good: focused, single responsibility
function calculateMatchScore(resume: Resume, job: Job): number {
  const skillScore = calculateSkillMatch(resume.skills, job.requirements);
  const experienceScore = calculateExperienceMatch(resume.experience, job.level);
  return weightedAverage(skillScore, experienceScore);
}

// Bad: too many responsibilities
function processApplication(data: any) {
  // 50 lines of mixed concerns
}
```

### Pure Functions Preferred
```typescript
// Good: pure, testable
function formatSalary(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

// Bad: side effects
let cachedSalary = '';
function formatSalary(amount: number, currency: string): string {
  cachedSalary = `${currency} ${amount}`; // mutation!
  return cachedSalary;
}
```

## Error Handling

### Domain Errors
```typescript
// packages/career/src/domain/errors/
class ApplicationNotFoundError extends Error {
  constructor(applicationId: string) {
    super(`Application ${applicationId} not found`);
    this.name = 'ApplicationNotFoundError';
  }
}

class InvalidStatusTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Cannot transition from ${from} to ${to}`);
    this.name = 'InvalidStatusTransitionError';
  }
}
```

### Error Boundaries
```typescript
// Never catch and swallow errors
// Good: propagate with context
async function getApplication(id: string): Promise<Application> {
  const app = await this.repository.findById(id);
  if (!app) {
    throw new ApplicationNotFoundError(id);
  }
  return app;
}

// Bad: swallow error
async function getApplication(id: string): Promise<Application | null> {
  try {
    return await this.repository.findById(id);
  } catch {
    return null; // silent failure
  }
}
```

## Testing Standards

### Unit Tests
- Test domain logic in isolation
- Mock infrastructure (repositories, external services)
- Use describe/it blocks with clear names
- Aim for >80% coverage on business logic

### Integration Tests
- Test real database interactions
- Use test containers for PostgreSQL/Redis
- Clean up after each test
- Test API endpoints end-to-end

### Test File Location
```
packages/career/
├── src/
│   ├── domain/
│   │   └── entities/
│   │       └── application.entity.ts
└── __tests__/
    └── domain/
        └── entities/
            └── application.entity.test.ts
```

## Commit Messages

Format: `type(scope): description`

Types:
- `feat` - new feature
- `fix` - bug fix
- `refactor` - code change that neither fixes nor adds
- `test` - adding tests
- `docs` - documentation
- `chore` - maintenance

Examples:
```
feat(career): add application status tracking
fix(worker): prevent duplicate job aggregation
refactor(ai): extract prompt builder
```

## Import Rules

### Order
1. External packages (react, next, etc.)
2. Internal packages (@careeros/*)
3. Shared utilities
4. Relative imports

### Absolute Imports
```typescript
// Use path aliases
import { Application } from '@/domain/entities/application.entity';
import { prisma } from '@careeros/database';
```

### No Circular Dependencies
- Domain cannot import from Application
- Application cannot import from Infrastructure
- Use dependency injection for cross-cutting concerns

## Code Review Checklist

Before submitting:
- [ ] No `any` types
- [ ] No `@ts-ignore`
- [ ] Functions have explicit return types
- [ ] Error handling is explicit
- [ ] Tests cover happy path + edge cases
- [ ] Documentation updated if needed
- [ ] No console.log in production code
- [ ] No hardcoded values (use config)
