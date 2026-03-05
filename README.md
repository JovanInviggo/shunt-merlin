# Shunt Wizard

Monorepo for the Shunt Wizard application with a NestJS backend API.

## Prerequisites

- Node.js >= 18
- Docker and Docker Compose (recommended) OR PostgreSQL installed locally

## Quick Start (Docker)

```bash
# Install dependencies
npm install

# Start PostgreSQL and backend with hot reload
npm run docker:up

# In another terminal, seed the database
npm run docker:seed

# Stop everything
npm run docker:down
```

The API will be available at `http://localhost:3000`.

## Quick Start (Local)

```bash
# Install dependencies
npm install

# Set up PostgreSQL database
createdb shunt_wizzard

# Configure environment
cp packages/backend/.env.example packages/backend/.env
# Edit .env with your database credentials

# Start development server
npm run start:dev

# Seed the database
npm run seed
```

## Project Structure

```
shunt-wizzard/
├── packages/
│   ├── backend/          # NestJS API
│   │   ├── src/
│   │   │   ├── auth/     # JWT authentication
│   │   │   ├── user/     # Admin user management
│   │   │   ├── study/     # Study ID management
│   │   │   ├── recording/ # Recording references
│   │   │   └── database/  # TypeORM config & seeds
│   │   └── Dockerfile
│   └── frontend/         # Placeholder for frontend
├── docker-compose.yml
└── package.json
```

## API Endpoints

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /auth/login | No | Login with study ID (participants) |
| POST | /auth/admin/login | No | Login with email/password (admins) |

### Study Management (Admin only)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | /study | Admin JWT | List all study IDs |
| POST | /study | Admin JWT | Create new study ID |
| GET | /study/:id | Admin JWT | Get study by ID |

### Recordings

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /recordings | Participant JWT | Save a recording reference |

## Testing the API

### Participant Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"studyId": "STUDY001"}'
```

### Admin Login
```bash
curl -X POST http://localhost:3000/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "changeme"}'
```

### List Studies (with admin token)
```bash
curl http://localhost:3000/study \
  -H "Authorization: Bearer <token>"
```

## Default Credentials (after seeding)

- **Admin**: admin@example.com / changeme
- **Study IDs**: STUDY001, STUDY002, STUDY003, TEST123

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Start backend in dev mode (local) |
| `npm run build` | Build backend |
| `npm run seed` | Seed database (local) |
| `npm run docker:up` | Start with Docker Compose |
| `npm run docker:up:build` | Rebuild and start with Docker |
| `npm run docker:down` | Stop Docker containers |
| `npm run docker:seed` | Seed database (Docker) |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| DATABASE_HOST | localhost | PostgreSQL host |
| DATABASE_PORT | 5432 | PostgreSQL port |
| DATABASE_USER | postgres | PostgreSQL user |
| DATABASE_PASSWORD | password | PostgreSQL password |
| DATABASE_NAME | shunt_wizzard | Database name |
| JWT_SECRET | - | Secret for signing JWTs |
| JWT_EXPIRATION | 7d | Token expiration time |
