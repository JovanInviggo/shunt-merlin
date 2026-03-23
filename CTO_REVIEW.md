# CTO Code Review — Shunt Wizard

> Generated: 2026-03-03

## Project Overview

**Tech Stack:**
- **Backend:** NestJS 11, TypeORM 0.3, PostgreSQL 16, `passport-jwt`, AWS SDK v3 (S3), bcrypt
- **Dashboard:** React 18, Vite 5, React Router v6, TanStack Query v5, Tailwind CSS v3, shadcn/ui (Radix), react-hook-form, Zod, custom i18n
- **Mobile:** Declared in monorepo, directory exists but is completely empty
- **Auth:** Dual-flow JWT — participant tokens (studyId-based) and admin tokens (email/password)
- **Infra:** Docker Compose (postgres + backend), EAS configured for Android

**Architecture:** Feature-based monorepo (npm workspaces). Layered NestJS modules (entity → service → controller), React pages with custom hooks + centralized API client.

---

## 🔴 CRITICAL (Fix before shipping)

- [x] **1. CORS completely open**
  - `packages/backend/src/main.ts:16` — `app.enableCors()` with no origin restriction
  - Any origin can make credentialed requests. For a medical app this is unacceptable.
  - Fix: pass `{ origin: process.env.ALLOWED_ORIGINS?.split(',') }` and lock down methods/credentials.

- [x] **2. Weak / hardcoded JWT secret**
  - `docker-compose.yml:30`, `packages/backend/.env:6`, `packages/backend/src/auth/auth.module.ts:19`, `packages/backend/src/auth/jwt.strategy.ts:24`
  - The fallback `'default-secret'` means if `JWT_SECRET` is unset anyone can forge admin tokens.
  - Fix: replace `configService.get('JWT_SECRET', 'default-secret')` with `configService.getOrThrow('JWT_SECRET')` in both places. Generate a real secret with `openssl rand -base64 64`.

- [x] **3. No rate limiting on auth endpoints**
  - `packages/backend/src/auth/auth.controller.ts`
  - `POST /auth/login` and `POST /auth/admin/login` have no throttling — brute-force is trivial.
  - Fix: install `@nestjs/throttler`, apply globally, tighten on auth routes (e.g. 5 req/min).

- [x] **4. Participant can create recordings for any studyId (authorization bypass)**
  - `packages/backend/src/recording/recording.controller.ts:19-22`
  - The `studyId` comes from the request body; the authenticated user's token is ignored entirely.
  - Fix: extract `studyId` from `req.user.studyId` and reject requests where `dto.studyId !== req.user.studyId`.

- [x] **5. S3 key has no uniqueness — files overwrite each other**
  - `packages/backend/src/s3/s3.service.ts:27` — `Key: studyId`
  - Every upload for the same study overwrites the previous recording. Silent data loss.
  - Fix: `Key: \`recordings/${studyId}/${Date.now()}-${randomUUID()}.webm\`` and return the key alongside the presigned URL.

- [x] **6. `synchronize: true` has no production guard**
  - `packages/backend/src/database/database.module.ts:18`
  - TypeORM auto-sync can DROP columns in production. The comment acknowledges this but there is no code guard.
  - Fix: `synchronize: configService.get('NODE_ENV') !== 'production'` and add migrations.

- [ ] **7. No AWS credentials in docker-compose — backend crashes on startup**
  - `docker-compose.yml` has no `AWS_BUCKET_NAME`, `AWS_S3_REGION`, `AWS_ACCESS_KEY_ID`, or `AWS_SECRET_ACCESS_KEY`.
  - `S3Service` calls `getOrThrow()` for these — the service will throw on initialization.
  - Fix: add the AWS vars to docker-compose (use LocalStack or a dev bucket for local development).

---

## 🟠 HIGH (Fix in next sprint)

- [x] **8. Seed script logs admin password in plaintext**
  - `packages/backend/src/database/seeds/study.seed.ts:44`
  - `console.log('Created admin user: admin@example.com / changeme')` ends up in container logs.
  - Fix: remove the password from the log message.

- [x] **9. S3 controller logs participant PII to console**
  - `packages/backend/src/s3/s3.controller.ts:12` — `console.log((request as any).user.studyId)`
  - Debug artifact leaking pseudonymous patient identifiers into log aggregation.
  - Fix: remove entirely.

- [x] **10. JWT lifespan 7 days, no refresh, no revocation**
  - `packages/backend/src/auth/auth.module.ts:19`
  - A stolen token is valid for a week with no way to invalidate it.
  - Fix: reduce participant token to 1 hour, implement refresh token flow.

- [ ] **11. PatientDetail page is entirely mock data — not wired to API**
  - `packages/dashboard/src/pages/PatientDetail.tsx:19-108`
  - `useParams().id` is read but never used. All data is hardcoded constants. All state (notes, classifications, tags) is lost on refresh.
  - Fix: fetch real patient + recordings by ID; persist mutations via API calls.

- [ ] **12. "Add Patient" button does nothing**
  - `packages/dashboard/src/pages/Patients.tsx:54-56`
  - `handleAddPatient` just logs to console and closes the dialog. The `POST /study` endpoint exists but is never called.
  - Fix: call `createStudy(newPatient.studyId)` and invalidate the `studies` query on success.

- [ ] **13. TypeScript effectively disabled in dashboard**
  - `packages/dashboard/tsconfig.json` — `noImplicitAny: false`, `strictNullChecks: false`, `noUnusedLocals: false`, `noUnusedParameters: false`
  - ESLint: `@typescript-eslint/no-unused-vars: off`
  - Fix: enable `"strict": true`, remove overrides, fix resulting errors.

