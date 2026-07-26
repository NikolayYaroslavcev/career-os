# EPIC-12: Dashboard

## Status

**Complete, exceeds original scope.** Next.js dashboard is the primary UI, with far more surface area than originally planned: applications Kanban, search profiles, recommendations, resumes, resume intelligence, career intelligence, company watch, Telegram linking, provider settings, sync/diagnostics views. Two shipped backend features are not yet reachable from the UI — see EPIC-13 notes on cover letter / resume tailoring.

## Duration

5-7 days

## Dependencies

EPIC-04 (Backend API)

## Objective

Create Next.js dashboard for web interface.

## Tasks

### TASK-12-01: Next.js Setup
- [ ] Configure Next.js 15
- [ ] Set up App Router
- [ ] Add Tailwind CSS
- [ ] Add shadcn/ui

### TASK-12-02: Authentication Flow
- [ ] Create login page
- [ ] Create register page
- [ ] Add JWT handling
- [ ] Add protected routes

### TASK-12-03: Job Listing Page
- [ ] Create job list component
- [ ] Add filters
- [ ] Add search
- [ ] Add pagination

### TASK-12-04: Application Pipeline
- [ ] Create Kanban board
- [ ] Add drag and drop
- [ ] Add status changes
- [ ] Add notes

### TASK-12-05: Analytics Dashboard
- [ ] Create charts
- [ ] Add metrics
- [ ] Add filters

### TASK-12-06: Settings Page
- [ ] Profile settings
- [ ] Notification preferences
- [ ] Telegram binding UI
- [ ] Search profiles

### TASK-12-07: Responsive Design
- [ ] Mobile layout
- [ ] Tablet layout
- [ ] Desktop layout

## Deliverables

- Next.js application
- Authentication flow
- Job listing page
- Application pipeline
- Analytics dashboard
- Settings page
- Responsive design

## Acceptance Criteria

- [ ] Authentication works
- [ ] Jobs display correctly
- [ ] Pipeline functional
- [ ] Analytics show data
- [ ] Settings save
- [ ] Responsive on all devices
