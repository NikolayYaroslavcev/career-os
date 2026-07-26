# ADR-008: CareerOS Browser Extension Implementation Plan

## Status

**Implemented**, and broader than an earlier pass through this file (2026-07-23) claimed. `apps/extension` exists and builds (Manifest V3, content-script detectors for LinkedIn, HH, Greenhouse, Lever, Ashby, Workday, Teamtailor, Recruitee, SmartRecruiters, plus a generic JSON-LD fallback; background service worker with auth, sync, offline queue, and notifications).

**Correction (2026-07-23, later same day):** the line above previously said the injected panel "only shows saved/not-saved status and a Save button — it does not yet surface AI match score or trigger cover-letter/resume-tailoring generation inline." That was wrong about the "trigger" part — the panel has 5 action buttons (Save, Analyze, Tailor Resume, Cover Letter, Interview Prep; `apps/extension/src/content/core/panel-injector.ts:81-90`), and all four AI actions do fire real backend endpoints. What's actually true: (1) the AI match-percentage badge is templated in the panel but never populated with data (`detector.ts:54-57` never sets it), and (2) none of the four AI actions' *results* are ever displayed anywhere — they fire, return a `jobId`, and nothing polls or shows the outcome. Full detail in `docs/product/CURRENT_FEATURES.md` (Browser Extension and AI Features sections). Root cause of the original error: that pass read `panel-injector.ts` only partway through (stopped before the button list at line 84 and the click handlers at line 130+).

## Context

CareerOS needs a browser extension that acts as a companion to the existing web application, allowing users to detect, extract, and interact with job postings directly on supported job websites. The extension must integrate with the existing backend API, share types with the monorepo, and support adding new providers without changing core code.

## Architecture Decisions

### 1. Project Structure

The extension lives as a new app in the monorepo at `apps/extension/`, following the existing pattern where `apps/backend`, `apps/dashboard`, and `apps/worker` are separate applications.

```
apps/extension/
├── public/
│   ├── icons/
│   │   ├── icon16.png
│   │   ├── icon32.png
│   │   ├── icon48.png
│   │   ├── icon128.png
│   │   └── icon-vector.svg
│   └── popup/
│       └── splash.html              # Loading screen while popup initializes
├── src/
│   ├── manifest.json                 # Chrome/Edge/Brave Manifest V3
│   ├── _locales/
│   │   └── en/
│   │       └── messages.json
│   │
│   ├── background/
│   │   ├── service-worker.ts         # Entry: message routing, alarms, lifecycle
│   │   ├── auth-manager.ts           # Token refresh, session state
│   │   ├── sync-manager.ts           # Periodic sync with backend
│   │   ├── offline-queue.ts          # IndexedDB-backed offline queue
│   │   ├── notification-manager.ts   # Browser notification orchestration
│   │   ├── message-router.ts         # Typed message routing (runtime.onMessage)
│   │   └── storage-bridge.ts         # chrome.storage.local wrapper
│   │
│   ├── content/
│   │   ├── core/
│   │   │   ├── detector.ts           # URL-based provider detection dispatcher
│   │   │   ├── panel-injector.ts     # Injects CareerOS panel into page
│   │   │   ├── panel/
│   │   │   │   ├── panel.tsx         # React component (rendered into Shadow DOM)
│   │   │   │   ├── panel.css         # Scoped styles (injected as inline)
│   │   │   │   └── panel-icons.ts    # SVG icon components
│   │   │   └── content-messenger.ts  # Typed messaging to background SW
│   │   │
│   │   ├── providers/
│   │   │   ├── base-provider.ts      # Abstract base: URL matching, common interface
│   │   │   ├── provider-registry.ts  # Registry pattern matching backend
│   │   │   ├── types.ts              # ContentVacancy (common model)
│   │   │   │
│   │   │   ├── linkedin/
│   │   │   │   ├── detector.ts       # URL pattern + DOM selectors
│   │   │   │   ├── extractor.ts      # DOM extraction logic
│   │   │   │   └── apply-detector.ts # Detects Easy Apply / external apply
│   │   │   ├── hh/                   # HeadHunter (hh.ru, hh.kz, etc.)
│   │   │   ├── greenhouse/           # Greenhouse (boards.greenhouse.io, etc.)
│   │   │   ├── lever/                # Lever (jobs.lever.co, etc.)
│   │   │   ├── ashby/                # Ashby (jobs.ashbyhq.com, etc.)
│   │   │   ├── workday/              # Workday (myworkdayjobs.com, etc.)
│   │   │   ├── teamtailor/           # Teamtailor
│   │   │   ├── smartrecruiters/      # SmartRecruiters
│   │   │   ├── recruitee/            # Recruitee
│   │   │   ├── smartrecruiters/      # SmartRecruiters
│   │   │   ├── generic/
│   │   │   │   ├── jsonld.ts         # schema.org JobPosting via JSON-LD
│   │   │   │   └── schema-org.ts     # Fallback: microdata/meta extraction
│   │   │   └── company-watch/
│   │   │       └── detector.ts       # Company career page detection
│   │   │
│   │   └── apply-tracker/
│   │       ├── apply-detector.ts     # Generic apply button detection
│   │       └── upload-detector.ts    # Resume upload detection
│   │
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.tsx                 # React entry
│   │   ├── popup.css
│   │   ├── components/
│   │   │   ├── recent-vacancies.tsx
│   │   │   ├── saved-today.tsx
│   │   │   ├── pending-applications.tsx
│   │   │   ├── upcoming-interviews.tsx
│   │   │   ├── quick-search.tsx
│   │   │   ├── notification-list.tsx
│   │   │   └── status-bar.tsx
│   │   └── hooks/
│   │       ├── use-vacancies.ts
│   │       ├── use-applications.ts
│   │       └── use-auth.ts
│   │
│   ├── options/
│   │   ├── options.html
│   │   ├── options.tsx
│   │   ├── options.css
│   │   ├── components/
│   │   │   ├── backend-settings.tsx
│   │   │   ├── auth-section.tsx
│   │   │   ├── theme-settings.tsx
│   │   │   ├── provider-settings.tsx
│   │   │   ├── ai-settings.tsx
│   │   │   ├── notification-settings.tsx
│   │   │   └── privacy-settings.tsx
│   │   └── hooks/
│   │       └── use-settings.ts
│   │
│   ├── shared/
│   │   ├── types/
│   │   │   ├── vacancy.ts            # ContentVacancy (extension-specific flat model)
│   │   │   ├── auth.ts               # Auth tokens, user info
│   │   │   ├── messages.ts           # All message types (content<->background)
│   │   │   ├── settings.ts           # Settings schema (Zod)
│   │   │   └── queue.ts              # Offline queue item types
│   │   ├── api/
│   │   │   ├── client.ts             # CareerOS API client (fetch wrapper)
│   │   │   ├── vacancy-api.ts        # Vacancy CRUD operations
│   │   │   ├── application-api.ts    # Application operations
│   │   │   └── ai-api.ts             # AI orchestrator operations
│   │   ├── storage/
│   │   │   ├── chrome-storage.ts     # Typed chrome.storage.local wrapper
│   │   │   └── session-storage.ts    # In-memory session cache
│   │   └── utils/
│   │       ├── url-matcher.ts        # URL pattern matching
│   │       ├── dom-utils.ts          # Safe DOM query helpers
│   │       └── hash.ts               # Content hash for deduplication
│   │
│   └── styles/
│       ├── variables.css             # Design tokens
│       ├── panel.css                 # Injected panel styles
│       └── reset.css                 # Panel CSS reset (if not using Shadow DOM)
│
├── scripts/
│   ├── build.ts                      # Build script (runs via tsx)
│   ├── manifest-generator.ts         # Generates manifest.json from config
│   └── bundle-analyzer.ts            # Analyzes content script bundle size
│
├── tests/
│   ├── unit/
│   │   ├── providers/
│   │   │   ├── linkedin.test.ts
│   │   │   ├── hh.test.ts
│   │   │   └── generic.test.ts
│   │   ├── background/
│   │   │   ├── auth-manager.test.ts
│   │   │   ├── offline-queue.test.ts
│   │   │   └── message-router.test.ts
│   │   └── shared/
│   │       └── api-client.test.ts
│   ├── integration/
│   │   ├── content-background.test.ts
│   │   └── popup-api.test.ts
│   └── fixtures/
│       ├── html/
│       │   ├── linkedin-job.html
│       │   ├── hh-job.html
│       │   ├── greenhouse-job.html
│       │   └── generic-jsonld.html
│       └── mock-responses/
│           ├── vacancies.json
│           └── applications.json
│
├── package.json
├── tsconfig.json
├── tsconfig.node.json               # For build scripts
├── vite.config.ts
├── vitest.config.ts
└── manifest.json                    # Generated or hand-maintained
```

