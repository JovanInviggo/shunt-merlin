FROM node:20-alpine AS base

WORKDIR /app

# Development stage
FROM base AS development

COPY package*.json ./
RUN npm install

COPY entrypoint.sh ./

COPY . .

ENTRYPOINT ["sh", "./entrypoint.sh"]
CMD ["npm", "run", "start:dev"]

# Build stage
FROM base AS build

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Production stage
FROM base AS production

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist

CMD ["node", "dist/main"]
