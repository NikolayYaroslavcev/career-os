# CareerOS Domain Model

## Core Entities

### User

The central entity. All data belongs to a user.

```
User
├── id: UUID (primary key)
├── email: string (unique)
├── passwordHash: string
├── name: string
├── createdAt: DateTime
├── updatedAt: DateTime
└── settings: UserSettings (value object)
    ├── preferredSources: string[]
    ├── searchCriteria: SearchCriteria
    ├── notificationPreferences: NotificationPreferences
    └── followUpConfig: FollowUpConfig
```

**Invariants:**
- Email must be unique
- Password must be hashed before storage
- Settings must have valid notification config

---

### Resume

Represents a user's professional profile. Can have multiple versions.

```
Resume
├── id: UUID
├── userId: UUID (FK → User)
├── title: string ("Main Resume", "Frontend Focus")
├── version: number
├── rawContent: string (original text)
├── format: enum (PDF, DOCX, MARKDOWN, TEXT)
├── parsedData: ParsedResume (value object)
│   ├── summary: string
│   ├── experience: Experience[]
│   │   ├── company: string
│   │   ├── role: string
│   │   ├── startDate: Date
│   │   ├── endDate: Date | null
│   │   ├── description: string
│   │   └── achievements: string[]
│   ├── education: Education[]
│   │   ├── institution: string
│   │   ├── degree: string
│   │   ├── field: string
│   │   └── graduationYear: number
│   ├── skills: Skill[]
│   │   ├── name: string
│   │   ├── category: enum (TECHNICAL, SOFT, LANGUAGE)
│   │   └── proficiency: enum (BEGINNER, INTERMEDIATE, ADVANCED, EXPERT)
│   ├── projects: Project[]
│   │   ├── name: string
│   │   ├── description: string
│   │   ├── technologies: string[]
│   │   └── url: string | null
│   └── certifications: string[]
├── isActive: boolean
├── createdAt: DateTime
└── updatedAt: DateTime
```

**Invariants:**
- A user must have at least one active resume for matching
- Resume version increments on each edit
- Parsed data must be valid (experience dates logical, skills non-empty)

---

### Job / Vacancy

A vacancy from any source. Normalized to a common format. Multiple sources
can point to the same canonical vacancy (see ADR-030).

```
Vacancy
├── id: UUID (primary key)
├── title: string
├── description: string
├── companyId: FK → Company
├── location: string
├── remote: RemoteType (ONSITE | REMOTE | HYBRID | UNKNOWN)
├── employmentType: string
├── salaryMin / salaryMax / currency
├── experienceLevel: string
├── requirements: string[]
├── technologies: string[]
├── isActive: boolean
├── publishedAt: DateTime
├── fetchedAt: DateTime
├── sources: VacancySource[]
├── mergeAudits: VacancyMergeAudit[]
├── applications: Application[]
├── matches: MatchResult[]
└── createdAt / updatedAt: DateTime
```

### VacancySource

Tracks which provider discovered a vacancy. One Vacancy can have many sources.

```
VacancySource
├── id: UUID (primary key)
├── providerType: ProviderType (ATS | JOB_BOARD | COMMUNITY | MANUAL)
├── providerId: string (e.g. "greenhouse", "remote_ok")
├── externalId: string (ID in the source system)
├── sourceUrl: string? (link to listing)
├── applyUrl: string? (direct application link)
├── status: SourceStatus (ACTIVE | EXPIRED | REMOVED | BROKEN)
├── isPrimary: boolean
├── discoveredAt / lastSeenAt: DateTime
├── lastSuccessfulSync: DateTime?
├── lastFailedSync: DateTime?
├── failureCount: number
├── metadata: JSON?
└── vacancyId: FK → Vacancy
```

**Source lifecycle:**
- ACTIVE → BROKEN (after 3 consecutive sync failures)
- ACTIVE → EXPIRED (absent from sync results while other sources present)
- Any → REMOVED (manual removal)

### VacancyMergeAudit

Records every field change caused by a higher-priority source override.

```
VacancyMergeAudit
├── id: UUID (primary key)
├── vacancyId: FK → Vacancy
├── field: string
├── oldValue / newValue: JSON
├── sourceId / sourceName: string
├── providerType: ProviderType
├── reason: string?
└── mergedAt: DateTime
```

---

### Application

Tracks a user's application to a job. The core CRM entity.

```
Application
├── id: UUID
├── userId: UUID (FK → User)
├── jobId: UUID (FK → Job)
├── resumeId: UUID (FK → Resume)
├── status: ApplicationStatus (enum)
│   ├── SAVED
│   ├── APPLIED
│   ├── WAITING
│   ├── HR_INTERVIEW
│   ├── TECHNICAL_INTERVIEW
│   ├── FINAL_INTERVIEW
│   ├── OFFER
│   ├── REJECTED
│   └── ARCHIVED
├── matchScore: number | null (0-100)
├── matchAnalysis: MatchAnalysis | null (value object)
│   ├── strengths: string[]
│   ├── weaknesses: string[]
│   ├── missingSkills: string[]
│   └── explanation: string
├── notes: Note[]
│   ├── id: UUID
│   ├── content: string
│   ├── createdAt: DateTime
│   └── updatedAt: DateTime
├── appliedAt: DateTime | null
├── lastActivityAt: DateTime
├── createdAt: DateTime
└── updatedAt: DateTime
```

