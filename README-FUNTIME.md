# AI EXPO attendance deployment and development

## Configuration and deployment

The app starts in `src/main.event.ts`. Set the public Supabase URL and publishable key in `src/app/features/event/event-config.ts`; rebuild after changing them. Never include service-role keys in frontend code.

Apply the new migration and deploy the functions and frontend together:

```sh
supabase db push
supabase functions deploy register export-registrations
npm run build:prod
```

Keep all historical migrations in order. `202609280001_attendance.sql` joins `FNAME` and `LNAME` into `full_name` without truncating existing names, then removes the old columns. Existing records retain contact details and receive their existing UUID as their participant ID. Their attendance starts unmarked because registration does not prove physical attendance. Short numeric IDs are padded to three digits, for example 1 becomes 001; longer and alphanumeric IDs are retained. If migrating an existing participant to an external ID, reconcile IDs before importing to avoid creating a second participant.

The old registration submission RPC is removed. The existing `register` Edge Function now accepts `{eventId, requestId, participantId}` for check-in only. Deploy it with the migration; old form submissions are no longer supported.

Set `ALLOWED_ORIGINS` to comma-separated exact frontend origins and `RATE_LIMIT_SALT` to a random secret. Hosted Supabase supplies service keys. Attendance requires an event operator login, matching admin and dashboard. Check-in validates the Auth JWT and executes under that identity; the database checks event membership before lookup and retry replay. Bounded requests, CORS and the existing 20-attempts-per-IP-per-minute limiter still apply. Account for shared venue Wi-Fi and desk throughput before launch. Attendance, import and export require an Auth account assigned to the event in `public.event_operators`. Membership is checked inside each database RPC; participant tables remain inaccessible directly to anonymous and authenticated clients.

Disable public Supabase Realtime channels. Safe welcome broadcasts are private to event operators and contain only a scan ID, full name, timestamp and already-attended flag. No email, phone or participant ID is broadcast.

Upload `dist/monorepo/browser` to the web root, or use the existing Dockerfile. The supplied Nginx configuration serves SPA routes. Camera capture is not used and camera permissions are disabled.

## SQL seed, individual registration and check-in

Apply `202609280002_authenticated_attendance.sql` and redeploy `register` with the frontend to enforce attendance authentication. Anonymous check-in and service-role check-in RPC access are revoked. Operator sessions persist in browser storage and refresh automatically. Reloading and opening another tab keep the session; signing out updates other open app tabs. Sign out after using a shared workstation.

The private `AI_EXPO_Jordan_2026_Seed.sql` at the repository root contains the 228 participants from the root `AI_EXPO_Jordan_2026_Ready_For_Import.csv`. Apply migrations through `202609290005_major_category_backfill.sql` first, then run the seed in the Supabase SQL Editor for the configured event. The script uses a transaction and `ON CONFLICT (event_id, participant_id) DO NOTHING`: existing IDs keep every profile field and attendance timestamp. Before inserting, the seed renames one- and two-digit numeric IDs (and their scan references) to three digits within the configured event. If both a short ID and its padded version exist, it aborts the transaction so they can be reconciled without merging people. New records start without attendance. It reports the number inserted and is safe to rerun. Keep this file private; it is ignored by Git and is not a public asset. Generating or testing it does not execute it against the hosted database.

Regenerate it with:

```sh
python tools/participants-to-sql.py AI_EXPO_Jordan_2026_Ready_For_Import.csv AI_EXPO_Jordan_2026_Seed.sql --event a1c08e5d-0817-4684-a03e-1b37c24e1aa1
```

Sign in at `/admin` to register one participant at a time. Enter their ID, full name, email, role, optional university and major, and IEEE membership. Major categories are assigned from known majors. Missing university/major values become `Not Provided`. Gender is not collected. Successful registration displays the ID for check-in and clears the form. Existing IDs are rejected without changing their profile or attendance. IDs remain strings and are case-sensitive within the event. Registration and check-in pad one- and two-digit numeric IDs to three digits: 1 becomes 001 and 22 becomes 022. Longer and alphanumeric IDs are not truncated. Shared contact details do not cause participants to be merged.

CSV upload and template download have been removed. The form uses the existing operator-authorized, atomic registration RPC; no new migration is needed specifically for the form. Registration alone does not increase attendance or trigger a welcome.

QR codes must contain only the exact participant ID. On `/attendance`, focus Participant ID and scan using a keyboard-style USB reader (Enter submits). Manual entry uses the same field. There is no camera capture. Admin provides individual registration and attendance review, with a link to the separate check-in page.

First check-in records attendance and welcomes the full name. A repeat scan says already attended and welcomes the person again without increasing the count. The next-participant button prepares another scan. Retries reuse the request ID until the participant changes or the next scan begins; concurrent requests lock the participant row so only one records first attendance. Unknown IDs do not create participants.

The single-screen dashboard shows checked-in attendance, IEEE membership ratio, a university donut with the top three universities and Others, role proportions, major-category columns and the latest three check-ins with Jordan-time timestamps. Repeat scans do not change first-check-in order. No gender analytics are displayed. Apply `202609290003_remove_gender_analytics.sql` to stop returning gender aggregates from the database. Existing participant values remain stored for compatibility. Deploy the updated `export-registrations` function to remove gender from hosted Excel exports. Each deliberate scan has a unique welcome ID; statistics refresh on broadcasts and every 30 seconds.

