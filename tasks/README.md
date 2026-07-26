# CareerOS Tasks

## Structure

Tasks are organized by Epic. Each Epic has its own task file.

```
tasks/
├── README.md              # This file
├── EPIC-02-tasks.md       # Bootstrap tasks
├── EPIC-03-tasks.md       # Infrastructure tasks
├── EPIC-04-tasks.md       # Domain layer tasks
├── EPIC-05-tasks.md       # Backend API tasks
├── EPIC-06-tasks.md       # AI layer tasks
├── EPIC-07-tasks.md       # Job providers tasks
├── EPIC-08-tasks.md       # Job pipeline tasks
├── EPIC-09-tasks.md       # Telegram bot tasks
├── EPIC-10-tasks.md       # Career CRM tasks
├── EPIC-11-tasks.md       # Follow-up engine tasks
├── EPIC-12-tasks.md       # Dashboard tasks
└── EPIC-13-tasks.md       # Advanced AI tasks
```

## Task Format

Each task follows the template from `CareerOS_AI_Agent_Task_Template.md`:

- **Task ID**: TASK-XX-YY
- **Title**: Short description
- **Priority**: Critical / High / Medium / Low
- **Status**: Planned / In Progress / Review / Completed
- **Context**: Why this task exists
- **Goal**: Expected outcome
- **Requirements**: Functional and non-functional
- **Implementation Plan**: Step by step
- **Acceptance Criteria**: Checklist

## Task States

```
Planned → In Progress → Review → Completed
```

## Task Dependencies

Tasks within an Epic are sequential unless noted otherwise.

## Estimating Duration

- Simple task: 1-2 hours
- Medium task: 2-4 hours
- Complex task: 4-8 hours

## Updating Tasks

When working on a task:
1. Update status to "In Progress"
2. Update implementation plan as needed
3. Check off acceptance criteria as completed
4. Update status to "Review" when done
5. Update status to "Completed" after review
