# EPIC-02: Infrastructure

## Status

**Complete.** PostgreSQL, Prisma, Redis, BullMQ, MinIO, and Mailpit all run via `docker compose up -d` / `docker-compose.full.yml`; health checks and structured logging are implemented in the backend.

## Duration

3-4 days

## Dependencies

EPIC-01 (Bootstrap)

## Objective

Set up database, queue, and core infrastructure services.

## Tasks

### TASK-02-01: PostgreSQL Setup
- [ ] Configure PostgreSQL in Docker
- [ ] Create initial Prisma schema
- [ ] Set up database connection
- [ ] Create first migration
- [ ] Add seed script

### TASK-02-02: Redis Setup
- [ ] Configure Redis in Docker
- [ ] Set up Redis connection
- [ ] Create Redis client wrapper
- [ ] Add health check

### TASK-02-03: BullMQ Setup
- [ ] Configure BullMQ
- [ ] Create queue factory
- [ ] Create worker factory
- [ ] Add job types

### TASK-02-04: Configuration Management
- [ ] Create config package
- [ ] Set up environment variables
- [ ] Create config schema with Zod
- [ ] Add validation

### TASK-02-05: Logging Setup
- [ ] Create logger package
- [ ] Configure structured logging
- [ ] Add request logging
- [ ] Add error logging

### TASK-02-06: Health Checks
- [ ] Create health check endpoint
- [ ] Add database health check
- [ ] Add Redis health check
- [ ] Add queue health check

## Deliverables

- PostgreSQL running with Prisma
- Redis running and connected
- BullMQ configured
- Configuration management
- Structured logging
- Health check endpoints

## Acceptance Criteria

- [ ] Database migrations work
- [ ] Redis connection stable
- [ ] Queue processing works
- [ ] Configuration validated
- [ ] Logging output correct
- [ ] Health checks pass
