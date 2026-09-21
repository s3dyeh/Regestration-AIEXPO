# AI EXPO 2026 registration

Two standalone Angular 22 screens: `/register` and `/dashboard`. Run `npm ci` and `npm start` to connect to Supabase, then open `http://localhost:4200/register`. Open `/dashboard` in a second tab in the **same browser and origin** to see registrations arrive.

## Modes

- Normal development and production connect to Supabase. Use `npm run start:demo` for a prominently labeled **local demo**. IndexedDB holds registrations on this device; BroadcastChannel delivers minimal welcome events across tabs. This is not a multi-device backend. “Add demo arrivals” creates 12 explicitly synthetic participants. Clear the `funtime-demo-v1` IndexedDB database in browser developer tools to reset the demo.
- Production defaults to **Supabase** and fails closed if its public configuration is missing. It never silently stores real registrations locally. Operator sessions are memory-only, so reloading the production dashboard requires signing in again.

## Architecture

```text
src/app/features/event/
  event-config.ts             Public event/deployment configuration
  event.routes.ts             Lazy screens and gateway dependency injection
  domain.ts                   Re-export of the shared browser/server contract
  data/                       Observable gateway contract and data adapters
  registration/               Typed form and submission state
  dashboard/                  Live state, pure greeting queue, chart options
  ui/                         Shell, chart renderer, welcome animation
supabase/
  functions/_shared/          The single validation/normalization contract
  functions/register/         Public endpoint, bounded body, CORS, rate limiting
  migrations/                Constraints, RPCs, private broadcast, RLS
  tests/                     PostgreSQL integration assertions
```

Components use OnPush change detection and signals; asynchronous work uses RxJS with destruction cleanup. Persistence is injected through `EventGateway`. The form and server share Zod rules, including international phone parsing. PostgreSQL separately enforces invariants at the storage boundary. These database constraints are deliberate defense in depth, not duplicated presentation logic.

One normalized email may register once per event. Phone numbers are **not unique**, allowing shared contact numbers. Names accept international letters and common name punctuation, require at least two letters, and normalize whitespace. Full names are always used in live greetings; there is no greeting checkbox. Contact details are never broadcast or returned by the dashboard aggregate RPC.

Idempotency keys are retained for retries with the same normalized form payload during the current page session. The database serializes identical request IDs and rejects a changed payload. A successful retry returns the original result without another broadcast. A minimal localStorage receipt (registration ID, first name, timestamp) restores the confirmation after a reload without saving email or phone. Registering another participant clears this device receipt, not the stored registration. Blocked localStorage never changes a successful server response into an error. Email uniqueness remains authoritative.

## Live presentation

Subscribe before loading authoritative statistics. New events trigger a coalesced aggregate refresh and a deduplicated greeting. Statistics also reconcile every 30 seconds and on reconnect; totals are never derived by incrementing socket messages.

Welcomes enter for approximately half a second, remain for three seconds, and exit before a five-second statistics interval. More than five queued arrivals, or an aged queue, become a group greeting. Old incoming events are dropped after 30 seconds. Reconnect clears waiting greetings. Missed welcomes are not replayed; accurate stored statistics remain authoritative. GSAP contexts, ResizeObservers, subscriptions, channels, and timers clean up on component destruction. Reduced-motion preferences disable movement and chart animation.

## Connect Supabase

