# CareerOS Domain Model

## Core Entities

### User

The central entity. All data belongs to a user.

```
User
├── id: UUID
├── email: string
├── passwordHash: string
├── telegramId?: string
├── profile: UserProfile
├── preferences: UserPreferences
├── createdAt: Date
└── updatedAt: Date
```

### UserProfile

User's professional profile used for matching.

```
UserProfile
├── userId: UUID (FK)
├── resumeText: string
├── skills: Skill[]
├── experience: Experience[]
├── education: Education[]
├── desiredRoles: string[]
├── desiredLocations: string[]
├── desiredSalaryMin?: number
├── desiredSalaryMax?: number
├── remotePreference: RemotePreference
└── updatedAt: Date
```

### Vacancy

A job listing from any provider.

```
Vacancy
├── id: UUID
├── externalId: string
├── providerId: string
├── companyId: UUID (FK)
├── title: string
├── description: string
├── requirements: string[]
├── salaryMin?: number
├── salaryMax?: number
├── currency: string
├── location: string
├── remote: RemoteType
├── url: string
├── publishedAt: Date
├── fetchedAt: Date
├── hash: string (deduplication)
└── metadata: Json
```

### Company

Company information.

```
Company
├── id: UUID
├── name: string
├── website?: string
├── industry?: string
├── size?: CompanySize
├── location?: string
├── logoUrl?: string
└── metadata: Json
```

### Application

Tracks user's job applications. CareerOS is a CRM that tracks applications but does not automatically submit them to external providers.

```
Application
├── id: UUID
├── userId: UUID (FK)
├── vacancyId: UUID (FK)
├── status: ApplicationStatus
├── startedAt?: Date
├── submittedAt?: Date
├── notes: string
├── createdAt: Date
└── updatedAt: Date

@@unique([userId, vacancyId])
```

**Statuses:**
- `saved` - User bookmarked the vacancy
- `started` - User opened the provider page
- `submitted` - User confirmed the application was submitted
- `waiting` - Awaiting employer response
- `hr_interview` - HR round
- `technical_interview` - Technical round
- `final_interview` - Final round
- `offer` - Received offer
- `rejected` - Rejected
- `archived` - Closed

**Important:** CareerOS tracks application status but does NOT automatically submit applications to external providers. Users must manually confirm when they have submitted an application.

### MatchResult

AI-generated match analysis.

```
MatchResult
├── id: UUID
├── userId: UUID (FK)
├── vacancyId: UUID (FK)
├── score: number (0-100)
├── explanation: string
├── missingSkills: string[]
├── strongMatches: string[]
├── weakMatches: string[]
├── salaryEstimate?: SalaryRange
├── interviewProbability: number
├── createdAt: Date
└── feedback?: MatchFeedback
```

### FollowUp

Scheduled follow-up reminders.

```
FollowUp
├── id: UUID
├── applicationId: UUID (FK)
├── userId: UUID (FK)
├── scheduledAt: Date
├── status: FollowUpStatus
├── message?: string
├── sentAt?: Date
├── snoozedUntil?: Date
└── createdAt: Date
```

**Statuses:**
- `pending` - Scheduled
- `sent` - Notification sent
- `completed` - User acted
- `snoozed` - Postponed
- `cancelled` - No longer needed

### Recruiter

Contact information for recruiters.

```
Recruiter
├── id: UUID
├── userId: UUID (FK)
├── applicationId?: UUID (FK)
├── name: string
├── email?: string
├── phone?: string
├── linkedinUrl?: string
├── company?: string
├── notes: string
└── createdAt: Date
```

### Resume

Parsed resume data.

```
Resume
├── id: UUID
├── userId: UUID (FK)
├── originalFile?: string
├── parsedData: ResumeData
├── createdAt: Date
└── updatedAt: Date
```

### ResumeData

Structured resume information.

```
ResumeData
├── summary: string
├── experience: Experience[]
├── education: Education[]
├── skills: Skill[]
├── projects: Project[]
├── certifications: Certification[]
└── languages: Language[]
```

### Notification

Notification log.

```
Notification
├── id: UUID
├── userId: UUID (FK)
├── channel: NotificationChannel
├── type: NotificationType
├── title: string
├── body: string
├── sentAt: Date
├── readAt?: Date
└── metadata: Json
```

### SearchProfile

Saved job search criteria.

```
SearchProfile
├── id: UUID
├── userId: UUID (FK)
├── name: string
├── keywords: string[]
├── locations: string[]
├── salaryMin?: number
├── salaryMax?: number
├── remote: RemoteType
├── excludeKeywords: string[]
├── isActive: boolean
└── createdAt: Date
```

## Value Objects

### Skill

```
Skill
├── name: string
├── level?: SkillLevel
└── yearsOfExperience?: number
```

### Experience

```
Experience
├── company: string
├── role: string
├── description: string
├── startDate: Date
├── endDate?: Date
├── skills: string[]
└── isCurrent: boolean
```

### Education

```
Education
├── institution: string
├── degree: string
├── field: string
├── startDate: Date
├── endDate?: Date
└── gpa?: number
```

### SalaryRange

```
SalaryRange
├── min: number
├── max: number
└── currency: string
```

## Enums

```typescript
enum ApplicationStatus {
  SAVED = 'saved',
  STARTED = 'started',
  SUBMITTED = 'submitted',
  WAITING = 'waiting',
  HR_INTERVIEW = 'hr_interview',
  TECHNICAL_INTERVIEW = 'technical_interview',
  FINAL_INTERVIEW = 'final_interview',
  OFFER = 'offer',
  REJECTED = 'rejected',
  ARCHIVED = 'archived',
}

enum RemoteType {
  ONSITE = 'onsite',
  REMOTE = 'remote',
  HYBRID = 'hybrid',
}

enum NotificationChannel {
  TELEGRAM = 'telegram',
  EMAIL = 'email',
  DISCORD = 'discord',
  SLACK = 'slack',
}

enum FollowUpStatus {
  PENDING = 'pending',
  SENT = 'sent',
  COMPLETED = 'completed',
  SNOOZED = 'snoozed',
  CANCELLED = 'cancelled',
}
```

## Relationships

```
User 1──* UserProfile
User 1──* Application
User 1──* SearchProfile
User 1──* Resume
User 1──* Notification
User 1──* Recruiter

Vacancy *──1 Company
Application *──1 Vacancy
Application 1──* FollowUp
Application *──1 Recruiter

MatchResult *──1 User
MatchResult *──1 Vacancy
```

## Domain Events

- `UserRegistered` - New user created
- `ProfileUpdated` - User profile changed
- `VacancyDiscovered` - New job found
- `VacancyAnalyzed` - AI analysis complete
- `ApplicationCreated` - Application started
- `ApplicationStatusChanged` - Status transition
- `FollowUpScheduled` - Reminder set
- `FollowUpTriggered` - Reminder fired
- `MatchCalculated` - Match score generated
- `NotificationSent` - Notification delivered
