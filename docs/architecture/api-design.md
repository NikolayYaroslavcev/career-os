# CareerOS API Design

## Base URL

```
http://localhost:3000/api/v1
```

## Authentication

All endpoints require JWT Bearer token except registration and login.

```
Authorization: Bearer <token>
```

## Response Format

### Success
```json
{
  "success": true,
  "data": { ... }
}
```

### Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": [ ... ]
  }
}
```

### Pagination
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

## Endpoints

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/register | Register new user |
| POST | /auth/login | Login |
| POST | /auth/refresh | Refresh token |
| GET | /auth/me | Get current user |

### Resumes

| Method | Path | Description |
|--------|------|-------------|
| GET | /resumes | List user resumes |
| POST | /resumes | Upload/create resume |
| GET | /resumes/:id | Get resume details |
| PUT | /resumes/:id | Update resume |
| DELETE | /resumes/:id | Delete resume |
| POST | /resumes/:id/activate | Set as active resume |

### Jobs

| Method | Path | Description |
|--------|------|-------------|
| GET | /jobs | List available jobs (paginated, filterable) |
| GET | /jobs/:id | Get job details |
| GET | /jobs/:id/match | Get match analysis for current user |
| POST | /jobs/:id/save | Save job |
| POST | /jobs/:id/ignore | Ignore job |
| POST | /jobs/:id/apply | Apply to job |

### Applications

| Method | Path | Description |
|--------|------|-------------|
| GET | /applications | List user applications |
| GET | /applications/:id | Get application details |
| PUT | /applications/:id/status | Update application status |
| POST | /applications/:id/notes | Add note |
| GET | /applications/:id/notes | List notes |
| DELETE | /applications/:id/notes/:noteId | Delete note |
| GET | /applications/pipeline | Get Kanban pipeline view |

### Follow-ups

| Method | Path | Description |
|--------|------|-------------|
| GET | /follow-ups | List pending follow-ups |
| GET | /follow-ups/:id | Get follow-up details |
| POST | /follow-ups/:id/complete | Mark as completed |
| POST | /follow-ups/:id/snooze | Snooze until date |
| POST | /follow-ups/:id/skip | Skip this follow-up |
| POST | /follow-ups/generate | AI-generate follow-up message |

### Recruiters

| Method | Path | Description |
|--------|------|-------------|
| GET | /recruiters | List user recruiters |
| POST | /recruiters | Add recruiter |
| PUT | /recruiters/:id | Update recruiter |
| DELETE | /recruiters/:id | Delete recruiter |

### Search Profiles

| Method | Path | Description |
|--------|------|-------------|
| GET | /search-profiles | List search profiles |
| POST | /search-profiles | Create search profile |
| PUT | /search-profiles/:id | Update profile |
| DELETE | /search-profiles/:id | Delete profile |
| POST | /search-profiles/:id/run | Trigger job search |

### Notifications

| Method | Path | Description |
|--------|------|-------------|
| GET | /notifications | List notifications |
| PUT | /notifications/:id/read | Mark as read |
| PUT | /notifications/read-all | Mark all as read |
| GET | /notifications/settings | Get notification preferences |
| PUT | /notifications/settings | Update preferences |

### Analytics

| Method | Path | Description |
|--------|------|-------------|
| GET | /analytics/overview | Application statistics |
| GET | /analytics/salary | Salary analysis |
| GET | /analytics/skills | Skill demand analysis |
| GET | /analytics/timeline | Application timeline |

### AI

| Method | Path | Description |
|--------|------|-------------|
| POST | /ai/analyze-job | Analyze job against resume |
| POST | /ai/generate-resume | Generate tailored resume |
| POST | /ai/generate-cover-letter | Generate cover letter |
| POST | /ai/generate-interview-questions | Generate interview prep |

## Request/Response Examples

### POST /auth/register
```json
// Request
{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "John Doe"
}

// Response 201
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "createdAt": "2026-01-01T00:00:00Z"
  }
}
```

### GET /jobs?remote=true&salary_min=50000&page=1&limit=20
```json
// Response 200
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Senior Frontend Developer",
      "company": {
        "name": "TechCorp",
        "size": "MEDIUM",
        "location": "Remote"
      },
      "salaryMin": 60000,
      "salaryMax": 90000,
      "salaryCurrency": "USD",
      "isRemote": true,
      "postedAt": "2026-01-15T10:00:00Z",
      "matchScore": 85
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### PUT /applications/:id/status
```json
// Request
{
  "status": "APPLIED",
  "appliedAt": "2026-01-20T14:30:00Z"
}

// Response 200
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "APPLIED",
    "appliedAt": "2026-01-20T14:30:00Z",
    "lastActivityAt": "2026-01-20T14:30:00Z"
  }
}
```

## Validation

All request bodies validated with Zod schemas:

```typescript
const CreateApplicationSchema = z.object({
  jobId: z.string().uuid(),
  resumeId: z.string().uuid(),
  status: z.enum(['SAVED']).default('SAVED'),
});
```

## Rate Limiting

| Endpoint Group | Limit |
|----------------|-------|
| Auth | 5 requests/min |
| Jobs | 60 requests/min |
| Applications | 30 requests/min |
| AI | 10 requests/min |
| General | 100 requests/min |
