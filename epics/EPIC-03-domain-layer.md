# EPIC-03: Domain Layer

## Status

**Complete.** Full DDD domain layer lives in `packages/career/src/domain` — entities (User, Workspace, Vacancy, Company, Application, FollowUp, Resume, Interview, Recruiter, Notification, SearchProfile, etc.), value objects, domain events, and repository interfaces are all implemented and unit-tested.

## Duration

4-5 days

## Dependencies

EPIC-02 (Infrastructure)

## Objective

Create all domain entities, value objects, and repository interfaces.

## Tasks

### TASK-03-01: User Entity
- [ ] Create User entity
- [ ] Create UserProfile value object
- [ ] Create UserPreferences value object
- [ ] Add business rules

### TASK-03-02: Workspace Entity (Multi-tenancy)
- [ ] Create Workspace entity
- [ ] Create WorkspaceMember entity
- [ ] Create WorkspaceRole enum
- [ ] Add scoping rules

### TASK-03-03: Vacancy Entity
- [ ] Create Vacancy entity
- [ ] Create Company entity
- [ ] Add validation rules
- [ ] Add deduplication hash

### TASK-03-04: Application Entity
- [ ] Create Application entity
- [ ] Create ApplicationStatus enum
- [ ] Add status transition rules
- [ ] Add domain events

### TASK-03-05: MatchResult Entity
- [ ] Create MatchResult entity
- [ ] Create SalaryRange value object
- [ ] Create MatchFeedback value object
- [ ] Add scoring rules

### TASK-03-06: FollowUp Entity
- [ ] Create FollowUp entity
- [ ] Create FollowUpStatus enum
- [ ] Add scheduling rules
- [ ] Add domain events

### TASK-03-07: Resume Entity
- [ ] Create Resume entity
- [ ] Create ResumeData value object
- [ ] Create Experience value object
- [ ] Create Skill value object

### TASK-03-08: Recruiter Entity
- [ ] Create Recruiter entity
- [ ] Add contact information
- [ ] Add communication history

### TASK-03-09: SearchProfile Entity
- [ ] Create SearchProfile entity
- [ ] Add search criteria
- [ ] Add preferences

### TASK-03-10: Repository Interfaces
- [ ] Create UserRepository interface
- [ ] Create WorkspaceRepository interface
- [ ] Create VacancyRepository interface
- [ ] Create ApplicationRepository interface
- [ ] Create MatchResultRepository interface
- [ ] Create FollowUpRepository interface
- [ ] Create ResumeRepository interface

### TASK-03-11: Domain Events
- [ ] Create event base class
- [ ] Create UserRegistered event
- [ ] Create ApplicationCreated event
- [ ] Create ApplicationStatusChanged event
- [ ] Create FollowUpScheduled event

## Deliverables

- All domain entities
- All value objects
- All repository interfaces
- Domain events
- Business rules

## Acceptance Criteria

- [ ] All entities have business logic
- [ ] No infrastructure dependencies in domain
- [ ] Repository interfaces defined
- [ ] Domain events created
- [ ] Unit tests pass
