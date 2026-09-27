# AI EXPO 2026 registration

Angular registration form and live dashboard backed by Supabase.

- `/register`: public registration form.
- `/dashboard`: authorized operator dashboard with live greetings and statistics.

Use Node.js 24.15+ within version 24, or Node.js 26.

```sh
npm ci
npm start
```

Open http://localhost:4200/register. Development and production connect to Supabase. Use `npm run start:demo` for the explicitly labeled local demo.

See [README-FUNTIME.md](README-FUNTIME.md) for configuration, deployment, and verification.