1. Create a Supabase project and link it with the Supabase CLI. Apply the migrations using `supabase db push`. The identity migration updates the AI EXPO 2026 event with ID `a1c08e5d-0817-4684-a03e-1b37c24e1aa1`.
2. Set the public project URL, publishable key, and public HTTPS registration URL in `src/app/features/event/event-config.ts`. Keep `mode` set to Supabase for production. Never place a service-role key in frontend code.
3. Set Edge Function secrets `ALLOWED_ORIGINS` (comma-separated exact HTTPS frontend origins) and `RATE_LIMIT_SALT` (a random secret). Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in hosted functions. Deploy using `supabase functions deploy register`. JWT verification is intentionally disabled for this anonymous registration endpoint; validation, origin checks, database constraints, and rate limiting happen server-side.
4. Create an operator in Supabase Auth. In a privileged SQL session, insert its real Auth user UUID into `public.event_operators` with the event UUID. Only registered operators may read aggregates or subscribe to that event’s private channel. Do not add a permissive public Realtime policy.
5. Disable “Allow public access” in Supabase Realtime settings. The frontend and trigger both use private channels.
6. Build using `npm run build:prod` and host `dist/monorepo/browser` with SPA fallback. `nginx.funtime.conf` is a standalone event hosting configuration; the original `nginx.conf` remains the existing enterprise backend proxy. Use `Dockerfile.funtime` for the event-only container.

For approximately 1,000 attendees and two concurrent submissions per IP, the endpoint allows 20 attempts per hashed IP per minute, reusing migration 001. These are abuse limits, not concurrency limits. No queue service, Redis, or extra production infrastructure is needed. The gateway must overwrite the client IP header; do not expose this endpoint behind an untrusted forwarding chain. Tune this limit for a shared campus Wi-Fi network. CORS is a browser boundary, not bot protection; add gateway-level abuse protection if the event will attract substantial anonymous traffic. Stored rate-limit buckets are cleaned after two hours.

Before launch, verify the actual event name, major list, privacy copy, registration URL, and operator account. Rehearse with two physical devices and a dropped network connection. Hosted WebSocket delivery, deployed CORS, and actual project permissions require this final environment-specific test.

## Verification

```sh
npm run typecheck
npm run lint
npm run format:check
npm run test:ci
npm run build:prod
npm run e2e:event
npm run test:event-db
npm run test:event-load
npm run check:event-function
```

The browser suite starts an Angular dev server if necessary and covers cross-tab registration, duplicate emails, simultaneous submissions, privacy, reload recovery, queue batching, mobile layout, and browser exceptions. The SQL test requires Docker and uses a disposable PostgreSQL 17 container with **no network access**. It checks idempotency, constraints, RPC permissions, operator RLS, minimal broadcast payloads, event closure, and throttling. Its Supabase `auth` and `realtime` functions are test doubles; it does not claim to validate hosted WebSocket delivery.

The event application has a dedicated, lightweight entrypoint (`src/main.event.ts`). The original enterprise application remains intact and is available with `npm start -- --configuration enterprise`. Its backend-dependent E2E tests still need their separate backend harness. The QR/link card and its rendering dependency have been removed.

## Design and dashboard

