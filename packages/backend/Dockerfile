FROM node:20-alpine AS base

WORKDIR /app

# Development stage
FROM base AS development

COPY package*.json ./
RUN npm ci

COPY entrypoint.sh ./

COPY . .

ENTRYPOINT ["sh", "./entrypoint.sh"]
CMD ["npm", "run", "start:dev"]

# Production deps stage (cached independently from build)
FROM base AS deps

COPY package*.json ./
RUN npm ci --omit=dev

# Build stage
FROM base AS build

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM base AS production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

CMD ["node", "dist/main"]
