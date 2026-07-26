# ADR-008: Frontend Technology Stack

## Status

Accepted

## Date

2026-01-15

## Context

CareerOS needs a web dashboard for:
- Job browsing and search
- Application pipeline (Kanban)
- Resume management
- Analytics and reporting
- Settings and configuration

Requirements:
- Modern React
- Good developer experience
- Type safety
- Fast development
- Production-ready

## Decision

Next.js 15 + React 19 + Tailwind CSS + shadcn/ui + TanStack Query + Zustand

## Stack Breakdown

### Next.js 15
- App Router for file-based routing
- Server Components for initial data loading
- API routes for BFF (Backend for Frontend)
- Image optimization built-in

### React 19
- Server Components
- Actions for form handling
- Latest performance improvements

### Tailwind CSS
- Utility-first styling
- No CSS-in-JS overhead
- Consistent design system
- Dark mode support

### shadcn/ui
- Copy-paste components (no dependency lock-in)
- Built on Radix UI primitives
- Customizable via Tailwind
- Accessible by default

### TanStack Query
- Server state management
- Automatic caching
- Background refetching
- Optimistic updates

### Zustand
- Client state management
- Simple API
- No boilerplate
- TypeScript-first

### React Hook Form + Zod
- Form validation
- Type-safe schemas
- Minimal re-renders
- Integration with shadcn/ui

## Component Structure

```
apps/dashboard/src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/
│   │   ├── jobs/
│   │   ├── applications/
│   │   ├── resumes/
│   │   ├── analytics/
│   │   └── settings/
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── jobs/            # Job-related components
│   ├── applications/    # Application components
│   ├── resumes/         # Resume components
│   └── shared/          # Shared components
├── hooks/
│   ├── use-jobs.ts
│   ├── use-applications.ts
│   └── use-resumes.ts
├── lib/
│   ├── api.ts           # API client
│   └── utils.ts         # Utilities
└── stores/
    ├── auth-store.ts
    └── ui-store.ts
```

## Data Fetching Pattern

```typescript
// hooks/use-jobs.ts
export function useJobs(filters: JobFilters) {
  return useQuery({
    queryKey: ['jobs', filters],
    queryFn: () => api.getJobs(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// hooks/use-applications.ts
export function useUpdateApplicationStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, status }) => api.updateApplicationStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });
}
```

## Consequences

### Positive
- Fast development with shadcn/ui
- Great DX with Next.js + TypeScript
- Automatic caching with TanStack Query
- Simple state management with Zustand

### Negative
- Next.js adds complexity over plain React
- Server Components require thinking about boundaries
- Multiple state management solutions (Query + Zustand)

### Mitigations
- Clear guidelines on when to use Query vs Zustand
- Feature flags for gradual Server Component adoption
- Comprehensive component library reduces boilerplate

## Alternatives Considered

1. **Vite + React**: Rejected. Next.js provides better structure and SSR.
2. **Remix**: Considered. Next.js has better ecosystem.
3. **MUI/Tailwind UI**: Rejected. shadcn/ui is more flexible.
4. **Jotai/Recoil**: Rejected. Zustand is simpler.
5. **SWR**: Rejected. TanStack Query is more feature-rich.
