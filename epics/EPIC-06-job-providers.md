# EPIC-06: Job Providers

## Status

**Complete, far exceeds original scope.** The original plan called for 3 providers (HH, Habr, RemoteOK) plus a LinkedIn interface stub. `packages/providers/src/providers` now has 20+ live providers: HH, Habr Career, RemoteOK, LinkedIn, Greenhouse, Lever, Ashby, Workday, Teamtailor, Adzuna, Arbeitnow, Comeet, Himalayas, hnhiring, Jobicy, Nodesk, Recruitee, Remotive, SmartRecruiters, Superjob, WeWorkRemotely, WorkingNomads — see ADR-030 (multi-source vacancy support).

## Duration

4-5 days

## Dependencies

EPIC-05 (AI Layer)

## Objective

Create pluggable job provider system with multiple adapters.

## Tasks

### TASK-06-01: JobProvider Interface
- [ ] Define JobProvider interface
- [ ] Define job types
- [ ] Define search criteria

### TASK-06-02: HH.ru Adapter
- [ ] Implement HH.ru provider
- [ ] Add API integration
- [ ] Add job normalization

### TASK-06-03: Habr Career Adapter
- [ ] Implement Habr Career provider
- [ ] Add API integration
- [ ] Add job normalization

### TASK-06-04: RemoteOK Adapter
- [ ] Implement RemoteOK provider
- [ ] Add API integration
- [ ] Add job normalization

### TASK-06-05: LinkedIn Interface (Future)
- [ ] Define LinkedIn provider interface
- [ ] Mark as not implemented
- [ ] Document future options

### TASK-06-06: Job Normalization
- [ ] Create normalization pipeline
- [ ] Map external fields to domain
- [ ] Handle missing data

### TASK-06-07: Deduplication
- [ ] Create deduplication logic
- [ ] Generate job hash
- [ ] Handle duplicates

### TASK-06-08: Provider Configuration
- [ ] Create provider config
- [ ] Add API keys management
- [ ] Add rate limiting

## Deliverables

- JobProvider interface
- HH.ru adapter working
- Habr Career adapter working
- RemoteOK adapter working
- LinkedIn interface defined (future)
- Job normalization
- Deduplication logic

## Acceptance Criteria

- [ ] Providers can be added via config
- [ ] Jobs are normalized correctly
- [ ] Duplicates are detected
- [ ] Rate limits respected
- [ ] Tests pass