- [ ] **14. Classification state uses integer keys but API returns UUID strings**
  - `packages/dashboard/src/pages/Home.tsx:38-44`
  - State initialized with `{ 1: "normal", 2: "normal" ... }` but recording IDs are UUIDs. State never matches real data — all UI interactions are phantoms.
  - Fix: initialize state empty `{}` and key by the string UUID from the API response.

---

## 🟡 MEDIUM (Improve soon)

- [ ] **15. No pagination on recordings/studies endpoints**
  - `packages/backend/src/recording/recording.service.ts:22`, `packages/backend/src/study/study.service.ts:22`
  - `findAll()` returns the entire table. Will become a memory/performance problem as data grows.
  - Fix: add `take`/`skip` TypeORM pagination and pass `page`/`limit` from the controller.

- [ ] **16. `any` type cast on request object in controllers**
  - `packages/backend/src/s3/s3.controller.ts:13`, `packages/backend/src/recording/recording.controller.ts:12`
  - Fix: create a typed `RequestWithUser` interface or a `@CurrentUser()` param decorator.

- [ ] **17. Recording entity uses natural key as FK instead of UUID**
  - `packages/backend/src/recording/recording.entity.ts:23-25`
  - `@JoinColumn({ name: 'studyId', referencedColumnName: 'studyId' })` joins on the human-readable string, not the UUID PK. Referential integrity is not reliably enforced.
  - Fix: add a `studyDbId` UUID FK column and join on `study.id`.

- [ ] **18. i18n template interpolation is not implemented**
  - `packages/dashboard/src/i18n.tsx:289-293`
  - The `t()` function does no string interpolation. The key `patientDetail.toast.fieldSaved` contains `{{field}}` which is returned literally to the user.
  - Fix: add basic interpolation: `value.replace(/\{\{(\w+)\}\}/g, (_, k) => vars?.[k] ?? '')`.

- [ ] **19. PatientDetail is a god component (~800+ lines)**
  - `packages/dashboard/src/pages/PatientDetail.tsx`
  - Handles routing, audio playback simulation, tag management, field editing with undo, classification, flag state, and three info sections all in one file.
  - Fix: extract `AudioPlayer`, `RecordingCard`, `PatientInfoPanel`, `NephrologistPanel`, `ShuntPanel` as separate components.

- [ ] **20. Hardcoded German strings in JSX bypassing i18n**
  - `packages/dashboard/src/pages/Home.tsx:529-536` — `"AVF - Linker Arm"`, `"Linker Unterarm"`, `"2024-03-15"` hardcoded.
  - Fix: these should come from real API data, not hardcoded mock strings.

- [ ] **21. Language preference not persisted across page refreshes**
  - `packages/dashboard/src/i18n.tsx:287` — always initializes to `"de"`.
  - Fix: `useState<Language>(() => (localStorage.getItem('lang') as Language) ?? 'de')` and persist on change.

- [ ] **22. `onKeyPress` is deprecated**
  - `packages/dashboard/src/pages/Home.tsx:494`
  - Fix: replace with `onKeyDown`.

- [ ] **23. Patients table always shows "Active" badge regardless of status**
  - `packages/dashboard/src/pages/Patients.tsx:299`
  - `patient.status` is computed correctly but the badge always renders the "active" translation key.
  - Fix: conditionally render badge based on `patient.status`.

- [ ] **24. No rate limiting on presigned URL endpoint**
  - `packages/backend/src/s3/s3.controller.ts` — `GET /s3/presigned-upload-url` with no throttle.
  - An authenticated participant can spam this to drive up AWS costs.
  - Fix: apply a per-user throttle (e.g. 10 req/min).

---

## 🟢 LOW / SUGGESTIONS

- [ ] `getInitials()` is duplicated in `Home.tsx:26` and `PatientDetail.tsx:42` — extract to `lib/utils.ts`
- [ ] `home.newRecordings.title` i18n key hardcodes "4" — make the count dynamic
- [x] Add Swagger/OpenAPI documentation to the backend (`@nestjs/swagger`)
- [ ] Remove `ports: 5432:5432` from postgres in docker-compose for production builds
- [ ] Remove unused `multer` and `@types/multer` dependencies from the backend
- [ ] Add audit logging (who accessed/modified which patient record and when)
- [ ] Configure `QueryClient` with `staleTime` and `retry` in the dashboard — default 3 retries causes cascading failures on 401s
- [ ] Evaluate whether `lovable-tagger` (AI codegen platform tool) belongs in a production dependency tree
- [ ] Remove or complete the empty `packages/mobile` directory — it causes confusion in the monorepo

---

## ✅ WHAT'S DONE WELL

1. **Dual-token auth architecture is clean** — `JwtPayload` type discrimination in `jwt.strategy.ts` and `RolesGuard` rejecting non-admin tokens is solid foundational design.
2. **DTO validation is consistent** — All endpoints use `class-validator` with `whitelist: true` and `forbidNonWhitelisted: true` globally — correct production configuration.
3. **API layer is centralized in the dashboard** — `lib/api.ts` handles all fetch logic, auth headers, and 401 redirect in one place with a typed `apiFetch<T>` generic.
4. **React Query usage is correct** — `useStudies`/`useRecordings` are clean minimal hooks; loading and error states are handled at the page level.
5. **bcrypt with 10 rounds, no timing vulnerabilities** — `validatePassword` uses `bcrypt.compare` correctly with no short-circuit comparisons.
