# ADR-004: Next.js for Dashboard

## Status

Accepted

## Date

2025-01-15

## Context

We need a frontend framework for the dashboard that provides:

- Server-side rendering
- React ecosystem support
- Good developer experience
- Performance optimization
- API routes for BFF pattern

## Decision

We will use Next.js 15 with App Router for the dashboard.

## Consequences

### Positive

- Server Components for better performance
- App Router for file-based routing
- Built-in API routes
- Image optimization
- Font optimization
- Good TypeScript support
- Large React ecosystem

### Negative

- More complex than SPA
- Server Components require mental model shift
- Larger bundle than Vite-based solutions

### Mitigations

- Use Server Components where appropriate
- Client Components for interactive parts
- Code splitting with dynamic imports

## Stack

- Next.js 15 (App Router)
- React 19
- Tailwind CSS 4
- shadcn/ui
- TanStack Query
- Zustand
- React Hook Form
- Zod

## Alternatives Considered

### Vite + React

Faster development, simpler setup.

**Rejected because:**
- No SSR
- No API routes
- More configuration needed
- Less built-in optimization

### Remix

Full-stack React framework.

**Rejected because:**
- Smaller ecosystem
- Less community adoption
- Different mental model

### Nuxt (Vue)

Vue-based SSR framework.

**Rejected because:**
- Team prefers React
- Smaller ecosystem than React

## References

- [Next.js Documentation](https://nextjs.org/docs)
- [Next.js 15 Features](https://nextjs.org/blog/next-15)
- [shadcn/ui](https://ui.shadcn.com/)
