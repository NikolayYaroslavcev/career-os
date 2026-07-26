# EPIC-04: Backend API

## Status

Approved (EPIC-04 Review Fixes Applied)

## Duration

4-5 days

## Dependencies

EPIC-03 (Domain Layer)

## Objective

Create RESTful API with authentication and CRUD operations.

## Tasks

### TASK-04-01: Fastify Server Setup
- [ ] Configure Fastify server
- [ ] Add CORS plugin
- [ ] Add helmet plugin
- [ ] Add rate limiting

### TASK-04-02: Authentication (JWT + Argon2)
- [ ] Create auth package
- [ ] Implement JWT generation
- [ ] Implement JWT validation
- [ ] Create refresh tokens
- [ ] Implement Argon2 password hashing
- [ ] Add auth middleware

### TASK-04-03: User Endpoints
- [ ] POST /auth/register
- [ ] POST /auth/login
- [ ] POST /auth/refresh
- [ ] GET /users/me
- [ ] PUT /users/me

### TASK-04-04: Workspace Endpoints
- [ ] GET /workspaces
- [ ] POST /workspaces
- [ ] PUT /workspaces/:id

### TASK-04-05: Vacancy Endpoints
- [ ] GET /vacancies
- [ ] GET /vacancies/:id
- [ ] POST /vacancies/search

### TASK-04-06: Application Endpoints
- [ ] GET /applications
- [ ] GET /applications/:id
- [ ] POST /applications
- [ ] PUT /applications/:id (resume assignment & notes)
- [ ] PATCH /applications/:id/status
- [ ] POST /applications/:id/notes
- [ ] POST /applications/:id/follow-up
- [ ] POST /applications/:id/interviews

### TASK-04-07: MatchResult Endpoints
- [ ] GET /matches
- [ ] GET /matches/:id
- [ ] POST /matches/calculate

### TASK-04-08: Request Validation
- [ ] Create validation schemas
- [ ] Add Zod validation
- [ ] Add error responses

### TASK-04-09: Error Handling
- [ ] Create error handler
- [ ] Add error responses
- [ ] Add logging

### TASK-04-10: API Documentation
- [ ] Add Swagger plugin
- [ ] Document all endpoints
- [ ] Add examples

## Deliverables

- Fastify server running
- JWT authentication working
- Argon2 password hashing
- All CRUD endpoints
- Request validation
- Error handling
- API documentation

## Acceptance Criteria

- [ ] Authentication works
- [ ] All endpoints respond correctly
- [ ] Validation rejects invalid input
- [ ] Errors return proper format
- [ ] Swagger documentation complete
