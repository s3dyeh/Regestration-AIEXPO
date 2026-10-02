# Attendance and export CORS

`ALLOWED_ORIGINS` is a **Supabase Edge Function secret**, not a Vercel variable. Both `register` and `export-registrations` use it. Configure exact browser origins, including the scheme and local port. A root trailing slash is tolerated. Paths, wildcard origins, credentials and `null` are rejected.

The current site origins are recorded in `supabase/cors.env.example`. To intentionally apply that list:

```sh
npx supabase secrets set --project-ref eibwjkrickjbktaqsaus --env-file supabase/cors.env.example
npx supabase functions deploy register --project-ref eibwjkrickjbktaqsaus --use-api
npx supabase functions deploy export-registrations --project-ref eibwjkrickjbktaqsaus --use-api
node tools/check-event-cors.mjs
```

Setting the file replaces the origin list. Add any other explicitly trusted frontend origins to it before applying. Do not allow all Vercel preview domains with a wildcard.

The shared handler uses the pinned Supabase SDK's allowed headers. OPTIONS succeeds without authentication only for configured origins. POST still validates the user JWT and operator permissions; the attendance rate limiter remains active. `verify_jwt = false` lets OPTIONS reach the handler and does not remove the handler's authentication checks.

The verification script checks both endpoints for all configured site origins, unauthorized POST rejection and untrusted-origin rejection. It sends no participant IDs and creates no attendance records. Optional command-line arguments select other origins; `EVENT_FUNCTIONS_URL` selects a different backend.

The original failure was reproduced live as OPTIONS 403 with the function message `This origin is not allowed.` for the production domain and both localhost variants. Updating the Supabase origin list fixes that configuration failure. Shared URL normalization and SDK header coverage prevent related preflight failures. `strict-origin-when-cross-origin` is a referrer policy, not the error.

See [Supabase CORS guidance](https://supabase.com/docs/guides/functions/cors).