### 2. Build System

**Tool**: Vite with `vite-plugin-web-extension` (Manifest V3 support).

**Rationale**: Vite is faster than webpack for extension builds, has native ESM support, and `vite-plugin-web-extension` handles content script isolation, HMR for popup/options during dev, and proper bundling for all extension entry points.

**Integration with Turborepo**:

```json
// apps/extension/package.json
{
  "name": "@careeros/extension",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "vite build",
    "dev": "vite build --watch",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "lint": "eslint src/",
    "clean": "rm -rf dist",
    "bundle:check": "tsx scripts/bundle-analyzer.ts"
  },
  "dependencies": {
    "@careeros/shared": "workspace:*",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "vite": "^6.0.0",
    "vite-plugin-web-extension": "^0.28.0",
    "tsx": "^4.0.0",
    "typescript": "^5.8.0",
    "vitest": "^3.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@types/react": "^19.0.0",
    "@types/chrome": "^0.0.260",
    "eslint": "^9.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0"
  }
}
```

**Build output**: `apps/extension/dist/` (loaded via `chrome://extensions` in dev mode).

**Content script bundling strategy**: Each provider content script is bundled separately and kept under 100KB total. The build script produces:

- `dist/content/linkedin.js` (~15KB)
- `dist/content/hh.js` (~12KB)
- `dist/content/greenhouse.js` (~10KB)
- `dist/content/lever.js` (~10KB)
- `dist/content/ashby.js` (~10KB)
- `dist/content/workday.js` (~10KB)
- `dist/content/teamtailor.js` (~10KB)
- `dist/content/smartrecruiters.js` (~10KB)
- `dist/content/recruitee.js` (~10KB)
- `dist/content/generic.js` (~15KB, includes JSON-LD + schema.org)
- `dist/content/company-watch.js` (~8KB)
- `dist/content/core.js` (~20KB, panel injector + core utilities)
- **Total**: <100KB

### 3. Manifest V3 Architecture

```json
{
  "manifest_version": 3,
  "name": "CareerOS",
  "version": "0.1.0",
  "description": "Job vacancy detection, extraction, and AI-powered career tools",
  "permissions": [
    "storage",
    "alarms",
    "notifications",
    "activeTab",
    "tabs"
  ],
  "host_permissions": [
    "https://career-os.localhost/*",
    "https://*.linkedin.com/*",
    "https://hh.ru/*",
    "https://hh.kz/*",
    "https://*.greenhouse.io/*",
    "https://boards.greenhouse.io/*",
    "https://jobs.lever.co/*",
    "https://jobs.ashbyhq.com/*",
    "https://*.myworkdayjobs.com/*",
    "https://*.teamtailor.com/*",
    "https://boards.greenhouse.io/*",
    "https://*.smartrecruiters.com/*",
    "https://*.recruitee.com/*"
  ],
  "background": {
    "service_worker": "background/service-worker.js",
    "type": "module"
  },
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "content_scripts": [
    {
      "matches": [
        "https://*.linkedin.com/jobs/*",
        "https://*.linkedin.com/jobs/view/*"
      ],
      "js": ["content/providers/linkedin/detector.js", "content/core.js"],
      "run_at": "document_idle"
    },
    {
      "matches": [
        "https://hh.ru/vacancy/*",
        "https://hh.kz/vacancy/*",
        "https://api.hh.kz/vacancy/*"
      ],
      "js": ["content/providers/hh/detector.js", "content/core.js"],
      "run_at": "document_idle"
    },
    {
      "matches": [
        "https://boards.greenhouse.io/*",
        "https://boards.greenhouse.io/*/jobs/*"
      ],
      "js": ["content/providers/greenhouse/detector.js", "content/core.js"],
      "run_at": "document_idle"
    },
    {
      "matches": [
        "https://jobs.lever.co/*"
      ],
      "js": ["content/providers/lever/detector.js", "content/core.js"],
      "run_at": "document_idle"
    },
    {
      "matches": [
        "https://jobs.ashbyhq.com/*"
      ],
      "js": ["content/providers/ashby/detector.js", "content/core.js"],
      "run_at": "document_idle"
    },
    {
      "matches": [
        "https://*.myworkdayjobs.com/*"
      ],
      "js": ["content/providers/workday/detector.js", "content/core.js"],
      "run_at": "document_idle"
    },
    {
      "matches": [
        "https://*.teamtailor.com/*"
      ],
      "js": ["content/providers/teamtailor/detector.js", "content/core.js"],
      "run_at": "document_idle"
    },
    {
      "matches": [
        "https://*.smartrecruiters.com/*"
      ],
      "js": ["content/providers/smartrecruiters/detector.js", "content/core.js"],
      "run_at": "document_idle"
    },
    {
      "matches": [
        "https://*.recruitee.com/*"
      ],
      "js": ["content/providers/recruitee/detector.js", "content/core.js"],
      "run_at": "document_idle"
    },
    {
      "matches": ["<all_urls>"],
      "js": ["content/providers/generic/jsonld.js", "content/core.js"],
      "run_at": "document_idle",
      "all_frames": false
    }
  ],
  "options_page": "options/options.html",
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

**Key decisions**:
- Each provider gets its own content_scripts entry with precise URL matching.
- The generic JSON-LD detector runs on all URLs but with `all_frames: false` to minimize overhead.
- Service worker uses `"type": "module"` for ESM imports.
- `activeTab` permission instead of `tabs` where possible (more minimal).
- No `webRequest` permission needed (no request interception).

### 4. Shared Types Package

**Decision**: Create a thin `@careeros/extension-shared` package at `packages/extension-shared/` that contains only types and Zod schemas shared between the extension and backend. This avoids polluting the main `@careeros/shared` package (which has server-side dependencies like `ioredis`).

```
packages/extension-shared/
├── src/
│   ├── index.ts
│   ├── types/
│   │   ├── content-vacancy.ts      # ContentVacancy (flat, extension-side)
│   │   ├── api-vacancy.ts          # API vacancy response types
│   │   ├── application.ts          # Application types
│   │   ├── auth.ts                 # Auth token types
│   │   └── messages.ts             # Message types (content<->background)
│   ├── schemas/
│   │   ├── content-vacancy.ts      # Zod schema for ContentVacancy
│   │   ├── settings.ts             # Extension settings schema
│   │   └── queue-item.ts           # Offline queue item schema
│   └── constants/
│       ├── providers.ts            # Supported provider IDs + URL patterns
│       └── application-status.ts   # Application status enum
├── package.json
└── tsconfig.json
```

**ContentVacancy** (the common model extracted by content scripts):

```typescript
// packages/extension-shared/src/types/content-vacancy.ts
export interface ContentVacancy {
  provider: string;              // 'linkedin' | 'hh' | 'greenhouse' | etc.
  externalId: string;            // Provider-specific vacancy ID
  title: string;
  company: string;
  location: string;
  salary?: {
    min?: number;
    max?: number;
    currency: string;
    period: 'hourly' | 'monthly' | 'yearly';
  };
  experienceLevel?: 'intern' | 'junior' | 'middle' | 'senior' | 'lead' | 'principal';
  employmentType?: 'full_time' | 'part_time' | 'contract' | 'freelance' | 'internship';
  remote?: 'remote_only' | 'hybrid' | 'onsite' | 'unknown';
  technologies: string[];
  description: string;
  requirements: string[];
  url: string;                   // Original vacancy URL
  publishedAt?: string;          // ISO date string
  extractedAt: string;           // ISO date string
  contentHash: string;           // SHA-256 of title+company+description for dedup
}
```

### 5. Provider Detection System

Each provider implements a common interface:

```typescript
// packages/extension-shared/src/types/content-vacancy.ts
export interface ProviderDetector {
  readonly id: string;
  
