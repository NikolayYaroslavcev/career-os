# EPIC-01: Bootstrap - Task Breakdown

## TASK-01-01: Initialize Turborepo Monorepo

**Priority:** Critical
**Status:** Ready

### Context
Set up the monorepo foundation with Turborepo and pnpm workspaces.

### Goal
Create a working monorepo structure that supports parallel builds and caching.

### Requirements

#### Functional
- Create root package.json with workspace configuration
- Configure pnpm workspaces
- Set up turbo.json for task orchestration
- Create .gitignore
- Create .nvmrc for Node.js version

#### Non-Functional
- Build times < 30s for clean build
- Incremental builds < 5s
- Cache hit rate > 80%

### Implementation Plan

1. Create root package.json
   ```json
   {
     "name": "career-os",
     "private": true,
     "scripts": {
       "build": "turbo build",
       "dev": "turbo dev",
       "lint": "turbo lint",
       "typecheck": "turbo typecheck",
       "test": "turbo test"
     },
     "devDependencies": {
       "turbo": "^2.0.0"
     }
   }
   ```

2. Create pnpm-workspace.yaml
   ```yaml
   packages:
     - 'apps/*'
     - 'packages/*'
   ```

3. Create turbo.json
   ```json
   {
     "$schema": "https://turbo.build/schema.json",
     "tasks": {
       "build": {
         "dependsOn": ["^build"],
         "outputs": ["dist/**"]
       },
       "dev": {
         "cache": false,
         "persistent": true
       },
       "lint": {},
       "typecheck": {
         "dependsOn": ["^build"]
       },
       "test": {
         "dependsOn": ["^build"]
       }
     }
   }
   ```

4. Create .gitignore
   ```
   node_modules/
   dist/
   .turbo/
   .env
   .env.local
   ```

5. Create .nvmrc
   ```
   22
   ```

### Acceptance Criteria
- [ ] `pnpm install` succeeds
- [ ] `turbo build` runs without errors
- [ ] `turbo dev` starts without errors
- [ ] Caching works correctly

---

## TASK-01-02: Configure TypeScript

**Priority:** Critical
**Status:** Ready

### Context
Set up TypeScript with strict mode for the entire monorepo.

### Goal
Configure TypeScript for maximum type safety across all packages.

### Requirements

#### Functional
- Create tsconfig.base.json with strict settings
- Create tsconfig for each package
- Set up path aliases
- Configure project references

#### Non-Functional
- Strict mode enabled
- No `any` types allowed
- Source maps enabled

### Implementation Plan

1. Create tsconfig.base.json
   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "ESNext",
       "moduleResolution": "bundler",
       "lib": ["ES2022"],
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
       "isolatedModules": true,
       "incremental": true
     }
   }
   ```

2. Create tsconfig.json for each package extending base

### Acceptance Criteria
- [ ] TypeScript compiles without errors
- [ ] Strict mode catches type issues
- [ ] Path aliases work
- [ ] Source maps generated

---

## TASK-01-03: Configure ESLint + Prettier

**Priority:** Critical
**Status:** Ready

### Context
Set up code quality tools for consistent code style.

### Goal
Enforce consistent code style and catch common errors.

### Requirements

#### Functional
- Configure ESLint with TypeScript support
- Configure Prettier for formatting
- Add pre-commit hooks
- Add lint scripts

#### Non-Functional
- Zero ESLint errors
- Consistent formatting
- Fast linting (< 10s)

### Implementation Plan

1. Create eslint.config.js
2. Create .prettierrc
3. Add husky for git hooks
4. Add lint-staged for pre-commit

### Acceptance Criteria
- [ ] `pnpm lint` passes
- [ ] `pnpm format` works
- [ ] Pre-commit hooks run
- [ ] No formatting issues

---

## TASK-01-04: Create Package Structure

**Priority:** High
**Status:** Ready

### Context
Create the directory structure for all apps and packages.

### Goal
Establish the monorepo structure with all required packages.

### Requirements

#### Functional
- Create apps/backend scaffold
- Create apps/worker scaffold
- Create apps/dashboard scaffold
- Create all packages with package.json
- Add barrel exports

### Implementation Plan

1. Create apps/ directory structure
2. Create packages/ directory structure
3. Add package.json to each package
4. Add tsconfig.json to each package
5. Add index.ts barrel exports

### Acceptance Criteria
- [ ] All directories exist
- [ ] All package.json files valid
- [ ] All tsconfig.json files valid
- [ ] Barrel exports work

---

## TASK-01-05: Set Up Docker Compose

**Priority:** High
**Status:** Ready

### Context
Create Docker configuration for local development.

### Goal
Start entire development environment with single command.

### Requirements

#### Functional
- Create docker-compose.yml
- Create Dockerfiles for each app
- Add postgres service
- Add redis service
- Add pgadmin service
- Add health checks

#### Non-Functional
- `docker compose up` starts all services
- Services are accessible
- Data persists between restarts

### Implementation Plan

1. Create docker-compose.yml
2. Create Dockerfile for backend
3. Create Dockerfile for worker
4. Create Dockerfile for dashboard
5. Configure volumes for data persistence
6. Add health checks

### Acceptance Criteria
- [ ] `docker compose up` works
- [ ] All services start
- [ ] PostgreSQL accessible
- [ ] Redis accessible
- [ ] pgadmin accessible

---

## TASK-01-06: Set Up CI Pipeline

**Priority:** Medium
**Status:** Ready

### Context
Create GitHub Actions workflow for automated checks.

### Goal
Run lint, typecheck, tests, and build on every push.

### Requirements

#### Functional
- Create GitHub Actions workflow
- Add lint job
- Add typecheck job
- Add test job
- Add build job

#### Non-Functional
- CI completes in < 5 minutes
- Caching enabled
- Parallel jobs where possible

### Implementation Plan

1. Create .github/workflows/ci.yml
2. Add lint job
3. Add typecheck job
4. Add test job
5. Add build job
6. Configure caching

### Acceptance Criteria
- [ ] CI runs on push
- [ ] All jobs pass
- [ ] Caching works
- [ ] PR checks run

---

## TASK-01-07: Create Development Scripts

**Priority:** Medium
**Status:** Ready

### Context
Add convenience scripts for development workflow.

### Goal
Simplify common development tasks.

### Requirements

#### Functional
- Add dev scripts for each app
- Add build scripts
- Add test scripts
- Add lint scripts
- Add database scripts

### Implementation Plan

1. Add scripts to root package.json
2. Add scripts to each app
3. Add database migration scripts
4. Add seed scripts

### Acceptance Criteria
- [ ] `pnpm dev` works
- [ ] `pnpm build` works
- [ ] `pnpm test` works
- [ ] Database scripts work

---

## Task Dependencies

```
TASK-01-01 (Initialize Turborepo)
    ↓
TASK-01-02 (Configure TypeScript)
    ↓
TASK-01-03 (Configure ESLint + Prettier)
    ↓
TASK-01-04 (Create Package Structure)
    ↓
TASK-01-05 (Set Up Docker Compose)
    ↓
TASK-01-06 (Set Up CI Pipeline)
    ↓
TASK-01-07 (Create Development Scripts)
```

## Estimated Duration

| Task | Duration |
|------|----------|
| TASK-01-01 | 2 hours |
| TASK-01-02 | 2 hours |
| TASK-01-03 | 2 hours |
| TASK-01-04 | 3 hours |
| TASK-01-05 | 3 hours |
| TASK-01-06 | 2 hours |
| TASK-01-07 | 1 hour |
| **Total** | **15 hours** |
