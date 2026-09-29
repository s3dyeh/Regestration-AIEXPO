# AI EXPO 2026 attendance

Angular attendance check-in and live dashboard backed by Supabase.

- `/attendance`: operator sign-in, USB QR reader, or manual participant ID check-in.
- `/register`: redirects to attendance for existing links.
- `/admin`: operator sign-in, individual participant registration, recorded attendance and attendance-only Excel export.
- `/dashboard`: authorized live welcomes and attendance statistics.

Use Node.js 24.15+ within version 24, or Node.js 26.

```sh
npm ci
npm start
```

Development and production connect to Supabase. `npm run start:demo` runs the local browser-only demo.
See [README-FUNTIME.md](README-FUNTIME.md) for migration, SQL seed and deployment instructions.
