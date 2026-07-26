# Build context is the repo root (monorepo): docker build -f apps/worker/Dockerfile .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS pruner
COPY . .
RUN npx turbo prune @careeros/worker --docker

FROM base AS installer
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
COPY tsconfig.base.json ./tsconfig.base.json
RUN pnpm --filter @careeros/database exec prisma generate
RUN pnpm turbo build --filter=@careeros/worker

FROM base AS runner
ENV NODE_ENV=production
COPY --from=installer /app .

USER node

EXPOSE 3002

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3002/health || exit 1

CMD ["node", "apps/worker/dist/index.js"]
