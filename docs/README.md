# CareerOS Documentation

## Structure

```
docs/
├── README.md                    # This file
├── SYSTEM_ARCHITECTURE.md       # High-level architecture
├── DOMAIN_MODEL.md              # Domain entities and relationships
├── TECH_STACK.md                # Technology choices
├── DEVELOPMENT_WORKFLOW.md      # How we work
├── CODING_STANDARDS.md          # Code quality rules
├── PROJECT_GUARDRAILS.md        # Architecture guardrails
├── DEFINITION_OF_DONE.md        # Completion criteria
├── ROADMAP.md                   # Development phases
├── product/
│   └── requirements.md          # Product requirements
```

## Document Hierarchy

1. **Project Specification** (root) - Source of truth
2. **Product Requirements** - What to build and why
3. **System Architecture** - How to build it
4. **Domain Model** - Entities and relationships
5. **Tech Stack** - Technology choices
6. **ADRs** - Why specific decisions were made
7. **Epics & Tasks** - Implementation plan

## Reading Order

For new AI agents:
1. Read root specification files
2. Read `docs/product/requirements.md`
3. Read `docs/SYSTEM_ARCHITECTURE.md`
4. Read `docs/DOMAIN_MODEL.md`
5. Read `docs/TECH_STACK.md`
6. Read relevant ADRs in `/adr/` at the repo root (**not** `docs/adr/` — that copy is historical/abandoned, see [`docs/adr/README.md`](adr/README.md))
7. Read `epics/` for implementation plan

## Key Documents

### Architecture
- `SYSTEM_ARCHITECTURE.md` - Layered architecture, monorepo structure
- `DOMAIN_MODEL.md` - All entities, value objects, enums
- `PROJECT_GUARDRAILS.md` - What we must and must not do

### Development
- `DEVELOPMENT_WORKFLOW.md` - Agent roles, task lifecycle
- `CODING_STANDARDS.md` - TypeScript, naming, file organization
- `DEFINITION_OF_DONE.md` - Completion criteria
- `development/knip.md` - Unused files/dependencies/exports report (non-blocking CI check)

### Planning
- `ROADMAP.md` - All epics and timeline
- `adr/` - Architecture decisions
- `epics/` - Epic breakdown
- `tasks/` - Task breakdown
