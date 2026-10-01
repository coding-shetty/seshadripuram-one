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
- [Authentication Architecture](#-authentication-architecture)
- [Role-Based Access Control](#-role-based-access-control)
- [Security Principles](#️-security-principles)
- [OTP Security](#-otp-security)
- [Database](#️-database)
- [Project Structure](#-project-structure)
- [Authentication API](#-authentication-api)
- [Deployment Architecture](#-deployment-architecture)
- [Environment Configuration](#-environment-configuration)
- [Testing](#-testing)
- [Local Development](#️-local-development)
- [Roadmap](#️-roadmap)
- [Project Maturity](#-project-maturity)
- [Current Limitations](#️-current-limitations)
- [Security Policy](#-security)
- [Development Philosophy](#-development-philosophy)
- [Project Status](#-project-status)
---
 
## ✨ Vision
 
College communication today is often spread across:
 
- WhatsApp groups
- PDFs
- Spreadsheets
- Notice boards
- Separate attendance systems
- Disconnected portals
- Personal messages between students and staff
**Seshadripuram One** brings all of these academic workflows into a single, secure platform.
 
> ### One app. One identity. One academic ecosystem.
 
---
 
## 🚀 Current Status
 
The project is currently in **Phase 3 — Authentication & Authorization Foundation**.
 
<table>
<tr><td>
- 🔐 Secure account activation
- 📱 OTP verification architecture
- 🎫 JWT access-token authentication
- 🔄 Rotating refresh sessions
- 👨‍🎓 Student role handling
- 👨‍🏫 Teacher role handling
</td><td>
- 🛡️ Admin role foundation
- 🔒 Server-side authorization
- 🗄️ Turso + Drizzle database foundation
- 📦 Database migrations
- 🔑 Secure Flutter token storage
- 🧪 Backend & Flutter authentication tests
</td></tr>
</table>
> **Note:** This is an actively developed project. Academic modules such as attendance, marks, assignments, notes, timetable, and announcements are planned for subsequent phases.
 
---
 
## 🏗️ Architecture
 
```text
                    ┌─────────────────────────┐
                    │     Seshadripuram One   │
                    │      Flutter Client     │
                    └────────────┬────────────┘
                                 │
                                 │ HTTPS / REST API
                                 ▼
                    ┌─────────────────────────┐
                    │      Express Backend    │
                    │        TypeScript       │
                    └────────────┬────────────┘
                                 │
                ┌────────────────┼────────────────┐
                │                │                │
                ▼                ▼                ▼
        ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
        │ Authentication│ │ Authorization│ │   Services   │
        │     / OTP     │ │  JWT / Roles │ │ OTP / Tokens │
        └──────────────┘ └──────────────┘ └──────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │      Drizzle ORM        │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │       Turso / libSQL     │
                    └─────────────────────────┘
```
 
---
 
## 🛠️ Technology Stack
 
### Frontend
 
| Technology | Purpose |
|---|---|
| Flutter | Cross-platform application |
| Dart | Application language |
| Riverpod | State management |
| GoRouter | Navigation |
| Dio | HTTP networking |
| Flutter Secure Storage | Token/session storage |
 
### Backend
 
| Technology | Purpose |
|---|---|
| Node.js | Backend runtime |
| Express | REST API |
| TypeScript | Backend language |
| Drizzle ORM | Database access |
| Turso / libSQL | Production database |
| bcrypt | Password hashing |
| JWT | Access authentication |
| Crypto-secure OTP | Account verification |
 
### DevOps
 
| Technology | Purpose |
|---|---|
| Git | Version control |
| GitHub | Source control & collaboration |
| Codemagic | Flutter CI/CD |
| Environment Variables | Secret/configuration management |
 
---
 
## 🔐 Authentication Architecture
 
Security is a core principle of Seshadripuram One. Users **do not** freely choose whether they are a student or teacher — the backend determines identity and role from the authoritative college records.
 
### Account Activation
 
```text
User
 │
 │ College / Institution ID
 ▼
Backend
 │
 │ Search authoritative database
 ▼
┌──────────────────────────┐
│ Student / Teacher record │
└────────────┬─────────────┘
             │
             │ Valid + Active
             ▼
        OTP Request
             │
             ▼
      Verified Contact
             │
             ▼
        Enter OTP
             │
             ▼
      OTP Verification
             │
             ▼
     Activation Grant
             │
             ▼
       Set Password
             │
             ▼
       Account Active
```
 
### Subsequent Login
 
```text
College ID + Password
          │
          ▼
       Backend
          │
          ▼
     Authentication
          │
          ▼
   Access JWT + Refresh
          │
          ▼
     Authenticated App
```
 
---
 
## 👥 Role-Based Access Control
 
Seshadripuram One enforces **server-side** role authorization — the client never decides permissions.
 
<details open>
<summary><b>👨‍🎓 Student</b></summary>
Students will eventually be able to access:
 
- Announcements & class updates
- Timetable
- Attendance (overall & subject-wise) and absence history
- Internal examination marks, SIM examination marks, project marks
- Assignments & assignment attachments
- Notes & study materials
- Teacher updates
Students **cannot** modify protected academic information.
</details>
<details>
<summary><b>👨‍🏫 Teacher</b></summary>
Teachers will eventually be able to:
 
- Publish announcements & class updates
- Upload notes and academic materials
- Create assignments and upload attachments
- Enter and update attendance
- Enter and update internal marks, SIM examination marks, project marks
- Communicate academic information
Teacher permissions are enforced entirely by the backend.
</details>
<details>
<summary><b>👑 Administrator</b></summary>
Administrators will manage controlled institutional data such as:
 
- Students, teachers, departments, subjects, sections
- Academic years and semesters
- Initial data imports
Admin registration is **not** publicly available.
</details>
---
 
## 🛡️ Security Principles
 
The Flutter application is treated as an **untrusted client**. The backend never blindly trusts values supplied by the app — it independently determines:
 
- User identity
- Role
- Institution ID
- Department & section
- Permissions
- Resource ownership
This design prevents attacks such as:
 
```text
Student → Change role → Teacher                    ❌
Student → Modify another student's marks            ❌
Student → Modify attendance                          ❌
User    → Activate unknown institution ID            ❌
```
 
Authorization is enforced on the backend rather than relying on Flutter navigation guards.
 
---
 
## 🔑 OTP Security
 
- Cryptographically secure OTP generation
- Hashed OTP storage
- Expiration & one-time use
- Verification attempt limits
- OTP invalidation after use
- Request rate limiting
- Development-only OTP delivery abstraction (production SMS/email provider to be connected later)
> OTP values are never intended to be stored in the Flutter application.
 
---
 
## 🗄️ Database
 
Built on **Turso + libSQL + Drizzle ORM**, with a schema covering:
 
`Users` · `Students` · `Teachers` · `Departments` · `Courses` · `Subjects` · `Academic Years` · `Semesters` · `Sections` · `Enrollments` · `Timetable` · `Attendance` · `Attendance Records` · `Announcements` · `Notes` · `Assignments` · `Assignment Submissions` · `Internal Marks` · `SIM Examination Marks` · `Project Marks` · `Audit Logs` · `Authentication Sessions` · `Activation Grants`
 
The schema will continue to evolve as each academic feature is implemented.
 
---
 
## 📁 Project Structure
 
```text
seshadripuram_one/
│
├── android/ ios/ linux/ macos/ windows/ web/
│
├── lib/
│   ├── core/
│   │   ├── api/
│   │   ├── config/
│   │   ├── router/
│   │   ├── storage/
│   │   ├── theme/
│   │   └── utils/
│   │
│   └── features/
│       ├── auth/
│       │   ├── data/
│       │   ├── domain/
│       │   └── presentation/
│       ├── student/dashboard/
│       ├── teacher/dashboard/
│       └── admin/dashboard/
│
├── backend/
│   ├── src/
│   │   ├── config.ts
│   │   ├── index.ts
│   │   ├── db/
│   │   │   ├── index.ts
│   │   │   ├── schema.ts
│   │   │   ├── seed.ts
│   │   │   └── migrations/
│   │   ├── middleware/
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   └── academic.ts
│   │   └── services/
│   │       ├── otpService.ts
│   │       └── tokenService.ts
│   ├── test/
│   ├── package.json
│   ├── drizzle.config.ts
│   └── tsconfig.json
│
├── test/
├── codemagic.yaml
├── pubspec.yaml
└── README.md
```
 
---
 
## 🔌 Authentication API
 
| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/auth/request-activation` | Start account activation |
| `POST` | `/api/auth/verify-otp` | Verify OTP |
| `POST` | `/api/auth/set-password` | Complete activation |
| `POST` | `/api/auth/login` | Authenticate |
| `POST` | `/api/auth/refresh` | Refresh session |
| `POST` | `/api/auth/logout` | End session |
| `GET` | `/api/auth/me` | Get authenticated user |
| `POST` | `/api/academic/attendance` | Authorization boundary |
 
> The academic attendance endpoint is currently an authorization foundation and is intentionally not yet a complete attendance feature.
 
---
 
## 🌎 Deployment Architecture
 
The frontend and backend are designed to deploy independently:
 
```text
Flutter App
     │
     │ API_BASE_URL
     ▼
Cloud Backend
     │
     ▼
Turso Database
```
 
The project does **not** assume ownership of a custom domain — the backend can initially use a platform-provided deployment URL:
 
```env
API_BASE_URL=https://<deployed-backend-url>
```
 
A custom domain can be introduced later without changing the application architecture.
 
---
 
## 🔐 Environment Configuration
 
Backend configuration is provided through environment variables:
 
```env
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
JWT_SECRET=
JWT_ISSUER=
JWT_AUDIENCE=
OTP_PROVIDER=
CORS_ORIGINS=
```
 
A template is provided at `backend/.env.example`.
 
> ⚠️ **Real credentials must never be committed to GitHub.**
 
---
 
## 🧪 Testing
 
**Backend**
 
```bash
cd backend
npm run typecheck
npm run lint
npm test
```
 
**Flutter**
 
```bash
flutter analyze
flutter test
```
 
Current Phase 3 verification covers:
 
- Unknown institution IDs
- Student & teacher role resolution
- OTP validation, expiration, reuse prevention, attempt limits
- Authentication & authorization boundaries
- JWT/session behavior
- Flutter authentication repository
---
 
## ⚙️ Local Development
 
**1. Clone**
 
```bash
git clone https://github.com/dikshith-shetty-3621/seshadripuram-one.git
cd seshadripuram-one
```
 
**2. Install Flutter dependencies**
 
```bash
flutter pub get
```
 
**3. Install backend dependencies**
 
```bash
cd backend
npm ci
```
 
**4. Configure environment**
 
```bash
cp .env.example .env
```
 
Then fill in the required variables.
 
**5. Set up the database**
 
```bash
npm run db:migrate   # run migrations
npm run db:seed       # optional development seed data
```
 
**6. Start the backend**
 
```bash
npm run dev
```
 
**7. Start the Flutter app**
 
From the project root:
 
```bash
# On physical device or desktop:
flutter run --dart-define=API_BASE_URL=http://localhost:3000

# On Android emulator (10.0.2.2 points to host localhost):
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000
```
 
Or against a deployed backend:
 
```bash
flutter run --dart-define=API_BASE_URL=https://<backend-url>
```
 
---
 
## 🛣️ Roadmap
 
- [x] **Phase 1 — Project Foundation**
  Flutter project, platform setup, base architecture, core structure, Git/GitHub setup
- [x] **Phase 2 — Architecture & Backend Foundation**
  Flutter feature architecture, backend foundation, Turso/Drizzle foundation, initial auth architecture
- [x] **Phase 3 — Authentication & Authorization** *(current)*
  OTP activation, secure authentication, JWT access tokens, refresh sessions, role-based authorization, secure token storage, auth testing, admin foundation
- [ ] **Phase 4 — Academic Core**
  Student & teacher dashboards, announcements, class updates, timetable, attendance, subject-wise attendance, absence history
- [ ] **Phase 5 — Academic Performance**
  Internal marks, SEM examination marks, project marks, performance overview
- [ ] **Phase 6 — Assignments & Learning**
  Assignments, submissions, notes, study materials, attachments, teacher uploads
- [ ] **Phase 7 — Communication**
  Teacher → student communication, class announcements, notifications, academic updates
- [ ] **Phase 8 — Administration**
  Admin dashboard, student/teacher import, CSV/JSON validation, department/subject/section management, academic year management, audit logs
- [ ] **Phase 9 — Production**
  Production backend deployment, Turso production database, OTP provider, production signing, release builds, monitoring, crash reporting, security hardening, CI/CD improvements
---
 
## 📊 Project Maturity
 
| Area | Status |
|---|---|
| Flutter architecture | 🟢 Foundation |
| Backend architecture | 🟢 Foundation |
| Database | 🟢 Foundation |
| Authentication | 🟢 Implemented foundation |
| OTP | 🟢 Implemented foundation |
| Authorization | 🟢 Implemented foundation |
| Student features | 🟡 Planned |
| Teacher features | 🟡 Planned |
| Admin features | 🟡 Foundation |
| Attendance | 🟡 Planned |
| Marks | 🟡 Planned |
| Assignments | 🟡 Planned |
| Notes | 🟡 Planned |
| Notifications | 🟡 Planned |
| Production OTP provider | 🔴 Not configured |
| Production deployment | 🔴 Pending |
 
---
 
## ⚠️ Current Limitations
 
Seshadripuram One is **not yet production-ready**. The following still require external configuration or future development:
 
- Production Turso database & credentials
- SMS/email OTP provider
- Backend cloud deployment
- Production application signing
- Complete academic modules
- Admin data import workflow
- Production monitoring
- Final security hardening
The current implementation intentionally focuses on building a secure foundation before implementing the complete academic platform.
 
---
 
## 🔒 Security
 
Security issues should **not** be publicly discussed through GitHub issues. If you discover a vulnerability, please report it privately to the project maintainer rather than publishing exploit details publicly.
 
Never commit the following to the repository:
 
- Database credentials
- JWT secrets
- OTP provider credentials
- API keys
- Personal student or teacher information
---
 
## 🤝 Development Philosophy
 
Seshadripuram One is being developed incrementally, prioritizing:
 
> **Security → Architecture → Testing → Features → Production**
 
rather than building a large UI first and adding security afterward. The goal is a platform that can eventually handle real institutional data safely and reliably.
 
---
 
## 📌 Project Status
 
| | |
|---|---|
| **Current phase** | Phase 3 — Authentication & Authorization Foundation |
| **Platform** | Flutter |
| **Backend** | Node.js + Express + TypeScript |
| **Database** | Turso / libSQL |
| **ORM** | Drizzle |
| **State management** | Riverpod |
| **CI/CD** | Codemagic |
| **Status** | 🚧 Active Development |
 
---
 
<div align="center">
### ⭐ If you find this project interesting
 
Seshadripuram One is being built as a long-term college technology platform, with the goal of making academic communication simpler, more organized, and more secure.
 
**One platform for the entire academic ecosystem.**
 
</div>
 
