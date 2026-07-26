# CareerOS Coding Standards

## TypeScript Configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

## Forbidden Patterns

### No `any` Type

```typescript
// ❌ BAD
function processData(data: any) {
  return data.value;
}

// ✅ GOOD
interface DataPayload {
  value: string;
}
function processData(data: DataPayload) {
  return data.value;
}
```

### No Business Logic in Controllers

```typescript
// ❌ BAD
fastify.post('/applications', async (request, reply) => {
  const { vacancyId } = request.body;
  // Business logic here
  const application = await prisma.application.create({ /* ... */ });
  return application;
});

// ✅ GOOD
fastify.post('/applications', async (request, reply) => {
  const command = ApplyToJobCommand.from(request.body);
  const application = await applyToJobUseCase.execute(command);
  return ApplicationPresenter.toResponse(application);
});
```

### No Direct Infrastructure Access from Domain

```typescript
// ❌ BAD - Domain depends on Prisma
class Application {
  async saveWithPrisma(prisma: PrismaClient) {
    await prisma.application.upsert({ /* ... */ });
  }
}

// ✅ GOOD - Domain uses repository interface
interface ApplicationRepository {
  save(application: Application): Promise<void>;
  findById(id: string): Promise<Application | null>;
}
```

### No Direct External API Calls from Business Logic

```typescript
// ❌ BAD
async function analyzeJob(vacancy: Vacancy) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({ /* ... */ }),
  });
  return response.json();
}

// ✅ GOOD
async function analyzeJob(vacancy: Vacancy, aiProvider: AIProvider) {
  return aiProvider.analyzeVacancy(vacancy);
}
```

## Naming Conventions

### Files

| Type | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `ApplicationCard.tsx` |
| Hooks | camelCase, use prefix | `useApplications.ts` |
| Services | PascalCase | `VacancyService.ts` |
| Repositories | PascalCase, suffix | `PrismaApplicationRepository.ts` |
| Types | PascalCase | `ApplicationStatus.ts` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT.ts` |

### Variables & Functions

```typescript
// Variables: camelCase
const applicationStatus = 'applied';
const maxRetryCount = 3;

// Functions: camelCase, verb first
function createApplication() {}
function getApplicationById() {}
function validateApplicationStatus() {}

// Boolean: is/has/can prefix
const isActive = true;
const hasPermission = false;
const canEdit = true;

// Constants: UPPER_SNAKE_CASE
const MAX_APPLICATIONS_PER_DAY = 50;
const DEFAULT_FOLLOW_UP_DAYS = 5;
```

### Classes

```typescript
// Services: noun + Service suffix
class ApplicationService {}
class NotificationService {}

// Repositories: Prisma + Entity + Repository
class PrismaApplicationRepository {}

// Use Cases: verb + noun + UseCase suffix
class ApplyToJobUseCase {}
class CalculateMatchUseCase {}

// Presenters: entity + Presenter suffix
class ApplicationPresenter {}
class VacancyPresenter {}

// Errors: descriptive + Error suffix
class ApplicationNotFoundError {}
class InvalidStatusTransitionError {}
```

## File Organization

### Feature-First Structure

```
packages/career/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── Application.ts
│   │   │   └── ApplicationStatus.ts
│   │   ├── events/
│   │   │   └── ApplicationCreated.ts
│   │   └── repositories/
│   │       └── ApplicationRepository.ts
│   ├── application/
│   │   ├── services/
│   │   │   └── ApplicationService.ts
│   │   └── use-cases/
│   │       ├── ApplyToJobUseCase.ts
│   │       └── ChangeApplicationStatusUseCase.ts
│   └── index.ts (barrel export)
```

### API Route Structure

```
apps/backend/src/
├── routes/
│   ├── applications/
│   │   ├── applications.routes.ts
│   │   ├── applications.schema.ts
│   │   └── applications.handlers.ts
│   ├── vacancies/
│   │   ├── vacancies.routes.ts
│   │   ├── vacancies.schema.ts
│   │   └── vacancies.handlers.ts
│   └── index.ts
├── middleware/
│   ├── auth.ts
│   └── validation.ts
└── plugins/
    └── prisma.ts
```

## Error Handling

### Domain Errors

```typescript
export class ApplicationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ApplicationNotFoundError extends ApplicationError {
  constructor(id: string) {
    super(`Application ${id} not found`, 'APPLICATION_NOT_FOUND', 404);
  }
}

export class InvalidStatusTransitionError extends ApplicationError {
  constructor(from: string, to: string) {
    super(
      `Cannot transition from ${from} to ${to}`,
      'INVALID_STATUS_TRANSITION',
      400,
    );
  }
}
```

### API Error Response

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
```

## Validation

### Request Validation with Zod

```typescript
import { z } from 'zod';

const CreateApplicationSchema = z.object({
  vacancyId: z.string().uuid(),
  notes: z.string().optional(),
});

type CreateApplicationInput = z.infer<typeof CreateApplicationSchema>;
```

### Domain Validation

```typescript
class Application {
  static create(vacancyId: string, userId: string): Application {
    if (!vacancyId) throw new Error('Vacancy ID required');
    if (!userId) throw new Error('User ID required');
    // ...
  }
}
```

## Testing Standards

### Unit Tests

```typescript
describe('Application', () => {
  describe('transitionTo', () => {
    it('should transition from saved to applied', () => {
      const app = createTestApplication({ status: 'saved' });
      app.transitionTo('applied');
      expect(app.status).toBe('applied');
    });

    it('should throw on invalid transition', () => {
      const app = createTestApplication({ status: 'offer' });
      expect(() => app.transitionTo('saved')).toThrow(InvalidStatusTransitionError);
    });
  });
});
```

### Integration Tests

```typescript
describe('ApplicationRepository', () => {
  it('should save and retrieve application', async () => {
    const repo = new PrismaApplicationRepository(prisma);
    const application = createTestApplication();
    
    await repo.save(application);
    const found = await repo.findById(application.id);
    
    expect(found).toBeDefined();
    expect(found?.status).toBe(application.status);
  });
});
```

### Test File Location

```
src/
├── domain/
│   └── entities/
│       ├── Application.ts
│       └── Application.test.ts
```

## Logging

```typescript
// Use structured logging
logger.info('Application created', {
  applicationId: application.id,
  userId: application.userId,
  vacancyId: application.vacancyId,
});

// Error logging
logger.error('Failed to process vacancy', {
  vacancyId,
  error: error.message,
  stack: error.stack,
});
```

## Comments

- No unnecessary comments
- Document "why", not "what"
- Use JSDoc for public APIs
- No TODO in production without issue reference

```typescript
// ❌ BAD
// Get the application
const application = await repo.findById(id);

// ✅ GOOD - JSDoc for public API
/**
 * Retrieves application by ID.
 * Throws ApplicationNotFoundError if not found.
 */
async findById(id: string): Promise<Application> {
  const application = await this.prisma.application.findUnique({
    where: { id },
  });
  if (!application) throw new ApplicationNotFoundError(id);
  return ApplicationMapper.toDomain(application);
}
```

## Import Order

```typescript
// 1. External packages
import { z } from 'zod';
import { fastify } from 'fastify';

// 2. Internal packages
import { Application } from '@careeros/career';
import { PrismaApplicationRepository } from '@careeros/database';

// 3. Relative imports
import { ApplicationPresenter } from './presenter';
import type { CreateApplicationInput } from './schema';
```
