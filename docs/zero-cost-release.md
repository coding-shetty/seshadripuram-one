# Zero-cost release and operations runbook

## Cost boundary

The application does not require Redis, paid monitoring, a paid email SDK or a paid
secret-management product. It uses the existing SQLite/libSQL database, console
JSON logs, HTTP probes and CI. This repository is public; use the included Linux
GitHub Actions checks within GitHub's applicable free allowances. Codemagic is
optional, not required to use or deploy the project.

**Zero subscription cost is not zero operational responsibility.** Hosting/email
free-tier terms and quotas change; verify them in the account dashboard before
launch and disable paid overages. Do not promise free permanent capacity or uptime.

Recommended initial scope: a small Android direct-APK or web pilot. App-store
accounts/distribution may require fees, especially Apple distribution. Those fees
are not bypassed by this project. Web hosting alone cannot run the Express API.

Choose one:
- College-owned Linux computer/server with existing Internet and persistent disk:
  SQLite file, college-provided HTTPS reverse proxy and approved email account.
  Electricity, maintenance and connectivity still belong to the college.
- A provider's verified free Node/container allowance plus a verified free remote
  libSQL allowance. Use the provider's HTTPS hostname rather than buying a domain.
  Never store the only production SQLite file on an ephemeral free-host filesystem.

## 1. Verify the checkout

Use Node 22.12+ (Node 22 or 24 LTS) and **npm 11.14.1**. npm 10 exhibited an optional
platform-dependency lockfile install bug here; CI/container use the pinned npm.

```sh
cd backend
npx --yes npm@11.14.1 ci
npm run typecheck
npm run db:check
npm test
npm run build
npm audit --audit-level=moderate
python3 -m unittest discover -s scripts -p '*_test.py'
```

Flutter:
```sh
flutter pub get --enforce-lockfile
flutter analyze
flutter test
```

The CI web build uses `https://api.example.invalid` **only as a compilation check**.
Never distribute that build as a working application.

## 2. Configure an isolated staging environment

Copy `backend/.env.example` only for local development. Generate your own JWT secret
(e.g. `openssl rand -hex 48`) and supply it through the host's environment/secret
settings. Never use a documentation/test secret. Do not post secrets in issues/chat.

For a local development run, replace the example JWT value: it is intentionally
not accepted by the application. Configure production with:

- `NODE_ENV=production`
- Explicit `TURSO_DATABASE_URL` and, for remote databases, `TURSO_AUTH_TOKEN`.
- Unique `JWT_SECRET`; keep issuer and audience consistent across instances.
- `OTP_PROVIDER=smtp`, `gmail` or `resend`, and the selected provider's credentials.
  Use a college-approved verified sender. Console OTP is forbidden in production.
- `CORS_ORIGINS` with exact trusted HTTPS web origins, no paths or wildcards.
- `PORT` assigned by the host; the server binds `0.0.0.0`.
- `TRUST_PROXY=false` for direct connections. Use `1` only when **every** external
  request comes through exactly one trusted reverse proxy and direct access is
  blocked. Never use `true` or blindly trust arbitrary forwarded headers.

The proxy must provide HTTPS, body/request timeouts and appropriate connection
limits. Configure an external check for `/readyz`, and alert a nominated operator
on repeated failures. `/healthz` only establishes that the process responds.

## 3. Back up, migrate, provision

Do not run `db:push` or development seeding on a production database. Stop writes
for the migration window, take and verify a backup, then:

```sh
cd backend
npm run db:migrate
```

For a compiled/container deployment (working directory `/app`):
```sh
node dist/src/scripts/migrate.js
```

The migration runner uses the same libSQL URL/token as the API. Run migrations
once as an operator release step, not concurrently in every server instance.

