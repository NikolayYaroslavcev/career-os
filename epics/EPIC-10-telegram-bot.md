# EPIC-10: Telegram Bot

## Status

**Complete.** Account linking via one-time code, digest delivery, and dashboard `features/telegram` are implemented (`telegram-linking-service.ts`, `telegram-digest-formatter.ts`). Interactive job-card buttons (Apply/Favorite/Ignore inline in Telegram) were not verified as built — confirm before relying on this in a chat-driven flow.

## Duration

3-4 days

## Dependencies

EPIC-09 (Job Pipeline)

## Objective

Create Telegram bot for job notifications and interaction.

## Tasks

### TASK-10-01: Bot Setup
- [ ] Create Telegram bot
- [ ] Configure webhooks
- [ ] Add error handling

### TASK-10-02: /start Command
- [ ] Create welcome message
- [ ] Add onboarding flow

### TASK-10-03: /link Command
- [ ] Implement one-time code binding
- [ ] Generate 6-digit code
- [ ] Verify and link account

### TASK-10-04: /search Command
- [ ] Create search interface
- [ ] Show job listings
- [ ] Add filters

### TASK-10-05: Job Cards
- [ ] Create job card template
- [ ] Add Apply button
- [ ] Add Favorite button
- [ ] Add Ignore button

### TASK-10-06: /profile Command
- [ ] Show user profile
- [ ] Allow edits
- [ ] Update preferences

### TASK-10-07: /stats Command
- [ ] Show application stats
- [ ] Show match statistics
- [ ] Show progress

### TASK-10-08: Notifications
- [ ] Send new job alerts
- [ ] Send follow-up reminders
- [ ] Send status updates

## Deliverables

- Telegram bot running
- Account binding via one-time code
- All commands working
- Job cards with buttons
- Notifications via Telegram

## Acceptance Criteria

- [ ] Bot responds to commands
- [ ] Account binding works
- [ ] Job cards display correctly
- [ ] Buttons work as expected
- [ ] Notifications arrive
- [ ] Webhook configured
