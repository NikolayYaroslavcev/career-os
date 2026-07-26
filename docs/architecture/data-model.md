# CareerOS Database Schema

## Database: PostgreSQL

All tables use UUID primary keys. Timestamps use `created_at` and `updated_at` with timezone.

## Tables

### users
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    settings JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);
```

### resumes
```sql
CREATE TABLE resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    raw_content TEXT NOT NULL,
    format VARCHAR(20) NOT NULL,
    parsed_data JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_resumes_user_id ON resumes(user_id);
CREATE INDEX idx_resumes_active ON resumes(user_id, is_active);
```

### jobs
```sql
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255) NOT NULL,
    source VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    company_website VARCHAR(500),
    company_industry VARCHAR(255),
    company_size VARCHAR(50),
    company_location VARCHAR(255),
    description TEXT NOT NULL,
    requirements JSONB NOT NULL DEFAULT '[]',
    responsibilities JSONB NOT NULL DEFAULT '[]',
    salary_min INTEGER,
    salary_max INTEGER,
    salary_currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    is_remote BOOLEAN NOT NULL DEFAULT false,
    location VARCHAR(255),
    employment_type VARCHAR(50),
    experience_level VARCHAR(50),
    posted_at TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(external_id, source)
);

CREATE INDEX idx_jobs_source ON jobs(source);
CREATE INDEX idx_jobs_active ON jobs(is_active);
CREATE INDEX idx_jobs_posted_at ON jobs(posted_at);
CREATE INDEX idx_jobs_company ON jobs(company_name);
CREATE INDEX idx_jobs_salary ON jobs(salary_min, salary_max);
```

### applications
```sql
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL DEFAULT 'SAVED',
    match_score INTEGER,
    match_analysis JSONB,
    applied_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, job_id)
);

CREATE INDEX idx_applications_user_id ON applications(user_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_job_id ON applications(job_id);
CREATE INDEX idx_applications_last_activity ON applications(last_activity_at);
```

### application_notes
```sql
CREATE TABLE application_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_application_notes_app ON application_notes(application_id);
```

### follow_ups
```sql
CREATE TABLE follow_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    type VARCHAR(20) NOT NULL DEFAULT 'AUTO',
    message TEXT,
    response TEXT,
    channel VARCHAR(20) NOT NULL DEFAULT 'TELEGRAM',
    snoozed_until TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_follow_ups_app ON follow_ups(application_id);
CREATE INDEX idx_follow_ups_scheduled ON follow_ups(scheduled_at, status);
CREATE INDEX idx_follow_ups_pending ON follow_ups(status) WHERE status = 'PENDING';
```

### recruiters
```sql
CREATE TABLE recruiters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    linkedin_url VARCHAR(500),
    role VARCHAR(255),
    company VARCHAR(255) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recruiters_user ON recruiters(user_id);
CREATE INDEX idx_recruiters_app ON recruiters(application_id);
```

### notifications
```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    data JSONB,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;
```

### user_feedback
```sql
CREATE TABLE user_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feedback_user ON user_feedback(user_id);
CREATE INDEX idx_feedback_job ON user_feedback(job_id);
CREATE INDEX idx_feedback_action ON user_feedback(action);
```

### search_profiles
```sql
CREATE TABLE search_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    criteria JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_search_profiles_user ON search_profiles(user_id);
```

## Prisma Schema Location

```
packages/database/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── src/
    ├── client.ts
    └── repositories/
        ├── user.repository.ts
        ├── resume.repository.ts
        ├── job.repository.ts
        ├── application.repository.ts
        ├── follow-up.repository.ts
        ├── recruiter.repository.ts
        ├── notification.repository.ts
        ├── feedback.repository.ts
        └── search-profile.repository.ts
```

## Repository Pattern

All database access goes through repository interfaces defined in the Domain layer. Prisma implementations live in `packages/database/src/repositories/`.

```typescript
// Domain interface (in packages/career)
interface ApplicationRepository {
  findById(id: string): Promise<Application | null>;
  findByUserId(userId: string): Promise<Application[]>;
  save(application: Application): Promise<void>;
  updateStatus(id: string, status: ApplicationStatus): Promise<void>;
}

// Prisma implementation (in packages/database)
class PrismaApplicationRepository implements ApplicationRepository {
  constructor(private prisma: PrismaClient) {}
  // ...
}
```

## Migration Strategy

- Migrations run automatically on backend startup in development
- Migrations are version-controlled and applied manually in production
- All migrations must be backward compatible (no breaking changes without ADR)
- Rollback plan required for each migration
