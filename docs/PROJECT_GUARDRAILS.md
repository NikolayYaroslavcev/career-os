# CareerOS Project Guardrails

## Architecture Guardrails

### 1. Dependency Rule

Dependencies must point inward: Presentation → Application → Domain → Infrastructure.

```
✅ Presentation can depend on Application
✅ Application can depend on Domain
✅ Domain depends on NOTHING external
❌ Domain cannot import from Infrastructure
❌ Domain cannot import from Presentation
```

### 2. Domain Purity

Domain layer must be framework-independent.

Forbidden in domain:
- Database clients (Prisma, TypeORM)
- HTTP frameworks (Fastify, Express)
- External API clients (OpenAI, Telegram)
- File system operations
- Environment variables

### 3. Provider Pattern

All external integrations must use interfaces.

```typescript
// Interface defined in domain/application layer
interface AIProvider {
  analyzeVacancy(vacancy: Vacancy, profile: UserProfile): Promise<MatchResult>;
}

// Implementation in infrastructure layer
class OpenAIProvider implements AIProvider { /* ... */ }
class AnthropicProvider implements AIProvider { /* ... */ }
```

### 4. Replaceability Test

Any component must be replaceable by changing configuration only.

| Component | Replacement | Configuration Change |
|-----------|-------------|---------------------|
| AI Provider | OpenAI → Anthropic | `AI_PROVIDER=anthropic` |
| Database | PostgreSQL → SQLite | `DATABASE_URL=...` |
| Queue | Redis → RabbitMQ | `QUEUE_PROVIDER=rabbitmq` |
| Notification | Telegram → Discord | `NOTIFICATION_PROVIDER=discord` |

## Code Guardrails

### 5. No `any` Type

TypeScript strict mode enforced. `any` is forbidden.

```typescript
// ❌ FORBIDDEN
function process(data: any) { /* ... */ }

// ✅ REQUIRED
function process(data: ProcessDataInput) { /* ... */ }
```

### 6. No Business Logic in Controllers

Controllers handle HTTP concerns only.

```typescript
// ❌ FORBIDDEN
fastify.post('/applications', async (req) => {
  // Business logic here
});

// ✅ REQUIRED
fastify.post('/applications', async (req) => {
  const command = ApplyToJobCommand.from(req.body);
  return this.applyToJobUseCase.execute(command);
});
```

### 7. No Duplicated Logic

DRY principle enforced. Extract shared logic to packages.

```typescript
// ❌ FORBIDDEN - Logic duplicated in multiple places
// apps/backend/src/routes/applications.ts
const validateStatus = (status: string) => { /* ... */ };
// apps/worker/src/handlers/followup.ts
const validateStatus = (status: string) => { /* ... */ };

// ✅ REQUIRED - Shared validation in packages/career
// packages/career/src/domain/entities/ApplicationStatus.ts
export const isValidStatus = (status: string): boolean => { /* ... */ };
```

### 8. No Hardcoded Secrets

```typescript
// ❌ FORBIDDEN
const apiKey = 'sk-1234567890';

// ✅ REQUIRED
const apiKey = process.env.OPENAI_API_KEY;
```

### 9. No Missing Error Handling

```typescript
// ❌ FORBIDDEN
async function getApplication(id: string) {
  return prisma.application.findUnique({ where: { id } });
}

// ✅ REQUIRED
async function getApplication(id: string): Promise<Application> {
  const application = await this.prisma.application.findUnique({ where: { id } });
  if (!application) throw new ApplicationNotFoundError(id);
  return ApplicationMapper.toDomain(application);
}
```

## Testing Guardrails

### 10. No Untested Business Logic

Domain entities and services must have unit tests.

### 11. No Flaky Tests

Tests must be deterministic and independent.

### 12. No Skipping Tests

```typescript
// ❌ FORBIDDEN
it.skip('should validate application', () => { /* ... */ });

// ✅ Required: Fix or remove
it('should validate application', () => { /* ... */ });
```

## Documentation Guardrails

### 13. No ADR-less Architecture Changes

Any architecture decision requires an ADR.

### 14. No Undocumented API Changes

API changes require updated documentation.

### 15. No TODO Without Issue Reference

```typescript
// ❌ FORBIDDEN
// TODO: Fix this later

// ✅ REQUIRED
// TODO(#123): Implement proper retry logic
```

## Performance Guardrails

### 16. No N+1 Queries

```typescript
// ❌ FORBIDDEN
const applications = await prisma.application.findMany();
for (const app of applications) {
  const vacancy = await prisma.vacancy.findUnique({ where: { id: app.vacancyId } });
}

// ✅ REQUIRED
const applications = await prisma.application.findMany({
  include: { vacancy: true },
});
```

### 17. No Unbounded Queries

```typescript
// ❌ FORBIDDEN
const allJobs = await prisma.vacancy.findMany();

// ✅ REQUIRED
const jobs = await prisma.vacancy.findMany({
  take: 100,
  skip: offset,
});
```

### 18. No Synchronous File Operations

```typescript
// ❌ FORBIDDEN
const data = fs.readFileSync('file.json');

// ✅ REQUIRED
const data = await fs.promises.readFile('file.json');
```

## Security Guardrails

### 19. No SQL Injection

Use Prisma's query builder, never raw SQL with user input.

### 20. No XSS Vulnerabilities

Sanitize all user input before rendering.

### 21. No CORS Misconfigurations

```typescript
// ❌ FORBIDDEN
fastify.register(cors, { origin: '*' });

// ✅ REQUIRED
fastify.register(cors, {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
  credentials: true,
});
```

### 22. No Missing Rate Limiting

Public endpoints must have rate limiting.

## Commit Guardrails

### 23. No Unreviewed Code

All changes must pass review before merge.

### 24. No Failing CI

CI must pass before merge.

### 25. No Mixed Changes

Each commit should be focused on one concern.

```
❌ BAD: feat: add authentication and fix bug in applications
✅ GOOD: feat(auth): add JWT authentication
✅ GOOD: fix(applications): prevent duplicate applications
```

## Infrastructure Guardrails

### 26. No Manual Server Configuration

All infrastructure via Docker Compose or IaC.

### 27. No `latest` Docker Tags

```yaml
# ❌ FORBIDDEN
image: postgres:latest

# ✅ REQUIRED
image: postgres:16-alpine
```

### 28. No Untested Migrations

Migrations must be tested before production deployment.

## Enforcement

These guardrails are enforced by:

1. **ESLint** - Code quality rules
2. **TypeScript** - Type safety
3. **CI Pipeline** - Automated checks
4. **Code Review** - Manual verification
5. **Architecture Review** - ADR compliance

Violation of guardrails requires:
1. Immediate fix before merge
2. ADR if exception is justified
3. Documentation of decision