  /** Check if current URL matches this provider */
  matches(url: string): boolean;
  
  /** Extract vacancy data from the page DOM */
  extract(document: Document, url: string): ContentVacancy | null;
  
  /** Detect if user clicked apply on this page */
  detectApply(document: Document, url: string): ApplyEvent | null;
  
  /** Get apply button selector for UI injection */
  getApplyButtonSelector?(): string | null;
}
```

**Provider registry** (in content, lightweight):

```typescript
// apps/extension/src/content/providers/provider-registry.ts
import type { ProviderDetector } from '@careeros/extension-shared';
import { LinkedInDetector } from './linkedin/detector';
import { HHDetector } from './hh/detector';
// ... other imports

const registry: ProviderDetector[] = [
  new LinkedInDetector(),
  new HHDetector(),
  new GreenhouseDetector(),
  new LeverDetector(),
  new AshbyDetector(),
  new WorkdayDetector(),
  new TeamtailorDetector(),
  new SmartRecruitersDetector(),
  new RecruiteeDetector(),
  new GenericJsonLdDetector(),
  new CompanyWatchDetector(),
];

export function detectProvider(url: string): ProviderDetector | null {
  return registry.find(d => d.matches(url)) ?? null;
}
```

**URL matching per provider**:

| Provider | URL Pattern |
|----------|-------------|
| LinkedIn | `*.linkedin.com/jobs/*`, `*.linkedin.com/jobs/view/*` |
| HeadHunter | `hh.ru/vacancy/*`, `hh.kz/vacancy/*` |
| Greenhouse | `boards.greenhouse.io/*/jobs/*`, `boards.greenhouse.io/*` |
| Lever | `jobs.lever.co/*` |
| Ashby | `jobs.ashbyhq.com/*` |
| Workday | `*.myworkdayjobs.com/*/job/*` |
| Teamtailor | `*.teamtailor.com/jobs/*` |
| SmartRecruiters | `careers.smartrecruiters.com/*/job/*` |
| Recruitee | `*.recruitee.com/o/*` |
| Generic | JSON-LD `@type: JobPosting` anywhere |
| Company Watch | Any career page (user-configured) |

### 6. Provider Implementations

Each provider follows the same structure. Here is the detailed extraction logic:

#### LinkedIn (`content/providers/linkedin/detector.ts`)

```typescript
export class LinkedInDetector implements ProviderDetector {
  readonly id = 'linkedin';
  
  matches(url: string): boolean {
    return /linkedin\.com\/jobs\/(view\/)?/.test(url);
  }
  
  extract(document: Document, url: string): ContentVacancy | null {
    // Selectors (updated frequently, need versioning):
    const title = document.querySelector('.top-card-layout__title')?.textContent?.trim()
      ?? document.querySelector('h1')?.textContent?.trim();
    const company = document.querySelector('.top-card-layout__second-subline a')?.textContent?.trim()
      ?? document.querySelector('.top-card-entity-list-item__entity-name')?.textContent?.trim();
    const location = document.querySelector('.top-card-layout__second-subline')?.textContent?.trim();
    const description = document.querySelector('.description__text')?.textContent?.trim()
      ?? document.querySelector('.show-more-less-html__markup')?.textContent?.trim();
    
    // Salary extraction (LinkedIn rarely shows salary)
    const salaryEl = document.querySelector('.salary-text')?.textContent?.trim();
    
    // Technology/skill extraction from description
    const skills = Array.from(document.querySelectorAll('.skills-section__skill-text'))
      .map(el => el.textContent?.trim() ?? '')
      .filter(Boolean);
    
    // Experience level from badge
    const expLevel = document.querySelector('.experience-level')?.textContent?.trim();
    
    // Remote detection
    const remoteEl = document.querySelector('.workplace-type')?.textContent?.trim();
    
    // External ID from URL
    const externalId = url.match(/\/jobs\/view\/(\d+)/)?.[1]
      ?? url.match(/currentJobId=(\d+)/)?.[1]
      ?? '';
    
    if (!title || !company) return null;
    
    return {
      provider: 'linkedin',
      externalId,
      title,
      company,
      location: location ?? '',
      salary: salaryEl ? parseLinkedInSalary(salaryEl) : undefined,
      experienceLevel: mapLinkedInExperience(expLevel),
      employmentType: undefined, // LinkedIn doesn't consistently show this
      remote: mapLinkedInRemote(remoteEl),
      technologies: skills,
      description: description ?? '',
      requirements: extractRequirements(description ?? ''),
      url: url.split('?')[0], // Clean URL
      publishedAt: undefined,
      extractedAt: new Date().toISOString(),
      contentHash: '',
    };
  }
}
```

#### HeadHunter (`content/providers/hh/detector.ts`)

```typescript
export class HHDetector implements ProviderDetector {
  readonly id = 'hh';
  
  matches(url: string): boolean {
    return /hh\.(ru|kz)\/vacancy\//.test(url);
  }
  
  extract(document: Document, url: string): ContentVacancy | null {
    const title = document.querySelector('[data-qa="vacancy-title"]')?.textContent?.trim()
      ?? document.querySelector('h1')?.textContent?.trim();
    const company = document.querySelector('[data-qa="vacancy-employer-logo"]')?.closest('a')?.textContent?.trim()
      ?? document.querySelector('[data-qa="vacancy-employer"]')?.textContent?.trim();
    const location = document.querySelector('[data-qa="vacancy-view-location"]')?.textContent?.trim();
    const description = document.querySelector('[data-qa="vacancy-description"]')?.textContent?.trim()
      ?? document.querySelector('.vacancy-description')?.textContent?.trim();
    const salary = document.querySelector('[data-qa="vacancy-compensation"]')?.textContent?.trim();
    
    const externalId = url.match(/\/vacancy\/(\d+)/)?.[1] ?? '';
    
    // HH has structured salary with currency
    const salaryParsed = salary ? parseHHSalary(salary) : undefined;
    
    // HH shows employment type
    const empType = document.querySelector('[data-qa="vacancy-serp__vacancy-employment"]')?.textContent?.trim();
    
    return {
      provider: 'hh',
      externalId,
      title: title ?? '',
      company: company ?? '',
      location: location ?? '',
      salary: salaryParsed,
      experienceLevel: mapHHExperience(
        document.querySelector('[data-qa="vacancy-serp__vacancy-experience"]')?.textContent?.trim()
      ),
      employmentType: mapHHEmployment(empType),
      remote: mapHHRemote(
        document.querySelector('[data-qa="vacancy-serp__vacancy-work-schedule"]')?.textContent?.trim()
      ),
      technologies: extractTechnologies(description ?? ''),
      description: description ?? '',
      requirements: extractRequirements(description ?? ''),
      url: url.split('?')[0],
      publishedAt: document.querySelector('[data-qa="vacancy-serp__vacancy-date"]')?.textContent?.trim(),
      extractedAt: new Date().toISOString(),
      contentHash: '',
    };
  }
}
```

#### Greenhouse (`content/providers/greenhouse/detector.ts`)

```typescript
export class GreenhouseDetector implements ProviderDetector {
  readonly id = 'greenhouse';
  
  matches(url: string): boolean {
    return /boards\.greenhouse\.io\/[^/]+\/jobs\/\d+/.test(url);
  }
  
  extract(document: Document, url: string): ContentVacancy | null {
    const title = document.querySelector('#header .app-title')?.textContent?.trim()
      ?? document.querySelector('h1')?.textContent?.trim();
    const company = document.querySelector('#header .company-name')?.textContent?.trim();
    const location = document.querySelector('#header .location')?.textContent?.trim();
    const description = document.querySelector('#content')?.textContent?.trim()
      ?? document.querySelector('.content')?.textContent?.trim();
    
    const externalId = url.match(/\/jobs\/(\d+)/)?.[1] ?? '';
    
    return {
      provider: 'greenhouse',
      externalId,
      title: title ?? '',
      company: company ?? '',
      location: location ?? '',
      technologies: extractTechnologies(description ?? ''),
      description: description ?? '',
      requirements: extractRequirements(description ?? ''),
      url,
      extractedAt: new Date().toISOString(),
      contentHash: '',
    };
  }
}
```

#### Generic JSON-LD (`content/providers/generic/jsonld.ts`)

```typescript
export class GenericJsonLdDetector implements ProviderDetector {
  readonly id = 'generic-jsonld';
  
  matches(url: string): boolean {
    // Always matches - this is the fallback
    return true;
  }
  
  extract(document: Document, url: string): ContentVacancy | null {
    // Find JSON-LD script with @type: JobPosting
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent ?? '');
        if (data['@type'] === 'JobPosting') {
          return {
            provider: 'generic',
            externalId: data.identifier?.value ?? data.identifier ?? url,
            title: data.title ?? '',
            company: data.hiringOrganization?.name ?? '',
            location: typeof data.jobLocation === 'object'
              ? `${data.jobLocation.address?.addressLocality ?? ''}, ${data.jobLocation.address?.addressCountry ?? ''}`
              : data.jobLocation ?? '',
            salary: data.estimatedSalary ? {
              min: data.estimatedSalary.minValue,
              max: data.estimatedSalary.maxValue,
              currency: data.estimatedSalary.currency ?? 'USD',
              period: data.estimatedSalary.unitText === 'HOUR' ? 'hourly' : 'yearly',
            } : undefined,
            experienceLevel: mapSchemaExperience(data.occupationalCategory),
            employmentType: mapSchemaEmployment(data.employmentType),
            remote: 'unknown',
            technologies: [],
            description: data.description ?? '',
            requirements: [],
            url: data.url ?? url,
            publishedAt: data.datePosted,
            extractedAt: new Date().toISOString(),
            contentHash: '',
          };
        }
      } catch {
        continue;
      }
    }
    
    return null;
  }
}
```

### 7. CareerOS Panel Injection

**Approach**: Shadow DOM for style isolation. The panel is a React component rendered into a `<div id="careeros-panel">` that uses Shadow DOM to prevent the host page's styles from leaking in.

**Injection flow**:

```typescript
// apps/extension/src/content/core/panel-injector.ts
export function injectPanel(vacancy: ContentVacancy, status: VacancyStatus): void {
  // Prevent double injection
  if (document.getElementById('careeros-panel-root')) return;
  
  const container = document.createElement('div');
  container.id = 'careeros-panel-root';
  container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 2147483647;';
  
  const shadow = container.attachShadow({ mode: 'closed' });
  
  // Inject styles (compiled CSS, not external file)
  const style = document.createElement('style');
  style.textContent = PANEL_CSS; // Bundled CSS string
  shadow.appendChild(style);
  
  // Mount React app
  const panelHost = document.createElement('div');
  panelHost.id = 'careeros-panel';
  shadow.appendChild(panelHost);
  
  document.body.appendChild(container);
  
  // Render React component
  import('./panel/panel.tsx').then(({ renderPanel }) => {
    renderPanel(panelHost, { vacancy, status });
  });
}
```

**Panel component** (`content/core/panel/panel.tsx`):

```tsx
// Minimal React component (no external deps - vanilla React createElement)
// Uses inline styles or CSS-in-JS to avoid needing a build step for CSS modules

interface PanelProps {
  vacancy: ContentVacancy;
  status: VacancyStatus;
}

export function Panel({ vacancy, status }: PanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  
  // Message to background for API calls
  const sendMessage = (type: string, payload: unknown) => {
    chrome.runtime.sendMessage({ type, payload });
  };
  
  if (collapsed) {
    return <CollapsedPanel onClick={() => setCollapsed(false)} />;
  }
  
  return (
    <div className="careeros-panel">
      <Header 
        title="CareerOS" 
        onClose={() => setCollapsed(true)} 
      />
      <VacancyInfo vacancy={vacancy} />
      <MatchScore percentage={status.matchPercentage} />
      <StatusBadge status={status.saved ? 'saved' : 'unsaved'} />
      <CompanyWatchBadge watching={status.companyWatched} />
      <Actions>
        <Button onClick={() => { setSaving(true); sendMessage('SAVE_VACANCY', vacancy); }}>
          {saving ? 'Saving...' : status.saved ? 'Saved' : 'Save to CareerOS'}
        </Button>
        <Button onClick={() => sendMessage('ANALYZE_VACANCY', vacancy)} disabled={analyzing}>
          {analyzing ? 'Analyzing...' : 'Analyze'}
        </Button>
        <Button onClick={() => sendMessage('TAILOR_RESUME', vacancy)}>
          Tailor Resume
        </Button>
        <Button onClick={() => sendMessage('COVER_LETTER', vacancy)}>
          Cover Letter
        </Button>
        <Button onClick={() => sendMessage('INTERVIEW_PREP', vacancy)}>
          Interview Prep
        </Button>
        <LinkButton href={`https://career-os.localhost/vacancies/${status.vacancyId}`}>
          Open in CareerOS
        </LinkButton>
        <LinkButton href={vacancy.url} target="_blank">
          Apply
        </LinkButton>
      </Actions>
    </div>
  );
}
```

**Styling approach**: CSS is compiled into a string constant (`PANEL_CSS`) during build. The panel uses a reset to avoid inheriting host page styles, then applies its own design tokens. The panel is positioned fixed in the top-right corner and can be collapsed to a small floating icon.

**Panel positioning**:
- Default: `position: fixed; top: 20px; right: 20px`
- User can drag to reposition (stored in `chrome.storage.local`)
- Auto-collapses after 5 seconds of inactivity
- Collapsed state: small CareerOS logo icon, expands on click

### 8. Background Service Worker

**Structure**: `apps/extension/src/background/service-worker.ts` is the entry point. It imports the message router and sets up all listeners.

```typescript
// apps/extension/src/background/service-worker.ts
import { MessageRouter } from './message-router';
import { AuthManager } from './auth-manager';
import { SyncManager } from './sync-manager';
import { OfflineQueue } from './offline-queue';
import { NotificationManager } from './notification-manager';
import { StorageBridge } from './storage-bridge';

const storage = new StorageBridge();
const auth = new AuthManager(storage);
const queue = new OfflineQueue(storage, auth);
const sync = new SyncManager(auth, queue);
const notifications = new NotificationManager();
const router = new MessageRouter(auth, queue, sync, notifications);

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  router.handle(message, sender, sendResponse);
  return true; // Keep channel open for async response
});

// Alarm-based sync (every 30 minutes)
chrome.alarms.create('sync', { periodInMinutes: 30 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'sync') {
    await sync.pullUpdates();
    await queue.processPending();
  }
});

// Extension install/update
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  }
});
```

**Message passing** (typed):

```typescript
// apps/extension/src/shared/types/messages.ts
export type ContentMessage =
  | { type: 'EXTRACT_VACANCY'; payload: { url: string } }
  | { type: 'SAVE_VACANCY'; payload: ContentVacancy }
  | { type: 'ANALYZE_VACANCY'; payload: ContentVacancy }
  | { type: 'TAILOR_RESUME'; payload: ContentVacancy }
  | { type: 'COVER_LETTER'; payload: ContentVacancy }
  | { type: 'INTERVIEW_PREP'; payload: ContentVacancy }
  | { type: 'APPLY_DETECTED'; payload: ApplyEvent }
  | { type: 'GET_VACANCY_STATUS'; payload: { url: string } }
  | { type: 'CHECK_AUTH'; payload: {} };

export type BackgroundResponse =
  | { ok: true; data: unknown }
  | { ok: false; error: string; code?: string };

export type PopupMessage =
  | { type: 'GET_RECENT_VACANCIES'; payload: { limit: number } }
  | { type: 'GET_SAVED_TODAY'; payload: {} }
  | { type: 'GET_PENDING_APPLICATIONS'; payload: {} }
  | { type: 'GET_UPCOMING_INTERVIEWS'; payload: {} }
  | { type: 'GET_NOTIFICATIONS'; payload: { limit: number } }
  | { type: 'QUICK_SEARCH'; payload: { query: string } };
```

**Message router**:

```typescript
// apps/extension/src/background/message-router.ts
export class MessageRouter {
  constructor(
    private auth: AuthManager,
    private queue: OfflineQueue,
    private sync: SyncManager,
    private notifications: NotificationManager,
  ) {}
  
  async handle(message: ContentMessage | PopupMessage, sender: chrome.runtime.MessageSender, sendResponse: (response: BackgroundResponse) => void): Promise<void> {
    try {
      switch (message.type) {
        case 'SAVE_VACANCY':
          const result = await this.auth.authenticatedRequest('/api/v1/vacancies', {
            method: 'POST',
            body: message.payload,
          });
          sendResponse({ ok: true, data: result });
          break;
          
        case 'ANALYZE_VACANCY':
          // Queue AI job (never auto-execute)
          const job = await this.auth.authenticatedRequest('/api/v1/ai/analyze-vacancy', {
            method: 'POST',
            body: { vacancyUrl: message.payload.url },
          });
          sendResponse({ ok: true, data: job });
          break;
          
        case 'CHECK_AUTH':
          sendResponse({ ok: true, data: { authenticated: this.auth.isAuthenticated() } });
          break;
          
        // ... other cases
      }
    } catch (error) {
      if (error instanceof OfflineError) {
        this.queue.enqueue(message);
        sendResponse({ ok: true, data: { queued: true } });
      } else {
        sendResponse({ ok: false, error: String(error) });
      }
    }
  }
}
```

### 9. Popup UI

**Framework**: React 19 with `react-dom/client`. The popup is a small React app that loads quickly. It uses the same `@careeros/shared` package for types.

**Component structure**:

```typescript
// apps/extension/src/popup/popup.tsx
import { createRoot } from 'react-dom/client';
import { PopupApp } from './components/popup-app';

const root = createRoot(document.getElementById('popup-root')!);
root.render(<PopupApp />);
```

**Popup app structure**:

```tsx
// apps/extension/src/popup/components/popup-app.tsx
function PopupApp() {
  const [tab, setTab] = useState<'recent' | 'saved' | 'applications' | 'settings'>('recent');
  const [authState, setAuthState] = useState<AuthState | null>(null);
  
  useEffect(() => {
    // Check auth status on mount
    chrome.runtime.sendMessage({ type: 'CHECK_AUTH' }, (response) => {
      setAuthState(response.data);
    });
  }, []);
  
  return (
    <div className="popup-app">
      <Header />
      {!authState?.authenticated ? (
        <LoginPage onLogin={() => setAuthState({ authenticated: true })} />
      ) : (
        <>
          <TabBar active={tab} onChange={setTab} />
          {tab === 'recent' && <RecentVacancies />}
          {tab === 'saved' && <SavedToday />}
          {tab === 'applications' && <PendingApplications />}
          {tab === 'settings' && <SettingsLink />}
        </>
      )}
    </div>
  );
}
```

**Data fetching**: Popup components communicate with the background service worker via `chrome.runtime.sendMessage`. The background service worker handles API calls and caches results.

**Popup startup target**: <300ms. Achieved by:
- No heavy imports (no date-fns, no large libraries)
- Cache last-known data in `chrome.storage.local`
- Show cached data immediately, fetch fresh data in background
- Minimal React tree (few components, no Suspense needed)

### 10. Options Page

**Settings schema** (Zod):

```typescript
// packages/extension-shared/src/schemas/settings.ts
import { z } from 'zod';

export const settingsSchema = z.object({
  backend: z.object({
    url: z.string().url().default('http://localhost:3000'),
  }),
  auth: z.object({
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
    user: z.object({
      id: z.string(),
      email: z.string(),
    }).optional(),
  }).default({}),
  theme: z.enum(['light', 'dark', 'system']).default('system'),
  providers: z.object({
    enabled: z.array(z.string()).default([
      'linkedin', 'hh', 'greenhouse', 'lever', 'ashby',
      'workday', 'teamtailor', 'smartrecruiters', 'recruitee',
      'generic',
    ]),
  }).default({}),
  ai: z.object({
    mode: z.enum(['manual', 'auto']).default('manual'),
  }).default({ mode: 'manual' }),
  notifications: z.object({
    enabled: z.boolean().default(true),
    watchedCompanies: z.boolean().default(true),
    aiCompleted: z.boolean().default(true),
    interviewReminders: z.boolean().default(true),
    followUps: z.boolean().default(true),
  }).default({}),
  privacy: z.object({
    collectAnalytics: z.boolean().default(false),
    activateOnAllPages: z.boolean().default(false),
  }).default({}),
  panel: z.object({
    position: z.object({ top: z.number(), right: z.number() }).default({ top: 20, right: 20 }),
    autoCollapse: z.boolean().default(true),
    collapseAfterMs: z.number().default(5000),
  }).default({}),
});

export type Settings = z.infer<typeof settingsSchema>;
```

**Options page**: Full-page React app with sections for each setting category. Settings are persisted to `chrome.storage.local` as JSON.

### 11. Authentication Flow

**Token storage**: `chrome.storage.local` (encrypted at rest by Chrome). NOT localStorage (which is shared with the web page and vulnerable to XSS).

**Auth flow**:

1. **Login**: User opens options page, enters email/password. Background service worker sends `POST /api/v1/auth/login` and stores tokens.

2. **Token refresh**: `AuthManager` checks token expiry before each API call. If expired, refreshes using refresh token. On 401, clears tokens and notifies popup/options.

3. **Session management**: `AuthManager` stores:
   - `auth.accessToken` (string)
   - `auth.refreshToken` (string)
   - `auth.user` (id, email)
   - `auth.expiresAt` (timestamp, calculated from JWT)

```typescript
// apps/extension/src/background/auth-manager.ts
export class AuthManager {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt: number = 0;
  
  constructor(private storage: StorageBridge) {
    this.loadFromStorage();
  }
  
  private async loadFromStorage(): Promise<void> {
    const data = await this.storage.get('auth');
    if (data) {
      this.accessToken = data.accessToken;
      this.refreshToken = data.refreshToken;
      this.expiresAt = data.expiresAt;
    }
  }
  
  async login(email: string, password: string): Promise<User> {
    const response = await fetch(`${this.backendUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    if (!response.ok) throw new AuthError('Login failed');
    
    const { accessToken, refreshToken, user } = await response.json();
    
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.expiresAt = Date.parse(accessToken) + 15 * 60 * 1000; // 15 min
    
    await this.storage.set('auth', {
      accessToken,
      refreshToken,
      user,
      expiresAt: this.expiresAt,
    });
    
    return user;
  }
  
  async authenticatedRequest(path: string, options: RequestInit): Promise<unknown> {
    await this.ensureValidToken();
    
    const response = await fetch(`${this.backendUrl}${path}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${this.accessToken}`,
      },
    });
    
    if (response.status === 401) {
      const refreshed = await this.refresh();
      if (!refreshed) throw new AuthError('Session expired');
      return this.authenticatedRequest(path, options);
    }
    
    if (!response.ok) throw new ApiError(response.status, await response.text());
    return response.json();
  }
  
  private async refresh(): Promise<boolean> {
    if (!this.refreshToken) return false;
    
    try {
      const response = await fetch(`${this.backendUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });
      
      if (!response.ok) {
        this.clear();
        return false;
      }
      
      const { accessToken, refreshToken } = await response.json();
      this.accessToken = accessToken;
      this.refreshToken = refreshToken;
      this.expiresAt = Date.parse(accessToken) + 15 * 60 * 1000;
      
      await this.storage.set('auth', {
        accessToken,
        refreshToken,
        user: this.user,
        expiresAt: this.expiresAt,
      });
      
      return true;
    } catch {
      this.clear();
      return false;
    }
  }
  
  isAuthenticated(): boolean {
    return this.accessToken !== null && Date.now() < this.expiresAt;
  }
  
  clear(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = 0;
    this.storage.remove('auth');
  }
}
```

### 12. Offline Queue

**Storage**: `chrome.storage.local` as JSON array (max 50 items, FIFO eviction).

**Queue item schema**:

```typescript
// packages/extension-shared/src/schemas/queue-item.ts
export interface QueueItem {
  id: string;                    // UUID
  type: string;                  // Message type (SAVE_VACANCY, ANALYZE_VACANCY, etc.)
  payload: unknown;              // Original message payload
  createdAt: number;             // Timestamp
  attempts: number;              // Retry count
  maxAttempts: number;           // Default: 5
  nextRetryAt: number;           // Exponential backoff timestamp
  status: 'pending' | 'processing' | 'failed';
}
```

**Retry logic**:

```typescript
// apps/extension/src/background/offline-queue.ts
export class OfflineQueue {
  private readonly MAX_ITEMS = 50;
  private readonly MAX_ATTEMPTS = 5;
  private readonly BACKOFF_BASE_MS = 30_000; // 30 seconds
  
  async enqueue(message: ContentMessage): Promise<void> {
    const items = await this.storage.get<QueueItem[]>('offlineQueue') ?? [];
    
    if (items.length >= this.MAX_ITEMS) {
      items.shift(); // Evict oldest
    }
    
    items.push({
      id: crypto.randomUUID(),
      type: message.type,
      payload: message.payload,
      createdAt: Date.now(),
      attempts: 0,
      maxAttempts: this.MAX_ATTEMPTS,
      nextRetryAt: Date.now(),
      status: 'pending',
    });
    
    await this.storage.set('offlineQueue', items);
  }
  
  async processPending(): Promise<void> {
    const items = await this.storage.get<QueueItem[]>('offlineQueue') ?? [];
    const now = Date.now();
    
    const pending = items.filter(
      item => item.status === 'pending' && item.nextRetryAt <= now
    );
    
    for (const item of pending) {
      try {
        item.status = 'processing';
        await this.storage.set('offlineQueue', items);
        
        // Process via message router
        await this.processItem(item);
        
        // Remove successful items
        const idx = items.indexOf(item);
        if (idx !== -1) items.splice(idx, 1);
      } catch {
        item.attempts++;
        if (item.attempts >= item.maxAttempts) {
          item.status = 'failed';
        } else {
          item.nextRetryAt = now + this.BACKOFF_BASE_MS * Math.pow(2, item.attempts);
        }
      }
    }
    
    await this.storage.set('offlineQueue', items);
  }
}
```

### 13. Apply Detection

**Approach**: Each provider has an `apply-detector.ts` that listens for specific DOM events (clicks on apply buttons, form submissions, navigation to confirmation pages).

**Generic apply detection** (`content/apply-tracker/apply-detector.ts`):

```typescript
// Detects common apply button patterns
const APPLY_SELECTORS = [
  'a[href*="apply"]',
  'button[data-qa*="apply"]',
  'button[class*="apply"]',
  'a[class*="apply"]',
  '[data-qa="apply-button"]',
  '.apply-button',
  'button:has-text("Apply")',
  'a:has-text("Apply")',
];

export class ApplyDetector {
  private applyUrls: Set<string> = new Set();
  
  constructor(private provider: ProviderDetector) {}
  
  start(): void {
    // Listen for clicks on apply buttons
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const applyButton = target.closest(APPLY_SELECTORS.join(', '));
      
      if (applyButton) {
        this.trackApply();
      }
    }, true);
    
    // Listen for form submissions (resume upload forms)
    document.addEventListener('submit', (event) => {
      const form = event.target as HTMLFormElement;
      if (this.isApplyForm(form)) {
        this.trackApply();
      }
    }, true);
    
    // Check for confirmation pages
    this.checkForConfirmation();
  }
  
  private trackApply(): void {
    const url = window.location.href;
    chrome.runtime.sendMessage({
      type: 'APPLY_DETECTED',
      payload: {
        provider: this.provider.id,
        url,
        timestamp: new Date().toISOString(),
      },
    });
  }
  
  private checkForConfirmation(): void {
    // Provider-specific confirmation detection
    const confirmationPatterns = [
      /thank.*you.*applic/i,
      /application.*submitted/i,
      /application.*received/i,
      /you.*have.*applied/i,
    ];
    
    const text = document.body.textContent ?? '';
    if (confirmationPatterns.some(p => p.test(text))) {
      this.trackApply();
    }
  }
}
```

**Provider-specific apply detection**:

| Provider | Apply Button Selector | Confirmation Pattern |
|----------|----------------------|---------------------|
| LinkedIn | `.jobs-apply-button`, `[data-control-name="apply_button"]` | "Application sent" modal |
| HeadHunter | `[data-qa="vacancy-response-link"]` | "Отклик отправлен" text |
| Greenhouse | `.apply-form button[type="submit"]` | "Thank you for applying" text |
| Lever | `.postings-apply button` | URL change to `/applied` |
| Ashby | `.ashby-application-form button[type="submit"]` | "Thank you" text |

### 14. Notifications

**Permission handling**:

```typescript
// apps/extension/src/background/notification-manager.ts
export class NotificationManager {
  async requestPermission(): Promise<boolean> {
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    
    const result = await Notification.requestPermission();
    return result === 'granted';
  }
  
  async notifyWatchedCompany(vacancy: ContentVacancy): Promise<void> {
    if (!await this.requestPermission()) return;
    
    chrome.notifications.create(`watched-${vacancy.externalId}`, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: `New vacancy at ${vacancy.company}`,
      message: `${vacancy.title} - ${vacancy.location}`,
      priority: 2,
    });
  }
  
  async notifyAiCompleted(jobId: string, result: unknown): Promise<void> {
    if (!await this.requestPermission()) return;
    
    chrome.notifications.create(`ai-${jobId}`, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'AI Task Completed',
      message: 'Your vacancy analysis is ready',
      priority: 1,
    });
  }
  
  async notifyInterviewReminder(interview: { company: string; date: string }): Promise<void> {
    chrome.notifications.create(`interview-${interview.date}`, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Interview Reminder',
      message: `Interview with ${interview.company} in 1 hour`,
      priority: 2,
    });
  }
}
```

**Notification click handling**:

```typescript
// In service-worker.ts
chrome.notifications.onClicked.addListener((notificationId) => {
  const [type, id] = notificationId.split('-', 2);
  
  switch (type) {
    case 'watched':
    case 'ai':
      chrome.tabs.create({ url: `https://career-os.localhost/vacancies/${id}` });
      break;
    case 'interview':
      chrome.tabs.create({ url: 'https://career-os.localhost/dashboard' });
      break;
  }
  
  chrome.notifications.clear(notificationId);
});
```

### 15. Testing Strategy

**Unit tests** (Vitest):

```typescript
// apps/extension/tests/unit/providers/linkedin.test.ts
import { describe, it, expect } from 'vitest';
import { LinkedInDetector } from '../../../src/content/providers/linkedin/detector';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('LinkedInDetector', () => {
  const detector = new LinkedInDetector();
  
  describe('matches()', () => {
    it('matches LinkedIn job view URLs', () => {
      expect(detector.matches('https://www.linkedin.com/jobs/view/senior-engineer-12345')).toBe(true);
      expect(detector.matches('https://www.linkedin.com/jobs/search/?keywords=react')).toBe(false);
    });
  });
  
  describe('extract()', () => {
    it('extracts vacancy from LinkedIn job page HTML', () => {
      const html = readFileSync(resolve(__dirname, '../../fixtures/html/linkedin-job.html'), 'utf-8');
      const doc = new DOMParser().parseFromString(html, 'text/html');
      
      const result = detector.extract(doc, 'https://www.linkedin.com/jobs/view/12345');
      
      expect(result).not.toBeNull();
      expect(result!.provider).toBe('linkedin');
      expect(result!.title).toBe('Senior Software Engineer');
      expect(result!.company).toBe('Acme Corp');
    });
  });
});
```

**Integration tests** (Vitest + mocked chrome API):

```typescript
// apps/extension/tests/integration/content-background.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageRouter } from '../../src/background/message-router';

// Mock chrome API
vi.stubGlobal('chrome', {
  runtime: {
    sendMessage: vi.fn(),
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
});

describe('MessageRouter', () => {
  let router: MessageRouter;
  
  beforeEach(() => {
    router = new MessageRouter(/* deps */);
  });
  
  it('handles SAVE_VACANCY message', async () => {
    const sendResponse = vi.fn();
    await router.handle(
      { type: 'SAVE_VACANCY', payload: mockVacancy },
      { tab: { id: 1 } },
      sendResponse
    );
    
    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true })
    );
  });
});
```

**E2E tests** (Playwright or Puppeteer):

```typescript
// apps/extension/tests/e2e/extension-load.test.ts
import { describe, it, expect } from 'vitest';
import { chromium } from 'playwright';

