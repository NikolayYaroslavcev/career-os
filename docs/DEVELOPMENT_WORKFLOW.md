# CareerOS Development Workflow

## Agent Roles

AI agents work as engineering team members, not code generators.

| Role | Responsibility | Does Not |
|------|---------------|----------|
| Product Agent | Requirements, user stories, priorities | Write production code, technical decisions |
| Architect Agent | System design, ADRs, boundaries | Implement features directly |
| Backend Agent | API, services, workers | Bypass domain layer, access Prisma outside infra |
| Frontend Agent | Dashboard, UI components | Put business logic in components |
| AI Agent | AI abstraction, prompts, matching | Couple to single AI vendor |
| DevOps Agent | Docker, CI/CD, deployment | Manual server configuration |
| Security Agent | Auth, validation, secrets | Skip security reviews |
| Reviewer Agent | Code review, quality gates | Implement features |

## Task Lifecycle

```
Requirement → Research → Architecture Check → ADR (if needed)
    → Implementation Plan → Development → Testing → Review
    → Documentation → Commit
```

## Before Coding Checklist

### Architecture

- [ ] Does this belong to the correct layer?
- [ ] Does this introduce coupling?
- [ ] Can this be replaced?
- [ ] Can this be tested independently?

### Product

- [ ] Does this reduce manual work?
- [ ] Does this improve user value?

### Technical

- [ ] Are there existing abstractions?
- [ ] Is duplication created?
- [ ] Is documentation needed?

## Implementation Rules

1. Check existing modules before creating new code
2. Prefer extending existing architecture
3. Follow feature-first organization
4. One Epic at a time
5. Complete before moving to next

## Forbidden Actions

- Rewrite architecture without ADR
- Add dependencies without justification
- Create unnecessary abstractions
- Skip tests
- Skip validation
- Ignore TypeScript errors
- Use `any` type
- Add temporary solutions without documentation
- Mix unrelated features

## Commit Conventions

Format: `type(scope): description`

Types:
- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code restructure
- `test` - Add tests
- `docs` - Documentation
- `chore` - Maintenance

Examples:
```
feat(career): add application status tracking
fix(worker): prevent duplicate notifications
refactor(ai): extract prompt templates
test(resume): add PDF parsing tests
docs(adr): add database selection record
```

## Epic Workflow

Only one Epic active at a time:

```
EPIC 01 Bootstrap
    ↓ Complete
    ↓ Review
    ↓ Commit
EPIC 02 Infrastructure
    ↓ ...
```

## Code Review Process

### Before Accepting

#### Architecture
- Correct layer?
- Correct dependency direction?
- No hidden coupling?

#### Code Quality
- Clean?
- Typed?
- Readable?
- Reusable?

#### Testing
- Unit tests covered?
- Edge cases handled?

#### Documentation
- ADRs updated?
- API docs current?

## AI Self-Review

Before finishing any task:

1. What changed?
2. Why was it changed?
3. Does it follow architecture?
4. Are tests sufficient?
5. Could it be simpler?
6. Did it create future problems?

## Release Workflow

Before release, run:

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test`
4. `pnpm build`
5. Security checks
6. Docker verification

Verify:
- Migrations work
- Environment variables documented
- Deployment works

## Session Handoff

At end of every session, update:

1. Current status
2. Completed tasks
3. Active tasks
4. Decisions made
5. Problems discovered
6. Next recommended action

## Documentation Requirements

Create ADR for:
- New technologies
- Architecture changes
- Database changes
- API design changes
- Major refactoring

Update docs for:
- New features
- Changed behavior
- New endpoints
- Schema changes
