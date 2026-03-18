FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app

# Development stage — used by docker-compose with volume mounts
FROM base AS development

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/backend/package.json ./packages/backend/
RUN pnpm install --frozen-lockfile

COPY packages/backend/entrypoint.sh ./packages/backend/
COPY packages/backend ./packages/backend

WORKDIR /app/packages/backend
ENTRYPOINT ["sh", "./entrypoint.sh"]
CMD ["pnpm", "run", "start:dev"]

# Build stage
FROM base AS build

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/backend/package.json ./packages/backend/
RUN pnpm install --frozen-lockfile --filter=backend

COPY packages/backend ./packages/backend
RUN pnpm --filter=backend run build

# Production stage — node_modules from build stage, dist from compile
FROM node:20-slim AS production

WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/backend/dist ./dist

CMD ["node", "dist/main"]
