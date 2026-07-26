# CareerOS Definition of Done

## Feature Complete

A feature is done only when ALL criteria are met:

### Architecture

- [ ] Follows Clean Architecture layers
- [ ] Dependencies point inward
- [ ] Domain has no infrastructure dependencies
- [ ] Interfaces used for external services
- [ ] Provider pattern implemented where applicable

### Code Quality

- [ ] TypeScript strict mode passes
- [ ] No `any` types
- [ ] No duplicated logic
- [ ] Functions are focused and single-purpose
- [ ] Names are clear and descriptive
- [ ] No TODO/FIXME without issue reference

### Testing

- [ ] Unit tests for domain logic (>80% coverage)
- [ ] Integration tests for API endpoints
- [ ] Edge cases covered
- [ ] Error cases tested
- [ ] All tests pass

### Documentation

- [ ] ADR created for architecture decisions
- [ ] API documentation updated
- [ ] Code comments where "why" is not obvious
- [ ] README updated if setup changed

### Security

- [ ] Input validation with Zod
- [ ] Authentication checked where required
- [ ] Authorization enforced
- [ ] No hardcoded secrets
- [ ] No SQL injection vectors
- [ ] Rate limiting on public endpoints

### Performance

- [ ] No N+1 queries
- [ ] Pagination for list endpoints
- [ ] No synchronous file operations
- [ ] Database queries optimized

### Infrastructure

- [ ] Docker build succeeds
- [ ] Docker Compose starts all services
- [ ] Health checks pass
- [ ] Environment variables documented

### CI/CD

- [ ] Lint passes
- [ ] Typecheck passes
- [ ] Tests pass
- [ ] Build succeeds
- [ ] No security vulnerabilities in dependencies

## Epic Complete

An Epic is done only when:

### All Features Complete

- [ ] All tasks in Epic are Done
- [ ] All acceptance criteria met
- [ ] Integration between features works

### Quality Gates

- [ ] Full test suite passes
- [ ] No regression in existing features
- [ ] Performance benchmarks met
- [ ] Security review passed

### Documentation

- [ ] Epic documentation complete
- [ ] API documentation updated
- [ ] Architecture diagrams updated
- [ ] Changelog updated

### Deployment

- [ ] Docker images built
- [ ] Database migrations work
- [ ] Deployment tested
- [ ] Rollback procedure documented

## Release Complete

A release is done only when:

### Code Quality

- [ ] All Epics complete
- [ ] Full test suite passes
- [ ] Code coverage > 80%
- [ ] No known critical bugs
- [ ] Performance acceptable

### Security

- [ ] Security audit passed
- [ ] Penetration testing done
- [ ] Dependencies updated
- [ ] Secrets rotated if needed

### Documentation

- [ ] Release notes written
- [ ] API documentation current
- [ ] Deployment guide updated
- [ ] User guide updated

### Operations

- [ ] Monitoring configured
- [ ] Alerts configured
- [ ] Backup verified
- [ ] Rollback tested

## Task Complete

A single task is done only when:

### Implementation

- [ ] Code follows architecture
- [ ] Tests written and passing
- [ ] No regressions introduced
- [ ] Edge cases handled

### Review

- [ ] Self-review completed
- [ ] Code review passed
- [ ] Architecture review passed (if applicable)

### Documentation

- [ ] Task description updated
- [ ] Changes documented
- [ ] Commit message follows conventions

## Quality Metrics

### Code Coverage

| Layer | Minimum | Target |
|-------|---------|--------|
| Domain | 90% | 95% |
| Application | 80% | 85% |
| Infrastructure | 70% | 80% |
| Overall | 80% | 85% |

### Performance

| Metric | Target |
|--------|--------|
| API response (read) | < 200ms |
| API response (write) | < 500ms |
| AI matching | < 5s |
| Dashboard load | < 2s |

### Code Quality

| Metric | Target |
|--------|--------|
| TypeScript strict | 100% |
| ESLint errors | 0 |
| ESLint warnings | < 5 |
| Duplicate code | < 3% |

## Exceptions

Exceptions to DoD require:

1. Written justification
2. ADR if architecture-related
3. Tracked technical debt item
4. Timeline for resolution
5. Approval from architect