describe('Extension loads', () => {
  it('loads in Chrome without errors', async () => {
    const browser = await chromium.launch({
      headless: false,
      args: [
        `--disable-extensions-except=${resolve(__dirname, '../../dist')}`,
        `--load-extension=${resolve(__dirname, '../../dist')}`,
      ],
    });
    
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Navigate to a supported job page
    await page.goto('https://www.linkedin.com/jobs/view/12345');
    
    // Wait for panel injection
    await page.waitForSelector('#careeros-panel-root', { timeout: 5000 });
    
    // Check panel is visible
    const panel = await page.$('#careeros-panel-root');
    expect(panel).not.toBeNull();
    
    await browser.close();
  });
});
```

**Provider detection tests**: Use HTML fixtures for each provider, parse with `jsdom`, and verify extraction.

**Build verification test**: Run `vite build` and verify:
- All content scripts are <100KB
- Popup bundle is <300KB
- No missing manifest entries
- All imports resolve

### 16. Backend API Integration

**Existing endpoints used by extension**:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/auth/login` | POST | Login |
| `/api/v1/auth/register` | POST | Register |
| `/api/v1/auth/refresh` | POST | Token refresh |
| `/api/v1/vacancies` | POST | Save vacancy |
| `/api/v1/vacancies/:id` | GET | Get vacancy details |
| `/api/v1/applications` | POST | Create application |
| `/api/v1/applications/:id/status` | PATCH | Update application status |
| `/api/v1/ai/analyze-vacancy` | POST | Trigger vacancy analysis |
| `/api/v1/ai/tailor-resume` | POST | Trigger resume tailoring |
| `/api/v1/ai/cover-letter` | POST | Generate cover letter |
| `/api/v1/ai/interview-prep` | POST | Generate interview prep |
| `/api/v1/ai/jobs/:jobId` | GET | Check AI job status |
| `/api/v1/company-watch` | GET | Get watched companies |
| `/api/v1/company-watch/discover` | POST | Discover company page |
| `/api/v1/dashboard/*` | GET | Dashboard stats |
| `/api/v1/providers/linkedin/ingest` | POST | LinkedIn ingestion (existing!) |

