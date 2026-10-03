<div align="center">
# 🎓 Seshadripuram One
 
**A unified digital platform for students, teachers, and administrators.**
 
Bringing academic communication, student information, and teacher workflows into one secure application — replacing scattered WhatsApp groups, PDFs, and disconnected systems with a single ecosystem.
 
[![Flutter](https://img.shields.io/badge/Flutter-3.x-02569B?logo=flutter&logoColor=white)](https://flutter.dev/)
[![Dart](https://img.shields.io/badge/Dart-3.x-0175C2?logo=dart&logoColor=white)](https://dart.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/Backend-TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Drizzle ORM](https://img.shields.io/badge/ORM-Drizzle-C5F74F)](https://orm.drizzle.team/)
[![Turso](https://img.shields.io/badge/Database-Turso-4FF8D2)](https://turso.tech/)
[![Riverpod](https://img.shields.io/badge/State-Riverpod-1389FD)](https://riverpod.dev/)
[![Dio](https://img.shields.io/badge/HTTP-Dio-0175C2)](https://pub.dev/packages/dio)
[![Codemagic](https://img.shields.io/badge/CI%2FCD-Codemagic-4A154B)](https://codemagic.io/)
[![Status](https://img.shields.io/badge/Status-Active%20Development-orange)](#-project-status)
 
</div>
---
 
## 📖 Table of Contents
 
- [Vision](#-vision)
- [Current Status](#-current-status)
- [Architecture](#️-architecture)
- [Technology Stack](#️-technology-stack)
- [Authentication & OTP Architecture](#-authentication--otp-architecture)
- [Role-Based Access Control & Tenant Scoping](#-role-based-access-control--tenant-scoping)
- [Security Principles](#️-security-principles)
- [Database Schema & Migrations](#️-database-schema--migrations)
- [API Reference](#-api-reference)
- [Project Structure](#-project-structure)
- [Environment Configuration](#-environment-configuration)
- [Testing & Quality Verification](#-testing--quality-verification)
- [Local Development](#️-local-development)
- [Android Emulator Setup](#-android-emulator-setup)
- [Roadmap & Maturity](#️-roadmap--maturity)
- [Security Policy](#-security)
---
 
## ✨ Vision
 
College communication today is often spread across:
 
- WhatsApp groups
- PDFs and printed circulars
- Spreadsheets
- Physical notice boards
- Standalone attendance systems
- Disconnected student portals
- Unofficial personal messages between students and faculty
 
**Seshadripuram One** unifies these academic workflows into a single, secure platform.
 
> ### One app. One identity. One academic ecosystem.
 
---
 
## 🚀 Current Status
 
The project has completed its **Core Authentication & Reliability Foundation** (Phase 3) along with foundational implementations for **Academic Data Scoping** (Phase 4) and **Administrative Bulk Imports** (Phase 8).
 
<table>
<tr><td>
<b>Implemented Backend Capabilities:</b><br>
- 🔐 Secure account activation (read-only until verified)<br>
- 📧 Multi-provider OTP delivery (Console log + Resend email)<br>
- 🎫 JWT access tokens (15m expiry) with rotatable refresh sessions (30d expiry)<br>
- 🏢 Strict multi-tenant data scoping across institutions & sections<br>
- 🛡️ Granular IP + Institution rate limiting for auth endpoints<br>
- 📥 Admin CSV/JSON import preview with DB conflict detection<br>
- 🔒 Atomic batch commits with immediate payload PII purging<br>
- 🛡️ Trusted proxy configuration and body size limits (32kb global, 5mb imports)
</td><td>
<b>Implemented Flutter Client Capabilities:</b><br>
- 🔄 Resilient AuthInterceptor (single in-flight 401 refresh queue & retry)<br>
- 🧭 Stable GoRouter navigation using reactive refreshListenable<br>
- 👤 Dynamic dashboards consuming real user profiles from <code>/api/auth/me</code><br>
- 🚪 Working logout flow (clears secure storage and invalidates server session)<br>
- 📅 Live timetable & announcements feeds scoped to student/faculty<br>
- 🏷️ Explicit Demo Data badges and banners on simulated preview screens<br>
- 📱 Debug cleartext network config for local Android emulator workflows
</td></tr>
</table>
 
---
 
## 🏗️ Architecture
 
```text
                    ┌─────────────────────────┐
                    │     Seshadripuram One   │
                    │   Flutter Client (App)  │
                    └────────────┬────────────┘
                                 │
                                 │ HTTPS / JSON REST API
                                 ▼
                    ┌─────────────────────────┐
                    │      Express Backend    │
                    │       (TypeScript)      │
                    └────────────┬────────────┘
                                 │
     ┌───────────────────────────┼───────────────────────────┐
     │                           │                           │
     ▼                           ▼                           ▼
┌──────────────┐          ┌──────────────┐            ┌──────────────┐
│  Auth Router │          │Academic Router│           │ Admin Router │
│  Rate Limits │          │Tenant Scoping│            │Import Purging│
└──────┬───────┘          └──────┬───────┘            └──────┬───────┘
       │                         │                           │
       └─────────────────────────┼───────────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │       Drizzle ORM       │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │      Turso / libSQL     │
                    └─────────────────────────┘
```
 
---
 
## 🛠️ Technology Stack
 
### Frontend
 
| Technology | Version / Purpose |
|---|---|
| Flutter | Cross-platform mobile framework (SDK ^3.12.2) |
| Dart | Language runtime |
| Riverpod | Reactive state management (`flutter_riverpod: ^3.4.2`) |
| GoRouter | Declarative routing with `refreshListenable` (`go_router: ^17.4.0`) |
| Dio | HTTP client with queued refresh interceptor (`dio: ^5.11.0`) |
| Flutter Secure Storage | Hardware-backed encrypted key/token storage (`^11.0.0`) |
 
### Backend
 
| Technology | Version / Purpose |
|---|---|
| Node.js / Express | Server runtime with Express 5 (`express: ^5.2.1`) |
| TypeScript | Strongly-typed service and route implementation (`typescript: ^5.9.3`) |
| Drizzle ORM | Type-safe SQL ORM and schema migration manager (`drizzle-orm: ^0.45.2`) |
| Turso / libSQL | Edge SQLite database engine (`@libsql/client: ^0.17.4`) |
| Zod | Request body and query parameter schema validation (`zod: ^4.6.5`) |
| express-rate-limit | Granular IP + institution-keyed rate limiters (`^8.6.2`) |
| bcrypt | Adaptive password hashing with work factor 12 (`bcrypt: ^6.0.0`) |
| jsonwebtoken | Cryptographic JWT access & refresh token signing (`^9.0.3`) |
| Resend | Production transactional email delivery for verification OTPs |
 
---
 
## 🔐 Authentication & OTP Architecture
 
Security is a core design principle: users **do not** freely pick their role or institute. Identity is strictly matched against authoritative institution records pre-loaded by administrators.
 
### Account Activation Workflow
 
```text
Client                              Backend / DB                         Email / Console
  │                                      │                                      │
  │── 1. POST /request-activation ───────▶│                                      │
  │      { institutionId }               │── Match student/teacher record       │
  │                                      │   (Read-only: creates no users)      │
  │                                      │── Generate 6-digit cryptographic OTP │
  │                                      │── Dispatch OTP ─────────────────────▶│
  │◀── 200 OK (OTP Sent) ────────────────│                                      │
  │                                      │                                      │
  │── 2. POST /verify-otp ───────────────▶│                                      │
  │      { institutionId, otp }          │── Verify hashed OTP & attempt limit  │
  │                                      │── Provision user & link profile      │
  │                                      │── Issue single-use Activation Grant  │
  │◀── 200 OK { activationGrant } ───────│                                      │
  │                                      │                                      │
  │── 3. POST /set-password ─────────────▶│                                      │
  │      { grant, password }             │── Verify grant & hash password       │
  │◀── 200 OK (Account Activated) ───────│                                      │
```
 
### Subsequent Login & Session Lifecycle
 
1. **Login:** `POST /api/auth/login` accepts `institutionId` and `password`. Returns short-lived JWT `accessToken` (15 minutes), long-lived `refreshToken` (30 days), and the user's role profile.
2. **Access:** Client includes `Authorization: Bearer <accessToken>` in all API requests.
3. **Automatic Refresh:** When an access token expires (HTTP 401), the Flutter `AuthInterceptor` holds concurrent requests, issues a single call to `POST /api/auth/refresh`, updates local secure storage, and retries the original requests.
4. **Logout:** `POST /api/auth/logout` invalidates the server-side refresh session, wipes secure storage, and returns the app to the login screen.
 
---
 
## 👥 Role-Based Access Control & Tenant Scoping
 
Every academic query and mutation is strictly filtered by the caller's verified institution ID and role:
 
- **👨‍🎓 Student:** Can read only their own institution's announcements, their enrolled section's timetable, and their own academic records. Cannot publish announcements or modify attendance.
- **👨‍🏫 Teacher:** Can read and publish announcements for their institution/department, view timetables for sections they teach, and mark attendance for their assigned classes.
- **👑 Administrator:** Manages institution-wide configuration, reviews audit logs, executes bulk student/teacher imports, and manages academic departments.
 
---
 
## 🗄️ Database Schema & Migrations
 
Managed with **Drizzle ORM** across 7 schema migrations:
 
- **Identity & Auth:** `users`, `students`, `teachers`, `auth_sessions`, `otps`, `activation_grants`
- **Institution Structure:** `institutions`, `departments`, `programs`, `courses`, `academic_years`, `semesters`, `sections`
- **Academic Operations:** `enrollments`, `subject_offerings`, `teaching_assignments`, `timetable_entries`, `announcements`, `attendance_sessions`, `attendance_records`
- **Data Imports & Retention:** `import_jobs` (tracks entity imports, preview validation, conflict reports, and PII purge timestamps)
 
---
 
## 🔌 API Reference
 
All endpoints enforce strict Zod schema validation on request payloads and query parameters.
 
### Authentication (`/api/auth`)
 
| Method | Endpoint | Rate Limit | Description |
|---|---|---|---|
| `POST` | `/api/auth/request-activation` | 5 req / 15m (IP + Inst) | Starts activation; generates & dispatches 6-digit OTP (Console or Resend). |
| `POST` | `/api/auth/verify-otp` | 10 req / 15m (IP + Inst) | Verifies OTP (max 5 attempts); provisions user row and returns activation grant. |
| `POST` | `/api/auth/set-password` | Standard | Consumes activation grant and securely hashes password (min 12 chars). |
| `POST` | `/api/auth/login` | 10 req / 15m (Account) | Validates credentials; returns access JWT, refresh token, and user profile. |
| `POST` | `/api/auth/refresh` | 60 req / 15m | Rotates refresh session; returns new access JWT and new refresh token. |
| `POST` | `/api/auth/logout` | Standard | Invalidate refresh token session on the server and clears active auth session. |
| `GET` | `/api/auth/me` | 120 req / 15m | Returns authenticated caller's profile with real display name and verified role. |
 
### Academic Feeds (`/api/academic`)
 
| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `GET` | `/api/academic/announcements` | Student, Teacher, Admin | Fetches announcements scoped to caller's institution, role, and department. |
| `POST` | `/api/academic/announcements` | Teacher, Admin | Publishes an announcement scoped to caller's institution. |
| `GET` | `/api/academic/timetable` | Student, Teacher, Admin | Returns schedule scoped to caller's institution and class section or teacher assignment. |
| `POST` | `/api/academic/attendance` | Teacher, Admin | Submits attendance session records for an assigned section offering. |
 
### Administration & Data Import (`/api/admin`)
 
| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `POST` | `/api/admin/imports/preview` | Admin | Ingests up to 5MB CSV/JSON data (`institutions`, `students`, `teachers`); validates schema and reports DB conflicts before commit. |
| `POST` | `/api/admin/imports/:id/commit` | Admin | Executes atomic all-or-nothing database commit and immediately purges raw payload PII. |
| `GET` | `/api/admin/imports/:id` | Admin | Fetches import job status, summary counters, and error diagnostics. |
 
### Operational Endpoints
 
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Liveness health check returning `{ status: "ok" }`. |
| `GET` | `/ready` | Readiness check verifying active database connection. |
 
---
 
## 📁 Project Structure
 
```text
seshadripuram_one/
├── lib/
│   ├── core/
│   │   ├── api/             # Dio client & AuthInterceptor (401 refresh queue)
│   │   ├── config/          # AppConfig & environment flags
│   │   ├── router/          # GoRouter configuration & RouterAuthListenable
│   │   ├── session/         # SessionExpiredNotifier
│   │   ├── storage/         # SecureStorageService (flutter_secure_storage)
│   │   ├── theme/           # AppColors, AppTypography, design tokens
│   │   └── widgets/         # DashboardShell, DemoDataBanner, DemoFeatureScreen
│   └── features/
│       ├── auth/            # Login screen, AuthRepository, auth Riverpod providers
│       ├── academic/        # Live Timetable & Announcements widgets & screens
│       ├── student/         # Student dashboard screen
│       ├── teacher/         # Teacher dashboard screen
│       └── admin/           # Admin dashboard & AdminImportScreen
├── backend/
│   ├── src/
│   │   ├── config.ts        # Environment & rate-limiting configuration
│   │   ├── index.ts         # Express application factory, middleware, proxy config
│   │   ├── db/              # Drizzle schema definitions, database connection, seed
│   │   ├── middleware/      # Authentication & role guard middleware
│   │   ├── routes/          # auth.ts, academic.ts, admin.ts route handlers
│   │   ├── services/        # otpService, tokenService, importRetention
│   │   └── scripts/         # cleanupImports CLI retention task
│   └── test/                # Vitest test suites (26 integration tests)
├── test/                    # Flutter test suites (8 unit & widget tests)
├── codemagic.yaml           # CI/CD verification workflows
└── pubspec.yaml             # Flutter dependencies
```
 
---
 
## 🔐 Environment Configuration
 
Configure backend settings in `backend/.env`:
 
```env
# Database (Turso libSQL or local file)
TURSO_DATABASE_URL=file:./dev.db
TURSO_AUTH_TOKEN=
 
# Security & JWT
JWT_SECRET=your-secure-random-jwt-secret-min-32-chars
JWT_ISSUER=seshadripuram-one
JWT_AUDIENCE=seshadripuram-one-app
TRUST_PROXY=false
 
# OTP Configuration ('console' for local dev, 'resend' for email delivery)
OTP_PROVIDER=console
RESEND_API_KEY=
EMAIL_FROM=noreply@yourdomain.com
 
# Client CORS Origins
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
 
# Optional Rate-Limiting Overrides
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_LOGIN_ACCOUNT_MAX=10
RATE_LIMIT_ACTIVATION_MAX=5
```
 
---
 
## 🧪 Testing & Quality Verification
 
### Backend Test Suite (Vitest)
 
Run typecheck, linting, and automated integration tests:
 
```bash
cd backend
npm run typecheck
npm run lint
npm test
```
 
Coverage includes 26 passing tests across 5 test suites:
- `auth.test.ts` (9 tests): Activation flow, OTP expiration/limits, read-only activation, display names, JWT sessions, role access.
- `reliability.test.ts` (5 tests): Granular rate limiters, proxy header handling, payload limits (32kb / 5mb), malformed JSON.
- `academic_read.test.ts` (4 tests): Scoped timetable and announcements isolation across institutions and sections.
- `admin_import.test.ts` (7 tests): Import preview duplicate checking, atomic commit rollback, FAILED status reporting, and immediate payload purging.
- `academic_schema.test.ts` (1 test): Drizzle database migration integrity.
 
### Flutter Client Test Suite
 
Run static analysis and unit/widget tests:
 
```bash
flutter analyze
flutter test
```
 
Coverage includes 8 passing tests across 4 test suites:
- `auth_interceptor_test.dart` (3 tests): Single in-flight 401 token refresh queue, request retrying with updated token, session cleanup on failure, and concurrent request coalescing.
- `app_router_test.dart` (1 test): Verifies `GoRouter` instance remains stable across auth state emissions without recreation.
- `dashboard_user_logout_test.dart` (1 test): Verifies real user name rendering on dashboards and working logout flow.
- `auth_repository_test.dart` (2 tests): Role resolution on login and API error handling.
 
---
 
## ⚙️ Local Development
 
**1. Clone the repository**
 
```bash
git clone https://github.com/coding-shetty/seshadripuram-one.git
cd seshadripuram-one
```
 
**2. Setup backend**
 
```bash
cd backend
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed    # Optional: Populates initial sample records
npm run dev        # Starts Express server on http://localhost:3000
```
 
**3. Setup Flutter app**
 
```bash
# From project root
flutter pub get
flutter run --dart-define=API_BASE_URL=http://localhost:3000
```
 
---
 
## 📱 Android Emulator Setup
 
When running the Flutter app inside an Android emulator:
 
1. **Host Loopback Address:** The Android emulator runs in an isolated virtual network. `http://localhost:3000` refers to the emulator itself. To connect to the Express backend running on your development host machine, use:
   ```bash
   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000
   ```
2. **Cleartext HTTP:** Android 9+ (API 28+) blocks unencrypted HTTP traffic by default. The debug Android manifest (`android/app/src/debug/AndroidManifest.xml`) is configured with `android:usesCleartextTraffic="true"` to permit local development traffic to `http://10.0.2.2:3000` without requiring TLS certificates.
 
---
 
## 🛣️ Roadmap & Maturity
 
| Phase | Focus Area | Status |
|---|---|---|
| Phase 1 | Project foundation, multi-platform setup, Git structure | 🟢 Completed |
| Phase 2 | Architecture foundation, Drizzle schema, Turso integration | 🟢 Completed |
| Phase 3 | Authentication, OTP verification, JWT sessions, rate limiting | 🟢 Completed |
| Phase 4 | Academic Core (Scoped Timetables, Scoped Announcements) | 🟡 In Progress |
| Phase 5 | Academic Performance (Internal marks, SEM marks, analytics) | ⚪ Planned |
| Phase 6 | Assignments & Courseware (Submissions, study materials) | ⚪ Planned |
| Phase 7 | Communication (Class notices, teacher broadcasts, notifications) | ⚪ Planned |
| Phase 8 | Administration (Bulk CSV/JSON import pipeline, audit logs) | 🟡 Foundation Completed |
| Phase 9 | Production Deployment (Cloud deployment, production signing) | ⚪ Planned |
 
---
 
## 🔒 Security
 
If you discover a security vulnerability, please report it privately to the repository maintainer. Never commit credentials, JWT secrets, database connection tokens, or real student PII to GitHub.
