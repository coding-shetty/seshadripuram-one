# Fix audit — 4 October 2026

This branch is a hardening change, **not a certification of 100% production readiness**.
Do not deploy official records until the deployment gates below are signed off.

## Completed in this change

1. Attendance reads always intersect optional filters with the teacher's assigned
   sections. Teachers with no assignments receive no records. Administrative
   rosters, attendance reads and writes are college-scoped. Writes validate active
   enrollment, subject assignments, duplicate students, and calendar dates.
2. Added explicit `users.college_id`. The legacy `institution_id` remains the
   **login identifier**, not a college ID. Admin stats, structure and audit queries
   are scoped to current membership. Imported accounts inherit that membership;
   import jobs carry immutable college scope. Unassigned administrators fail closed.
3. Protected routes check current account status, role and profile activity instead
   of trusting an old JWT alone. OTP/grant/refresh consumption uses conditional
   database writes. Passwords cannot exceed bcrypt's 72-byte input boundary.
4. Authentication throttling uses atomic shared database counters, not per-process
   memory. Login account limits are independent of IP limits. Counters contain
   HMAC-derived identifiers, not raw login IDs or IP addresses. No Redis required.
5. Activation eligibility responses are generic. Request bodies and URL query
   values are no longer recorded by request logging. SMTP/HTTP email calls have
   timeouts. Unsafe environment and numeric settings are rejected.
6. Expired sessions, OTPs, rate-limit buckets and import payloads are maintained on
   startup and hourly. Maintenance drains before database shutdown. Readiness
   checks require the new schema, not just a database connection.
7. Android Internet permission, macOS release network entitlement, explicit HTTPS
   release API configuration and non-debug Android signing requirements are added.
   Flutter refresh network failures preserve credentials instead of logging out.
8. Demo-only marks, assignments, structure and admin attendance-review screens are
   hidden by default and cannot be enabled in release builds. They are **not newly
   implemented production features**. Development previews may opt in using
   `--dart-define=ENABLE_DEMO_FEATURES=true`.
9. Updated vulnerable dependencies, pinned npm, isolated source tests from compiled
   output, added CI checks, a backend container, administrator bootstrap, and local
   SQLite backup/restore tooling with tests.

## Verification

- Baseline: 210 backend tests / 27 files passed before changes.
- Current local backend: 236 tests / 29 files passed.
- TypeScript typecheck and compiled build passed.
- Migration drift check passed; tests apply real migration files to isolated DBs.
- npm audit: zero reported vulnerabilities, including development dependencies.
- Python backup/restore: 3 tests passed (round trip, corrupt DB, missing source).
- Flutter SDK bootstrap was attempted but the Dart SDK download from Google
  storage failed in this sandbox. Flutter analysis/tests/build require CI results.
- No production database, email account, signing key or live deployment was used.

Tests and audit results are evidence, not guarantees. CLI scripts and platform
release packaging need staging smoke tests. Remote Turso concurrency must also be
exercised on the chosen hosting configuration; local libSQL tests are not a load test.

## Required migration procedure

Read [zero-cost release runbook](zero-cost-release.md) before upgrading.
Migrations 0010–0012 are additive. Do **not** guess college ownership from a student
or employee login ID. Provision existing admins with the bootstrap command after
migrating. Map existing student/teacher accounts to an approved college through a
reviewed operator data migration. Legacy accounts without membership are not counted
in admin stats, although their existing academic hierarchy can resolve read scope.

Historical audit logs with no college ID are not exposed in college admin screens.
Old import previews without college scope must be recreated. Do not blindly
backfill either from arbitrary IDs or grant global access as a compatibility fix.

## Gates still open — do not mark them complete just because CI is green

- [ ] Flutter analysis, unit/widget tests and release-web compilation pass in CI.
- [ ] Signed APK installed on a real device; release API, login, refresh, attendance
      submission, logout and offline/reconnect checked end to end.
- [ ] College-approved data mapping and an isolated staging migration rehearsal.
- [ ] Restore a real staging backup onto a separate instance and verify login,
      scoped reads, record counts and integrity; record owner, date and result.
- [ ] Hosting, persistent storage, HTTPS, sender identity and free-tier quotas
      verified. Alerts and an incident/support owner assigned.
- [ ] College approves attendance correction windows, EXCUSED/LATE calculations,
      role policies, privacy notice, retention, recovery process and admin MFA needs.
- [ ] Account recovery/password reset and administrator lifecycle tooling are
      implemented or an approved, verified operator procedure exists.
- [ ] Marks, assignments, admin academic editing/review and notifications either
      explicitly excluded from the accepted release scope or implemented and tested.
- [ ] Load/concurrency checks on the real database; a small nominated-user pilot.

Remaining work is deliberately visible. This change must not be marketed as a
complete college ERP or a guarantee of uptime/security at zero cost.
