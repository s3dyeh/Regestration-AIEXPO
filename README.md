# CareerLens AI and AI EXPO 2026 attendance

Angular attendance check-in and live dashboard backed by Supabase.

- `/`: CareerLens public GitHub analysis, with repository evidence, an explainable career capability map, next actions and a downloadable JSON report.
- `/learn-git`: **Start learning Git**, the complete Arabic workshop with 30 connected challenges, a simulated terminal/editor, repository graphs, guided solutions and automatically saved progress.
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

The Git workshop ships with this application and needs no separate server, Next.js installation or external service. It is a native, lazy-loaded Angular feature with a signal store, computed view models and OnPush components. The normal development server and production build include it directly. Progress is saved only in this browser; a confirmed new-group reset clears the current round while retaining display preferences. See [the workshop integration notes](learning/git/README.md) for the source layout, supported commands and checks.

CareerLens requests the public GitHub API directly from the browser, using public access by default or an optional user-supplied token held only in page memory. Rubric v2 inspects up to six recently pushed, non-fork, non-archived repositories from the latest 100. Each repository samples its root README, up to two documentation files, three source files spread across sorted paths, 30 user-attributed default-branch commits and 10 GitHub Actions runs. Supported source/documentation candidate counts and selection scope appear in the report. Files above 100 KB and unreadable responses stay unknown. Source is never executed or rendered as HTML.

The custom 100-point rubric assigns README 20, commit-message quality 15, code-maintenance practices 20, documentation 20, and automation/stewardship 25. Checks have explicit weights and proportional credit where appropriate. Profile score is 100 × earned / assessed weight across selected repositories, withheld below 60% weighted evidence coverage. Bounds substitute unknown checks with all-fail versus all-pass; these are not statistical confidence intervals and exclude sampling/heuristic error. Category percentages are independent, not additive. Downloads include scoring version, selection scope, evidence, weights, coverage, bounds and improvement priorities.

Commit counts, dates, stars and followers earn no points. At least three non-merge authored commits are required to assess message patterns. English/Arabic headings and Markdown setext headings are recognized. Each section must contain its own content; fenced examples and HTML comments cannot impersonate headings. Incomplete documentation samples do not establish absence. Workflow outcomes use the newest observed run per workflow; configuration alone cannot prove checks pass. Code style proxies contribute only four points, and neither they nor configuration paths prove clean code, security, authorship or proficiency. No AI model, developer ranking or job-market data is used.

A full six-repository analysis uses at most 56 requests. The public unauthenticated API permits 60 requests/hour per IP; other activity can consume this budget. Requests are serial. Genuine rate limits honor Retry-After/reset headers with a minimum one-minute cooldown; ordinary permission denials affect only the denied resource. Successful responses are cached in page memory for five minutes (at most 80 entries); failed requests are not cached, so a later analysis can resume missing evidence. Changing credentials isolates the cache. An optional public-read GitHub token is sent only to api.github.com, never persisted or exported. No token is embedded in source. Failed refreshes preserve the previous report. Private work and other-owner contributions are outside the sample. Custom weights and thresholds are product choices awaiting human calibration, not empirically validated accuracy claims. See [primary-source research and limitations](docs/careerlens-scoring-research.md).

CareerLens checks:

```sh
npm run test:ci -- --include=src/app/features/career/github-analysis.spec.ts
npm run test:ci -- --include=src/app/features/career/github-score.spec.ts
npx playwright test e2e/careerlens.spec.ts
```

The browser tests use GitHub fixtures for reproducible success, validation, rate-limit and empty-account cases. Set `INTEGRATION_WEB_PORT` to a free port if the default test port 4292 is occupied.

Career paths are available before analysis and in the report’s **Career path** tab. Choose Software Engineer, AI Engineer, ML/Data Science, Frontend, Backend, DevOps or QA. The deterministic planner expands a curated prerequisite graph, orders prerequisites before dependents, then prioritizes observed related check gaps, unknown evidence and observed indicators. Stable IDs break ties. Every milestone has an original project deliverable, an evidence explanation and a verified roadmap.sh resource link. This is a CareerLens curriculum, not a copy of roadmap.sh’s graph or an affiliated integration.

AI application engineering includes model APIs, retrieval, adversarial evaluation, permissions and cost/latency checks. ML includes statistics, data leakage prevention, baselines, model evaluation and drift. Source import signatures for selected AI/data libraries are collected only from the already sampled source files, adding no API requests. These are heuristic text matches, not dependency execution or proof of expertise; language metadata alone never implies AI competency.

Milestones are never completed automatically. Users explicitly self-validate deliverables; prerequisites gate downstream validation. Unchecking a prerequisite clears dependent validation. Changing focus or analyzing another profile resets the session checklist. JSON reports include the selected focus, ordered milestones, evidence, self-validation and capstone. No completion-time estimate or hiring-readiness claim is made. Planner version: 1.0. Reference links were checked on 2026-10-01: [AI Engineer](https://roadmap.sh/ai-engineer), [AI/Data Scientist](https://roadmap.sh/ai-data-scientist), [Software Architecture](https://roadmap.sh/software-design-architecture), [Computer Science](https://roadmap.sh/computer-science), [Backend](https://roadmap.sh/backend), [Frontend](https://roadmap.sh/frontend), [DevOps](https://roadmap.sh/devops), [QA](https://roadmap.sh/qa), [Python](https://roadmap.sh/python), [SQL](https://roadmap.sh/sql), [Git](https://roadmap.sh/git-github), [System Design](https://roadmap.sh/system-design).

The `/readme` route provides **Start readme now !**, a signal-based profile README builder. It creates Markdown from user-entered biography, tools, learning goals, up to six projects and a portfolio URL. It includes a safe structured preview, copy/download controls and GitHub publishing instructions. Ten majors and career focuses offer curated technology badge suggestions, with cross-major search, explicit selection and removal. Selected badges appear in preview and export using [Shields.io static badges](https://shields.io/badges/static-badge); these describe technologies, not verified certifications. Badge images load from Shields.io, but the builder performs no GitHub API requests and does not persist drafts or publish to GitHub; copy or download before leaving. Invalid links block export, and user text is escaped as Markdown rather than interpreted as HTML.