**New endpoints needed**:

1. **`POST /api/v1/vacancies/by-url`** - Check if a vacancy already exists by URL (for "already saved" indicator):
   ```typescript
   // Request
   { url: string }
   // Response
   { exists: boolean; vacancyId?: string; applicationStatus?: string }
   ```

2. **`GET /api/v1/company-watch/check`** - Check if a company is watched:
   ```typescript
   // Request (query)
   { companyName: string }
   // Response
   { watched: boolean; companyId?: string }
   ```

3. **`GET /api/v1/extension/status`** - Extension health check + server version:
   ```typescript
   // Response
   { version: string; serverVersion: string; features: string[] }
   ```

These are minor additions that don't change existing API contracts.

### 17. Implementation Phases

#### Phase 1: Foundation (Week 1-2)

**Goal**: Extension loads, detects one provider, shows panel.

- [ ] Set up `apps/extension/` with Vite + Manifest V3
- [ ] Create `packages/extension-shared/` with types and schemas
- [ ] Implement background service worker skeleton
- [ ] Implement `AuthManager` (login, token refresh, secure storage)
- [ ] Implement `StorageBridge` (typed chrome.storage wrapper)
- [ ] Implement `MessageRouter` skeleton
- [ ] Implement one provider (LinkedIn) content script
- [ ] Implement panel injector with Shadow DOM
- [ ] Implement basic panel UI (React, no styling polish)
- [ ] Implement popup skeleton (login + recent vacancies)
- [ ] Add to `pnpm-workspace.yaml` and `turbo.json`
- [ ] Unit tests for LinkedIn detector
- [ ] Build verification (content script <100KB)

