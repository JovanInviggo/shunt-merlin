# Shunt Wizard

Monorepo for the Shunt Wizard platform: a NestJS backend API, React admin dashboard, and mobile app (in progress).

## Prerequisites

- Node.js >= 18
- pnpm (via corepack: `corepack enable && corepack prepare pnpm@10.32.1 --activate`)
- Docker and Docker Compose (recommended) OR PostgreSQL installed locally

## Monorepo Setup

- **Package manager:** pnpm@10.32.1 (via corepack)
- **Build orchestration:** Turborepo (`turbo` ^2.5.0)
- **Workspaces:** `packages/backend`, `packages/dashboard`, `packages/mobile`
- **`.npmrc`:** `node-linker=hoisted` (required for React Native/Expo compatibility)
- **`patches/`:** pnpm native patches at repo root

## Quick Start (Docker)

```bash
# Install dependencies
pnpm install

# Start PostgreSQL and backend with hot reload
pnpm run docker:up

# In another terminal, seed the database
pnpm run docker:seed

# Stop everything
pnpm run docker:down
```

The API will be available at `http://localhost:3000`.

## Quick Start (Local)

```bash
# Install dependencies
pnpm install

# Set up PostgreSQL database
createdb shunt_wizzard

# Configure environment
cp packages/backend/.env.example packages/backend/.env
# Edit .env with your database credentials

# Start development server
pnpm run dev:backend

# Seed the database
pnpm run seed
```

## Project Structure

```
shunt-wizzard/
├── packages/
│   ├── backend/          # NestJS API (port 3000)
│   │   ├── src/
│   │   │   ├── auth/     # JWT authentication
│   │   │   ├── user/     # Admin user management
│   │   │   ├── study/    # Study ID management
│   │   │   ├── recording/ # Recording references
│   │   │   ├── s3/       # Presigned S3 upload URLs
│   │   │   └── database/ # TypeORM config, migrations & seeds
│   │   └── Dockerfile
│   ├── dashboard/        # React + Vite admin dashboard
│   │   ├── src/
│   │   ├── nginx.conf    # Production nginx config
│   │   └── Dockerfile
│   └── mobile/           # React Native + Expo (in progress)
├── k8s/                  # Kubernetes manifests (Kustomize)
│   ├── base/             # Shared resources
│   ├── overlays/dev/     # Dev environment
│   └── overlays/prod/    # Prod environment
├── .github/workflows/
│   └── deploy.yml        # CI/CD pipeline
├── docker-compose.yml
├── turbo.json            # Turborepo config
├── pnpm-workspace.yaml
├── .npmrc
└── package.json
```

## CI/CD Pipeline

Automated via GitHub Actions (`.github/workflows/deploy.yml`).

**Trigger:** Push to `develop` deploys to dev. Push to `main` deploys to prod.

**Pipeline structure** (4 jobs):

```
setup → build-backend ─┐
                        ├→ deploy
setup → build-dashboard ┘
```

- **Runner:** `ubuntu-24.04-arm` (native ARM64 — no QEMU emulation needed)
- **Registry:** GitHub Container Registry (ghcr.io)
- Backend and dashboard images are built in parallel, then deployed together
- Images tagged with both `<env>-latest` (floating) and `<git-sha>` (immutable)
- Deployments use the SHA tag to ensure exact image pinning
- Registry layer caching enabled for faster rebuilds

**Required GitHub secrets:**
- `KUBECONFIG_DATA` — base64-encoded kubeconfig for the cluster
- `VITE_API_URL_DEV` — e.g. `https://dev-api.shuntwizard.com` (baked into dashboard JS bundle)
- `VITE_API_URL_PROD` — e.g. `https://api.shuntwizard.com`

## Docker

### Backend (`packages/backend/Dockerfile`)

Multi-stage build with 4 stages:
1. **base** — `node:20-alpine` with pnpm@10.32.1 via corepack
2. **deps** — production dependencies only (`pnpm install --frozen-lockfile --prod --filter=backend`)
3. **build** — full install + `pnpm --filter=backend run build`
4. **production** — `node:20-alpine`, copies only `node_modules` from deps and `dist/` from build

Also includes a **development** stage used by docker-compose with volume mounts and hot reload.

### Dashboard (`packages/dashboard/Dockerfile`)

Two-stage build:
1. **build** — `node:20-alpine` with pnpm, installs deps, builds with `VITE_API_URL` baked in via build arg
2. **runtime** — `nginx:1.27-alpine`, serves the static SPA

### Build context

Both Dockerfiles use the repo root (`.`) as build context. The `.dockerignore` at repo root excludes `.git`, `node_modules`, mobile source code (but keeps `packages/mobile/package.json` for pnpm workspace resolution), docs, k8s manifests, and CI config.

## API Endpoints

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /auth/login | No | Login with study ID (participants) |
| POST | /auth/admin/login | No | Login with email/password (admins) |
| POST | /auth/refresh | No | Refresh access token (single-use rotation) |
| POST | /auth/logout | No | Revoke refresh token |

### Study Management (Admin only)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /study | Admin JWT | List all study IDs |
| POST | /study | Admin JWT | Create new study ID |
| GET | /study/:id | Admin JWT | Get study by ID |

### Recordings

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /recordings | JWT | List recordings (paginated) |
| POST | /recordings | Participant JWT | Save a recording reference |
| PATCH | /recordings/:id | JWT | Update a recording |

### S3

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /s3/presigned-upload-url | Participant JWT | Get presigned S3 upload URL |

## Testing the API

```bash
# Participant login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"studyId": "STUDY001"}'

# Admin login
curl -X POST http://localhost:3000/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "changeme"}'

# List studies (with admin token)
curl http://localhost:3000/study \
  -H "Authorization: Bearer <token>"
```

## Default Credentials (after seeding)

- **Admin**: admin@example.com / changeme
- **Study IDs**: STUDY001, STUDY002, STUDY003, TEST123

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm run dev:backend` | Start backend in dev mode (via Turborepo) |
| `pnpm run dev:dashboard` | Start dashboard dev server (via Turborepo) |
| `pnpm run dev:mobile` | Start mobile dev server (via Turborepo) |
| `pnpm run build` | Build all packages (via Turborepo) |
| `pnpm run build:backend` | Build backend only |
| `pnpm run build:dashboard` | Build dashboard only |
| `pnpm run seed` | Seed database (local) |
| `pnpm run test` | Run tests across all packages |
| `pnpm run lint` | Lint all packages |
| `pnpm run docker:up` | Start with Docker Compose |
| `pnpm run docker:up:build` | Rebuild and start with Docker |
| `pnpm run docker:down` | Stop Docker containers |
| `pnpm run docker:seed` | Seed database (Docker) |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| DATABASE_HOST | localhost | PostgreSQL host |
| DATABASE_PORT | 5432 | PostgreSQL port |
| DATABASE_USER | postgres | PostgreSQL user |
| DATABASE_PASSWORD | password | PostgreSQL password |
| DATABASE_NAME | shunt_wizzard | Database name |
| JWT_SECRET | - | Secret for signing JWTs |
| JWT_ACCESS_EXPIRATION | 15m | Access token expiration |
| S3_STORAGE_BUCKET_NAME | - | Scaleway S3 bucket name |
| S3_STORAGE_ACCESS_KEY | - | Scaleway S3 access key |
| S3_STORAGE_SECRET_KEY | - | Scaleway S3 secret key |
| VITE_API_URL | http://localhost:3000 | API URL baked into dashboard at build time |

## Infrastructure

See `docs/cluster.md` for full cluster documentation including traffic flow, TLS certificates, recovery procedures, and production deployment checklist.