Configure the first administrator using **non-secret identity values** in the
operator environment (replace all examples):
```sh
COLLEGE_ID=approved-college-id COLLEGE_CODE=APPROVED_CODE \
COLLEGE_NAME='Approved College Name' ADMIN_LOGIN_ID=APPROVED_ADMIN_ID \
ADMIN_EMAIL=approved-admin@example.edu npm run bootstrap:admin
```

This creates a pre-provisioned account, not a default password. Activate it through
email. It can also attach an existing ADMIN to the college when the login ID/email
match. It refuses to promote a student or move an existing admin between colleges.
Keep a second approved administrator and a documented recovery contact.

Existing student/teacher membership must be reviewed separately. `institution_id`
is the old login identifier; **never mass-copy it into `college_id`**. Recreate old
import previews after migration. Historical unscoped audits remain operator-only.
Use synthetic records for staging until college approval.

## 4. Start the API

```sh
cd backend
npm start
```

Or build `backend/Dockerfile` and provide the environment from outside the image.
If using local SQLite in the container, mount a persistent directory writable by
UID 1000 and use an absolute file URL. A remote database needs no local volume.
Do not expose the API directly over public HTTP.

Expired session/OTP/rate-limit rows and old import payloads are swept on startup
and hourly. Failures emit `maintenance_failed`; alert on it. Operators can also run
`npm run maintenance`. Sleeping free hosts do not execute tasks while asleep;
ensure a startup sweep completes and observe storage quotas.

Database-backed rate limits add writes. Test the traffic expected at class-change
and login peaks against database allowances. Do not disable limits to save quota.

## 5. Build the client

Web:
```sh
flutter build web --release --dart-define=API_BASE_URL=https://YOUR_REAL_API_HOST
```
Serve `build/web` from HTTPS static hosting. Set API CORS to that exact web origin.
Apply a suitable web Content Security Policy and test secure storage in supported
browsers; do not add third-party scripts that can access browser credentials.

Android:
- Set `ANDROID_APPLICATION_ID` to the college-approved unique app ID.
- Provision a private keystore outside Git. Back it up securely; losing it affects
  updates. Supply `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`,
  `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` as protected build environment values.
- No debug key fallback exists for release builds.

```sh
flutter build apk --release --dart-define=API_BASE_URL=https://YOUR_REAL_API_HOST
```

A signed APK may be distributed directly for an approved pilot without an app-store
subscription. Verify the APK signature and install it on a real Android device.
The existing debug/unsigned Apple/Desktop workflows are **not** release validation.
Apple signing/identifiers and device verification remain separate release gates.

## 6. Backups and restore drills

For local SQLite only, this utility uses SQLite's online backup API, not a raw copy
of a live WAL database. It refuses to overwrite existing files and runs integrity
and foreign-key checks. Use an encrypted, access-controlled destination **outside
Git**, on separate storage already owned/approved by the college.

```sh
python3 backend/scripts/backup_sqlite.py backup /data/college.db /secure-backups/college-2026-10-04.db
python3 backend/scripts/backup_sqlite.py restore /secure-backups/college-2026-10-04.db /staging/restored.db
```

Destination parent directories must exist. Backups are created mode 0600 but are
**not encrypted by the utility**. Encryption-at-rest/transfer is the operator's job.
For remote libSQL use the provider's supported consistent export/snapshot workflow;
this local utility does not pretend to back up a remote URL. Verify retention and
export availability in the chosen free plan.

On the isolated restored instance verify database integrity, record counts, admin
login, college boundaries and representative attendance. Record the restore date,
backup age, duration and responsible operator. Set backup frequency/retention to
the college-approved recovery objectives. A backup on the same disk is not disaster
recovery. Do not switch the live service to a restored file without a reviewed
maintenance plan and verified preservation/reconciliation of recent writes.

## 7. Before inviting real users

Follow the open gates in [fix-audit-status.md](fix-audit-status.md). Have the college
approve privacy/retention, academic policy and the reduced feature scope. Demo-only
features are not operational in release builds. No numerical readiness claim
replaces a signed release decision, a restore drill or real-device testing.