#### Phase 2: Provider Expansion (Week 3-4)

**Goal**: All 9 providers working, full extraction.

- [ ] HeadHunter content script
- [ ] Greenhouse content script
- [ ] Lever content script
- [ ] Ashby content script
- [ ] Workday content script
- [ ] Teamtailor content script
- [ ] SmartRecruiters content script
- [ ] Recruitee content script
- [ ] Generic JSON-LD content script
- [ ] Provider registry with URL matching
- [ ] HTML fixtures for each provider
- [ ] Unit tests for each provider
- [ ] Content script bundle size verification

#### Phase 3: Backend Integration (Week 5-6)

**Goal**: Full CRUD with backend, offline queue.

- [ ] API client with auth headers
- [ ] Save vacancy flow (content script -> background -> API)
- [ ] Application tracking flow
- [ ] Company watch check
- [ ] Offline queue (enqueue, retry, backoff)
- [ ] Sync manager (periodic pull)
- [ ] Implement new backend endpoints (`by-url`, `company-watch/check`)
- [ ] Integration tests

#### Phase 4: AI Features (Week 7)

**Goal**: AI buttons work, background jobs.

- [ ] Analyze Vacancy button -> POST /api/v1/ai/analyze-vacancy
- [ ] Tailor Resume button -> POST /api/v1/ai/tailor-resume
- [ ] Cover Letter button -> POST /api/v1/ai/cover-letter
- [ ] Interview Prep button -> POST /api/v1/ai/interview-prep
- [ ] AI job status polling (GET /api/v1/ai/jobs/:jobId)
- [ ] AI task completion notifications
- [ ] "Manual only" enforcement (no auto-triggering)

