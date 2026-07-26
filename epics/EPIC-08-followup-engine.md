# EPIC-08: Follow-up Engine

## Status

**Complete**, including the dashboard follow-ups view. `follow-up-service.ts` (backend) and `packages/notifications/src/follow-up-reminder-service.ts` implement scheduling, reminders, and AI-generated follow-up messages, delivered via the digest system (`digest-scheduler.ts`, `morning-digest-service.ts`) and Telegram.

Since the initial cut, the engine gained:

- **Automatic scheduling** (`ApplicationCrmService.triggerFollowUpAutomation`, `FollowUpService.scheduleAutomatic`): a `FollowUp` is created without user action when an application is submitted (+6d), when an interview round concludes (+3d), and 24h before a scheduled interview — each tagged with a `FollowUpType` (`FOLLOW_UP` / `INTERVIEW` / `REPLY_EXPECTED` / `CUSTOM`) so duplicates of the same type are never stacked for one application. Rejecting or archiving an application cancels its pending follow-ups.
- **`GET/POST/PATCH/DELETE /api/v1/follow-ups`** (`routes/follow-ups/follow-up-routes.ts`): a cross-application aggregate view (overdue/today/upcoming/completed), still backed by the same `FollowUpService` — no parallel store.
- **`/app/follow-ups` dashboard page** (`features/follow-ups/follow-ups-dashboard.tsx`): the standalone list the note above used to call out as missing. The per-application follow-up card on `application-detail.tsx` is unchanged and still the place to manage a single application's follow-ups.
- **Telegram morning digest** now includes a "Today you have N follow-ups" section (`digest-builder.ts`, `telegram-digest-formatter.ts`) sourced from `FollowUpService`, alongside the existing 15-minute reminder sweep — these are two different things (a daily summary vs. the actual due-reminder push) and both reuse the same underlying data.
- **Cooling-down signal**: `application-routes.ts` computes a non-scoring `coolingDown` flag (no activity + no pending follow-up for 10+ days) surfaced on the Applications pipeline board. Does not touch `AiMatchingService` or ranking.

## Duration

3-4 days

## Dependencies

EPIC-07 (Career CRM)

## Objective

Create automated follow-up reminders and messaging.

**Core Product Differentiator** - Automates the most neglected part of job searching.

## Tasks

### TASK-08-01: Follow-up Scheduler
- [ ] Create scheduler service
- [ ] Schedule follow-ups after application
- [ ] Add configurable delays

### TASK-08-02: Reminder System
- [ ] Create reminder worker
- [ ] Check for due follow-ups
- [ ] Send notifications

### TASK-08-03: AI Message Generation
- [ ] Generate follow-up messages
- [ ] Personalize for context
- [ ] Add templates

### TASK-08-04: Snooze Functionality
- [ ] Add snooze action
- [ ] Reschedule follow-up
- [ ] Track snooze history

### TASK-08-05: Notification Integration
- [ ] Send via Telegram
- [ ] Send via Email
- [ ] Add preferences

### TASK-08-06: Follow-up History
- [ ] Log all follow-ups
- [ ] Track sent status
- [ ] Add metrics

### TASK-08-07: Follow-up Templates
- [ ] Create default templates
- [ ] Add template customization
- [ ] AI template generation

## Deliverables

- Follow-up scheduler
- Reminder system
- AI message generation
- Snooze functionality
- Notification integration
- Follow-up history

## Acceptance Criteria

- [ ] Follow-ups scheduled correctly
- [ ] Reminders sent on time
- [ ] Messages personalized
- [ ] Snooze works
- [ ] Notifications delivered
- [ ] History logged