**State Machine:**
```
SAVED → APPLIED → WAITING → HR_INTERVIEW → TECHNICAL_INTERVIEW → FINAL_INTERVIEW → OFFER
                                      ↘                           ↘                 ↘
                                       → REJECTED                  → REJECTED        → REJECTED
                                                                        ↓
                                                                    ARCHIVED
```

**Invariants:**
- One active application per user per job
- Status transitions must follow the state machine
- appliedAt must be set when status = APPLIED
- lastActivityAt updates on every status change

---

### FollowUp

Tracks follow-up reminders for an application.

```
FollowUp
├── id: UUID
├── applicationId: UUID (FK → Application)
├── scheduledAt: DateTime
├── status: enum (PENDING, COMPLETED, SKIPPED, SNOOZED)
├── type: enum (AUTO, MANUAL)
├── message: string | null (AI-generated follow-up text)
├── response: string | null (what the user actually sent)
├── channel: enum (TELEGRAM, EMAIL)
├── snoozedUntil: DateTime | null
├── completedAt: DateTime | null
├── createdAt: DateTime
└── updatedAt: DateTime
```

**Invariants:**
- scheduledAt must be in the future when created
- SNOOZED status requires snoozedUntil to be set
- COMPLETED status requires completedAt and response

---

### Recruiter

Contact information for recruiters/hiring managers.

```
Recruiter
├── id: UUID
├── userId: UUID (FK → User)
├── applicationId: UUID (FK → Application)
├── name: string
├── email: string | null
├── phone: string | null
├── linkedInUrl: string | null
├── role: string | null (e.g., "Technical Recruiter")
├── company: string
├── notes: string | null
├── createdAt: DateTime
└── updatedAt: DateTime
```

---

### Notification

Record of sent notifications.

```
Notification
├── id: UUID
├── userId: UUID (FK → User)
├── channel: enum (TELEGRAM, EMAIL, DISCORD, SLACK)
├── type: enum (NEW_JOB, FOLLOW_UP, APPLICATION_UPDATE, DIGEST)
├── title: string
├── body: string
├── data: JSON | null (additional context)
├── sentAt: DateTime
├── readAt: DateTime | null
├── createdAt: DateTime
└── updatedAt: DateTime
```

---

### UserFeedback

Tracks user actions on job recommendations for learning.

```
UserFeedback
├── id: UUID
├── userId: UUID (FK → User)
├── jobId: UUID (FK → Job)
├── action: enum (SAVED, IGNORED, APPLIED, DISMISSED)
├── reason: string | null (optional user explanation)
├── createdAt: DateTime
```

**Purpose:** Training data for improving match algorithm.

---

### SearchProfile

Saved search criteria for job discovery.

```
SearchProfile
├── id: UUID
├── userId: UUID (FK → User)
├── name: string ("Senior React Remote", "Startup Frontend")
├── criteria: SearchCriteria (value object)
│   ├── keywords: string[]
│   ├── titlePatterns: string[]
│   ├── excludeKeywords: string[]
│   ├── locations: string[]
│   ├── isRemote: boolean | null
│   ├── salaryMin: number | null
│   ├── salaryCurrency: string
│   ├── experienceLevel: ExperienceLevel | null
│   ├── employmentType: EmploymentType | null
│   └── sources: JobSource[]
├── isActive: boolean
├── createdAt: DateTime
└── updatedAt: DateTime
```

---

## Value Objects

### MatchAnalysis
Detailed breakdown of how well a resume matches a vacancy.

### SearchCriteria
User's job search preferences and filters.

### NotificationPreferences
How and when the user wants to be notified.

### FollowUpConfig
Default follow-up timing and behavior.

### UserSettings
Aggregated user preferences.

---

## Relationships

```
User 1────* Resume
User 1────* Application
User 1────* SearchProfile
User 1────* Recruiter
User 1────* Notification
User 1────* UserFeedback

Job 1────* Application
Job 1────* UserFeedback

Application 1────* FollowUp
Application 1────* Recruiter
Application 1────1 Job
Application 1────1 Resume
```

---

## Domain Events

| Event | Trigger | Side Effects |
|-------|---------|--------------|
| `JobDiscovered` | New job fetched from provider | Run matching, notify user |
| `JobMatched` | Match analysis completed | Update ranking, notify if high score |
| `ApplicationCreated` | User applies to job | Schedule follow-up, notify recruiter |
| `ApplicationStatusChanged` | User updates status | Update pipeline, notify user |
| `FollowUpDue` | Scheduled time reached | Generate message, send notification |
| `FollowUpCompleted` | User confirms action | Update history, schedule next |
| `ResumeUpdated` | User uploads new resume | Re-match active applications |
| `UserFeedbackReceived` | User saves/ignores job | Update recommendation model |

---

## Invariants Summary

1. A user can only have one active application per job
2. Application status must follow the defined state machine
3. Follow-ups cannot be scheduled in the past
4. A resume must be active for matching to work
5. Job deduplication is based on externalId + source
6. All timestamps must be in UTC
7. Soft deletes for User and Job (isActive flag)
8. Hard delete for FollowUp and UserFeedback