#### Phase 5: Polish & UX (Week 8-9)

**Goal**: Production-quality UI/UX.

- [ ] Panel styling (design tokens, dark/light theme)
- [ ] Popup UI (recent vacancies, saved today, pending applications)
- [ ] Options page (all settings sections)
- [ ] Apply detection per provider
- [ ] Notification system (watched companies, AI completed, interviews)
- [ ] Panel collapse/expand behavior
- [ ] Panel position persistence
- [ ] Keyboard shortcuts (Ctrl+Shift+S to save current vacancy)

#### Phase 6: Testing & Documentation (Week 10)

**Goal**: Ship-ready.

- [ ] E2E tests (Playwright)
- [ ] Build verification tests
- [ ] Performance profiling (memory leaks, startup time)
- [ ] Documentation (ADR, developer guide, provider integration guide)
- [ ] Cross-browser testing (Chrome, Edge, Brave, Arc)
- [ ] Privacy audit (data transmission only on explicit user action)

## Consequences

### Positive

- Extension integrates naturally with existing monorepo structure
- Provider detection reuses patterns from backend provider system
- Shared types package prevents drift between extension and backend
- Shadow DOM panel prevents style conflicts with host pages
- Offline queue ensures reliability in poor network conditions
- AI features are manual-only by design (safety constraint)
- Manifest V3 future-proofs against Chrome's deprecation timeline

