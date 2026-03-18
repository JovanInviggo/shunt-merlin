FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/dashboard/package.json ./packages/dashboard/
RUN pnpm install --frozen-lockfile --filter=dashboard

COPY packages/dashboard ./packages/dashboard

# VITE_API_URL is baked into the JS bundle at build time.
# It must be the public URL your users' browsers will call.
# Example: https://api.yourdomain.com
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL

RUN pnpm --filter=dashboard run build

# ---

FROM nginx:1.27-alpine

COPY --from=build /app/packages/dashboard/dist /usr/share/nginx/html
COPY --from=build /app/packages/dashboard/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