Original AI EXPO identity uses purple `#7a3cff`, blue `#2cabe2`, black and white. The supplied `src/assets/img/event-logo.webp`, responsive layout, particle artwork, motion and chart palette are shared across both screens. Existing sponsor, venue and organizer assets retain their branding. Design references: [Figma Config 2026 identity](https://www.figma.com/blog/the-visual-identity-behind-config-2026/) for expressive event identity and motion, and [NVIDIA GTC](https://www.nvidia.com/gtc/) for a clear conference hierarchy. No reference assets or copy are reused.

The live overview shows registrations, disciplines, last-hour activity, a 12-hour chart, recent arrivals with full names. On the authorized dashboard, clicking the centered Realsoft logo opens a Material menu for Pause/Resume welcomes, Present (fullscreen toggle), and Sign out. Sign out appears only for connected Supabase sessions. The logo remains a static sponsor mark on registration and login screens. The registration desk, contact table, search and CSV export have been removed. Migration 004 drops `event_attendees` entirely, so there is no alternate desk API access. Full names appear in individual and batch greetings; email and phone remain private.

## Capacity verification — 2026-09-21

`npm run test:event-load` starts disposable PostgreSQL and the real Deno registration function. A small test-only RPC bridge replaces hosted PostgREST; Supabase Auth and Realtime use test doubles. Ten bursts of 100 concurrent HTTP submissions, two per simulated IP, accepted all 1,000 unique registrations. Local p95 was **494 ms**, maximum **512 ms**. Concurrent duplicates created one record; concurrent identical retries returned the same ID. Invalid input, unapproved origins and excessive attempts were rejected. This is local evidence, not a hosted latency or capacity guarantee. The test needs Docker, closes its temporary services, and writes `test-results/event-load.json`.

The browser suite also checks receipt restoration, full-name greetings and the absence of the registration desk and mobile overflow. Current verification: 64 unit tests, four end-to-end browser flows, SQL permissions/invariants, Deno typecheck, lint, formatting and production build passed.

The public Supabase URL and publishable key are configured for the supplied project. The public registration URL still needs to be set for multi-device production use. Apply all migrations through `202609210004_full_name_greetings.sql` and redeploy the registration function. Setup notes previously appended to the identity migration were moved to ignored `.supabase-setup.local.txt`; rotate the secret key from those notes before using it.

## Simplified migration 003

Run `supabase/migrations/202609210003_operator_desk_and_capacity.sql` in the project SQL Editor after 001 and 002. It adds only operator attendee search and the recent-arrival fields needed by the dashboard, using existing tables and privacy helpers. It is transactional and safe to re-run. It does not change or delete registrations. The Edge Function now reuses the existing `consume_registration_limit` RPC (20 attempts/minute/IP); the extra contact limiter has been removed.

A read-only check of the supplied project found `event_statistics` correctly denied anonymous access, `event_attendees` was absent, and `/functions/v1/register` returned 404. After running 003 and 004, deploy `register` and configure `ALLOWED_ORIGINS` plus `RATE_LIMIT_SALT` as described above. A publishable/secret project API key does not grant SQL Editor or function-deployment access; use the dashboard or a Supabase CLI session authenticated with your account. Supabase supplies the server service-role credential inside hosted Edge Functions. The JWKS URL is not needed in the browser; Supabase Auth handles operator sessions.

Normal development and production use the configured project. Only `npm run start:demo` uses local storage as the data source. Rotate the secret key pasted in the conversation; only the publishable key belongs in the frontend.

## Full-name greetings and desk removal (004)

Apply `supabase/migrations/202609210004_full_name_greetings.sql` after 003, even if 003 has already been applied. It replaces the shared database welcome helper with full-name greetings (including existing rows) and drops the attendee-search RPC. Existing registrations are retained and direct registration-table access remains revoked. Run pending migrations in order and deploy the current registration Edge Function. The browser and server normalize the legacy `showName` payload field to true for compatibility; it is no longer a form control. Contact data is never included in welcome events. This migration has been prepared locally, not applied to the hosted database.

## 16:9 presentation and demo controls

Landscape dashboard screens from 1,000px wide use a single 16:9 composition containing the header, all cards and partner logos. The frame fits 720p and 1080p without page scrolling and is centered with side margins on ultrawide displays. Phones retain the scrolling mobile layout. Fullscreen uses the same composition. Charts respond to their container size; New connections shows only the latest three registrations, newest first, in a single column.

Set `showDemoArrivals` in `src/environments/environment.ts` (development default: `false`) or `src/environments/environment.prod.ts` (production default: `false`). The button and its handler require both this setting and local demo mode, so synthetic registrations cannot be submitted to the production gateway. This is an Angular build-time environment setting; rebuild after changing it. The supplied event logo is used in the header, welcome overlay and app metadata.

## Connected development

`eventDataMode` selects the data source independently of `production` and `showDemoArrivals`. Normal `npm start` now uses Supabase and the dashboard requires an authorized operator login. `npm run start:demo` uses the dedicated `environment.demo.ts` configuration and enables synthetic local arrivals. Browser tests use this demo configuration on port 4292, separate from the connected preview on 4291.

Live checks confirmed the database is reachable but the registration Edge Function returns 404. The current CLI account did not list the supplied project. Deployment requires signing the CLI into an account with access to `eibwjkrickjbktaqsaus`, then configuring the allowed frontend origins (including local development origins when testing) and deploying `register`. Local demo registrations are not automatically uploaded to Supabase.