## Admin and export

Admin lists checked-in participants only, newest check-in first, including attendance time, full name, ID, IEEE membership, role, university and contact details. Dates display in Jordan time. Operator sessions persist across refreshes. Access is checked against the RLS-protected event operator membership, independently of analytics payload parsing.

Excel includes checked-in participants only across all pages and their first attendance timestamp (UTC). Production exports use 500-row keyset batches and a cutoff for participant creation time. Updates during export may be reflected between batches; this is not a transaction-wide snapshot. Contact strings are plain cells, never formulas. The export endpoint validates the Auth JWT and performs RPCs under the user's identity.

Demo mode uses a separate IndexedDB attendance database, isolated from old demo registration data and production. The demo permits admin actions without login and supports cross-tab welcomes. It does not copy existing old demo registrations; use the participant form or demo data button to start.

## Verification

```sh
npm run check
npm run typecheck
npm run e2e
npm run check:event-function
npm run test:admin-export
npm run test:event-db
npm run test:event-load
```

The database and load commands require Docker and disposable PostgreSQL. `tools/test-attendance-db-local.mjs` offers a local PGlite fallback: set `PGLITE_MODULE` to the installed package's `dist/index.js`. It applies all migrations, verifies legacy full-name preservation, and tests permissions, atomic imports, first/repeat check-in, retry idempotency, safe broadcasts, attendance counts and exports.

Browser tests use the local demo. Verify hosted CORS, Auth and Realtime on the deployed environment as well. No production migration is applied by local tests. Apply `202609280003_attendance_admin_list.sql` and deploy `export-registrations` plus the rebuilt frontend for the attendance-only admin list and export.

## Hosted deployment verification — 2026-09-28

The linked project `eibwjkrickjbktaqsaus` already had migration `202609280001` applied directly. Its table structure, constraints, private access, and all seven function bodies were verified against the local migration before recording it as applied. Migration `202609280002` was then applied through the CLI, and `register` plus `export-registrations` were redeployed. The downloaded hosted schema accepts the attendance payload (`eventId`, `requestId`, `participantId`). Anonymous HTTP check-in returns 401; an operator database check-in was verified inside a rolled-back transaction, leaving attendance unchanged.

Migration `202609280003` and the attendance-only export function were subsequently deployed to the linked project. Hosted operator queries verified that both list and export exclude participants without an attendance timestamp. The frontend build removes camera scanning and makes admin an upload and attendance-review page.

## Prepared source CSV and data quality

The private prepared CSV is in `outputs/ai_expo_cleaning/AI_EXPO_Jordan_2026_Ready_For_Import.csv` (228 unique IDs). The cleaning script no longer adds a Gender column. Twenty source records retain review notes for ambiguous or questionable inputs. Cleaning does not establish the validity of phone numbers or membership IDs. Do not publish the CSV in `public/`.

`e2e/import-flow.spec.ts` verifies individual registration, validation, duplicate protection and separate check-in using isolated local IndexedDB. Set `PGLITE_MODULE` and run `node tools/test-participant-seed.mjs` to verify all 228 seed records locally, including repeat execution after check-in. The database tests assert unchanged existing profiles, distinct people sharing contact details, aggregate denominators and metadata persistence.

## Authentication regression checks

`node node_modules/@playwright/test/cli.js test --config playwright.auth.config.ts` exercises the real Supabase gateway with intercepted test responses (no real credentials). It verifies login independently of analytics schema, reload persistence, access in another tab, cross-tab logout, and distinct invalid-password, rate-limit and service-unavailable errors. Missing analytics migrations produce a dashboard update error, not a false account-access denial. Apply all 20260929 migrations before deploying the current dashboard.

The populated private CSV under `src/assets/img/participants-template.csv` remains excluded from public assets. No downloadable participant template is served.

## Phone removal and major-category correction

Apply `202609290004_remove_phone.sql` followed by `202609290005_major_category_backfill.sql`, then deploy the rebuilt frontend and `export-registrations` function together. The first migration removes the stored phone column and updates registration/list/export RPCs; it permanently removes previously stored phone values. The frontend, demo storage, CSV parser, SQL seed and Excel export no longer collect or return phone numbers. Original source files remain historical inputs.

The second migration derives categories from actual majors, corrects existing category values and classifies future imports. The dashboard also derives categories from checked-in major counts, so a stale `Not Provided` category cannot hide a known major. Blank majors remain `Not Provided`; unfamiliar or ambiguous values remain `Unclassified`. The canonical major mapping is in `src/app/features/event/data/major-categories.json`; the SQL classifier uses the same mapping. No attendance timestamps or participant IDs are changed by these migrations.

## Reset attendance

Apply `202609290006_reset_attendance.sql` with the updated frontend to enable **Reset attendance** in the admin attendance toolbar. A confirmation dialog explains that all event check-ins and scan history will be cleared, including other pages, while registrations remain. Cancel makes no changes. The RPC requires event operator membership and explicit confirmation; it coordinates with concurrent check-ins using an event advisory lock. Reset broadcasts refresh the dashboard and clear queued welcomes. Participants can check in again afterward. This action cannot restore the cleared attendance timestamps.

The university donut is a passive stage display: the top three named universities are shown with permanent counts and percentages. Others includes the remaining universities and missing university values, preserving the complete checked-in denominator. No selection or interaction is required.