### Negative

- Content script bundle size is a hard constraint (<100KB) requiring careful code splitting
- LinkedIn frequently changes DOM selectors, requiring maintenance
- Service workers have no persistent state (must reload from storage on each wake)
- Chrome storage API is async, adding complexity to synchronous flows
- Testing content scripts requires HTML fixtures and DOM mocking
- Cross-browser testing adds QA burden (though Chromium-based browsers share API)

### Risks

| Risk | Mitigation |
|------|-----------|
| LinkedIn DOM changes break extraction | Version selectors, add fallback extraction, monitor breakage via error reports |
| Content script exceeds 100KB | Build-time size check in CI, dynamic imports for non-critical code |
| Service worker killed by Chrome | Use chrome.alarms for periodic tasks, persist state in chrome.storage |
| Auth tokens exposed in chrome.storage | Use chrome.storage.local (not sync), no plain-text secrets in logs, token rotation |
| Extension conflicts with other extensions | Shadow DOM isolation, unique CSS class prefix (`careeros-*`) |

## References

- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
- [vite-plugin-web-extension](https://github.com/nicolo-ribaudo/vite-plugin-web-extension)
- [chrome.storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Content Scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Service Workers](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers)
- Existing LinkedIn ingestion endpoint: `apps/backend/src/routes/providers/linkedin-ingest-routes.ts`
- Existing provider pattern: `packages/providers/src/providers/`
- Existing auth types: `packages/auth/src/types.ts`
- Existing vacancy model: `packages/career/src/domain/entities/vacancy.ts`
