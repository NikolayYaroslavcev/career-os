# Build context is the repo root (monorepo): docker build -f apps/dashboard/Dockerfile .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS pruner
COPY . .
RUN npx turbo prune @careeros/dashboard --docker

FROM base AS installer
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
COPY tsconfig.base.json ./tsconfig.base.json

ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm turbo build --filter=@careeros/dashboard

FROM base AS runner
ENV NODE_ENV=production
COPY --from=installer /app .
WORKDIR /app/apps/dashboard

USER node

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3001/ || exit 1

CMD ["pnpm", "start"]
