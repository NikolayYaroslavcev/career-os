# CareerOS User Flows

## Flow 1: First-Time Setup

```
User registers
    ↓
User logs in
    ↓
User uploads resume (PDF/DOCX/Markdown)
    ↓
System parses resume
    ↓
System extracts: experience, skills, projects
    ↓
User creates search profile (keywords, location, salary, remote)
    ↓
System starts job aggregation
    ↓
First results appear (via Telegram or Dashboard)
```

## Flow 2: Job Discovery

```
System runs aggregation (daily cron)
    ↓
Fetches from configured providers
    ↓
Normalizes job data
    ↓
Deduplicates against existing jobs
    ↓
AI matches each job against user's resume
    ↓
Jobs ranked by match score
    ↓
High-score jobs → notification to user
    ↓
User reviews jobs
    ↓
User action: Save / Ignore / Apply
```

## Flow 3: Application Pipeline

```
User finds interesting job
    ↓
User clicks "Apply" (Telegram button or Dashboard)
    ↓
System creates Application (status: SAVED)
    ↓
User updates status to APPLIED
    ↓
System schedules follow-up reminder (configurable days)
    ↓
User can add notes, recruiter info
    ↓
Status progresses: WAITING → HR_INTERVIEW → TECHNICAL_INTERVIEW → ...
    ↓
Final status: OFFER or REJECTED
    ↓
Application archived
```

## Flow 4: Follow-up Automation

```
Application created (status: APPLIED)
    ↓
Follow-up scheduled (e.g., 5 business days)
    ↓
Timer runs (worker checks hourly)
    ↓
No response detected
    ↓
AI generates follow-up message
    ↓
Notification sent to user
    ↓
User reviews message
    ↓
User sends follow-up (or snoozes/skips)
    ↓
Follow-up marked as completed
```

## Flow 5: Resume Generation

```
User selects job to apply for
    ↓
User requests tailored resume
    ↓
System loads: user's resume + job description
    ↓
AI generates tailored version
    ↓
User reviews generated resume
    ↓
User downloads as PDF
    ↓
User submits with application
```

## Flow 6: Interview Preparation

```
Application reaches interview stage
    ↓
User requests interview prep
    ↓
System loads: job requirements + company info
    ↓
AI generates:
    - Technical questions
    - Behavioral questions
    - Company-specific questions
    ↓
User reviews questions
    ↓
User practices answers
    ↓
User marks as prepared
```

## Flow 7: Telegram Bot Interaction

```
User sends /start
    ↓
Bot links Telegram account to CareerOS user
    ↓
User sends /search
    ↓
Bot shows matching jobs (paginated cards)
    ↓
User taps Apply / Favorite / Ignore
    ↓
System updates application status
    ↓
User sends /stats
    ↓
Bot shows application statistics
```

## Flow 8: Analytics Review

```
User opens Analytics dashboard
    ↓
Views overview:
    - Total applications
    - Response rate
    - Interview rate
    - Offer rate
    ↓
Views salary statistics
    ↓
Views skill demand
    ↓
Views timeline of applications
    ↓
Insights inform job search strategy
```

## Flow 9: Recruiter Management

```
User adds recruiter contact
    ↓
System links to application
    ↓
User logs communication
    ↓
System tracks:
    - Last contact date
    - Next action
    - Notes
    ↓
Follow-up reminders based on last contact
```

## Flow 10: Settings & Preferences

```
User opens settings
    ↓
Configures:
    - Notification channels (Telegram, Email)
    - Quiet hours
    - Follow-up timing
    - Default search criteria
    ↓
Changes saved
    ↓
Applied to future interactions
```
