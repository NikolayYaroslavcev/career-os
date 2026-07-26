# EPIC-01: Bootstrap

## Status

**Complete.** Turborepo monorepo, TypeScript strict mode, ESLint/Prettier, Docker Compose, and CI (`.github/workflows/ci.yml`) are all in place.

## Duration

2-3 days

## Dependencies

None (First implementation epic)

## Objective

Set up monorepo structure, tooling, and development environment.

## Tasks

### TASK-01-01: Initialize Turborepo Monorepo
- [ ] Create root package.json
- [ ] Configure pnpm workspaces
- [ ] Set up turbo.json
- [ ] Create .gitignore
- [ ] Create .nvmrc (Node 22)

### TASK-01-02: Configure TypeScript
- [ ] Create tsconfig.base.json
- [ ] Configure strict mode
- [ ] Set up path aliases
- [ ] Create tsconfig for each package

### TASK-01-03: Configure ESLint + Prettier
- [ ] Set up ESLint config
- [ ] Configure Prettier
- [ ] Add lint scripts
- [ ] Add format scripts

### TASK-01-04: Create Package Structure
- [ ] Create apps/backend scaffold
- [ ] Create apps/worker scaffold
- [ ] Create apps/dashboard scaffold
- [ ] Create packages/career scaffold
- [ ] Create packages/database scaffold
- [ ] Create packages/ai scaffold
- [ ] Create packages/providers scaffold
- [ ] Create packages/notifications scaffold
- [ ] Create packages/shared scaffold

### TASK-01-05: Set Up Docker Compose
- [ ] Create docker-compose.yml
- [ ] Create backend Dockerfile
- [ ] Create worker Dockerfile
- [ ] Create dashboard Dockerfile
- [ ] Add postgres service
- [ ] Add redis service
- [ ] Add pgadmin service

### TASK-01-06: Set Up CI Pipeline
- [ ] Create GitHub Actions workflow
- [ ] Add lint job
- [ ] Add typecheck job
- [ ] Add test job
- [ ] Add build job

### TASK-01-07: Create Development Scripts
- [ ] Add dev scripts
- [ ] Add build scripts
- [ ] Add test scripts
- [ ] Add lint scripts

## Deliverables

- Working monorepo with Turborepo
- TypeScript configured with strict mode
- ESLint + Prettier configured
- Docker Compose with all services
- CI pipeline running
- All packages scaffolded

## Acceptance Criteria

- [ ] `pnpm install` succeeds
- [ ] `pnpm build` succeeds
- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `docker compose up` starts all services
- [ ] CI pipeline passes
