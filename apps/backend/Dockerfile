# Build context is the repo root (monorepo): docker build -f apps/backend/Dockerfile .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS pruner
COPY . .
RUN npx turbo prune @careeros/backend --docker

FROM base AS installer
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
COPY tsconfig.base.json ./tsconfig.base.json
RUN pnpm --filter @careeros/database exec prisma generate
RUN pnpm turbo build --filter=@careeros/backend

FROM base AS runner
ENV NODE_ENV=production
COPY --from=installer /app .
# resume-service.ts writes uploaded resumes under uploads/resumes (relative to
# process.cwd() = /app) — must be writable by the non-root user below, and
# pre-owned here so a fresh backend_uploads volume mount inherits it.
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

USER node

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "apps/backend/dist/index.js"]
