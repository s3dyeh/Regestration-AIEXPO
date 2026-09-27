# AI EXPO deployment and development

## Configuration

The app starts in `src/main.event.ts`. Registration, dashboard, and admin screens live in `src/app/features/event/`.

Set the public Supabase URL and publishable key in `src/app/features/event/event-config.ts`. These values are embedded during the build; rebuild after changing them. Nginx does not load a `.env` file into Angular. Never put secret or service-role keys in frontend code.

The development and production environment files select Supabase. The demo environment enables the local demo and synthetic arrivals. Demo registrations stay in IndexedDB on the same browser and origin; they are not uploaded to Supabase.

## Supabase setup

1. Link the intended project with an authorized Supabase CLI account and apply the migrations using `supabase db push`.
2. Set Edge Function secrets `ALLOWED_ORIGINS` to comma-separated exact frontend origins, such as `https://registration.company.com` without a trailing slash, and `RATE_LIMIT_SALT` to a random secret. Hosted Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` automatically.
3. Deploy using `supabase functions deploy register`. JWT verification is intentionally disabled for this anonymous endpoint; validation, origin checks, rate limiting, and database constraints happen server-side.
4. Create an operator in Supabase Auth and insert its actual Auth user UUID and the configured event UUID into `public.event_operators` from a privileged SQL session.
5. Disable public access in Supabase Realtime settings. The dashboard and database trigger use private channels.

Keep all migrations: fresh installations need them in order. Migration 004 removes the former attendee-search RPC while preserving registrations. Review event identity, majors, privacy copy, operator permissions, and endpoint availability before launch.

## Read-only admin and Excel export

Open `/admin` and sign in with an Auth account assigned to the event in `public.event_operators`. The page lists registrations with server-side pagination (10, 25, 50, or 100 rows), refresh, and sign out. It has no create, edit, or delete actions. Database functions independently check event membership; direct table access remains revoked.

Before using this feature on the hosted app:

```sh
supabase db push
supabase functions deploy register export-registrations
npm run build:prod
```

Deploy the rebuilt frontend using the existing hosting process. Migration `202609270001_read_only_admin.sql` adds read-only functions and an export index. Apply the split-name migration immediately after it, before deploying the updated functions. The export endpoint reuses `ALLOWED_ORIGINS` and the hosted `SUPABASE_URL` / `SUPABASE_ANON_KEY`. Although gateway JWT verification is disabled in its configuration, the handler explicitly validates the user JWT with Auth, and all database reads execute with that user's JWT, never the service role.

**Export all to Excel** downloads every registration across all pages. The workbook includes first name, last name, derived full name, email, local and international phone, major, gender, and registration time (UTC). A Summary sheet contains the exported total, cutoff time, and counts by major and gender. The database stores names separately in quoted columns `"FNAME"` and `"LNAME"`. Migration `202609270002_split_registration_names.sql` replaces the old `name` column and updates submission, greetings, admin pagination, and export functions. Existing full names are backfilled using the first word as FNAME and all remaining words as LNAME; historical single-word names retain an empty LNAME. New registrations require both fields. Phone cells are text, preserving `07` and `+962`.

The endpoint reads 500-row keyset batches up to a fixed database timestamp and commits rows into an ExcelJS streaming workbook writer. A buffered `PassThrough` stream sends XLSX bytes without writing a temporary file. The browser buffers the completed response into a Blob before triggering the download; failed streams do not download partial workbooks. Navigating away or signing out cancels the browser request. The offline demo uses a browser-only workbook buffer and includes local demo records only.

Sessions are memory-only, so refreshing `/admin` requires signing in again. The page displays dates in Jordan time; Excel dates use UTC. Exports reflect records visible during their batch reads before the cutoff; they are not a database-wide transaction snapshot. The endpoint may still be subject to the host's function execution limits for very large datasets.

## Nginx deployment

```sh
npm ci
npm run build:prod
```

Upload the contents of `dist/monorepo/browser` to the web root. The supplied `nginx.conf` serves static files on port 8080 with SPA fallback for both routes. Adjust the root, hostname, and HTTPS termination for your server. Its content security policy allows hosted Supabase HTTPS and WebSocket connections; update it for a self-hosted Supabase hostname.

For containers, use the standard `Dockerfile`:

```sh
docker build -t ai-expo-registration .
docker run -d --name ai-expo-registration --restart unless-stopped -p 127.0.0.1:8080:8080 ai-expo-registration
```

Put your HTTPS reverse proxy in front of port 8080. `/health/live` checks the static server. Nginx needs no Supabase secret. Visitors need access to the configured Supabase backend; hosting the frontend on-premise does not move that backend on-premise.

After deployment, test registration and dashboard login on separate devices, refresh both routes, and verify reconnect behavior. Operator sessions are memory-only, so reloading the dashboard requires signing in again.

## Architecture and behavior

- `registration/`: typed form and submission state.
- `dashboard/`: live state, charts, welcome queue, and presentation controls.
- `data/`: Supabase and demo gateways, and minimal registration receipts.
- `ui/`: shared shell, partner marks, charts, and animations.
- `supabase/functions/_shared/`: browser/server validation contract.
- `supabase/functions/register/`: public endpoint with bounded requests, CORS, and rate limiting.
- `supabase/migrations/`: constraints, RPCs, private broadcasts, and operator permissions.

One normalized email may register once per event. Phone numbers may be shared. Retries reuse an idempotency key during the page session. A minimal localStorage receipt restores confirmation without saving email or phone. Full names appear in greetings; contact details are never broadcast or exposed by dashboard aggregates.

The dashboard subscribes before loading statistics, refreshes aggregates on arrivals, and reconciles every 30 seconds and on reconnect. Greetings are deduplicated, batched under load, and dropped when stale. Reduced-motion preferences disable movement and chart animation. The sponsor menu provides pause/resume, fullscreen, and sign out. Landscape displays from 1,000px wide use a 16:9 composition; phones retain a scrolling layout.

The endpoint allows 20 attempts per hashed IP per minute. Account for shared campus Wi-Fi when setting limits. The gateway must supply a trusted client IP header. Database and load tests use Auth and Realtime test doubles; they cannot verify hosted WebSocket delivery or production capacity.

## Verification

```sh
npm run check
npm run typecheck
npm run e2e:event
npm run check:event-function
npm run test:event-db
npm run test:event-load
```

The check script runs lint, formatting, unit tests, and the production build. Browser tests start the demo app on port 4292 and cover registration, duplicate submissions, receipts, greetings, presentation sizing, and mobile overflow. Database and load tests require Docker and use disposable infrastructure. Test hosted CORS, permissions, and Realtime against your deployment as well.


### Registration payload compatibility

The form sends `firstName` and `lastName`; the registration function maps them to database `FNAME` and `LNAME` without combining them. During rollout, the endpoint also accepts uppercase `FNAME` / `LNAME` or the older `name` field, and converts valid Jordanian `+9627…` phone numbers to the form's `07…` representation before validation. Missing fields return a readable message and a `fields` array identifying the missing input. Update the registration Edge Function together with the frontend; a stale function expecting `name` rejects a split-name payload before it reaches the database.

The linked AI-EXPO project had the split-name schema but no migration-history table. Its existing schema was inspected and migration history was reconciled through `202609270002`; both `register` and `export-registrations` were redeployed. Do not rerun old SQL migrations individually against the split-name schema: apply new migrations in order using the migration history.
