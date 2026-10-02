# Profile README builder

Open `/readme` for the signal-based, OnPush Angular wizard.

## Authoring

One card walks through two steps:

1. Enter name, GitHub username and major.
2. Choose whether to showcase projects, optionally add LinkedIn, then click **Build my README with AI**.

AI drafts the personal brief, current work, highlights, learning interests, collaboration copy and project summaries using public GitHub evidence, with a few relevant emojis. The server enforces the project opt-out while still using repository evidence for the introduction. Suggested framework logos come from observed technologies, not the major alone.

The result offers preview, Markdown, copy and download. **Edit my README** reveals the prose, project and contact fields. LinkedIn renders as a clickable icon. Users can remove projects and suggested badges, change their answers or undo a generated draft before making further edits. The former badge studio, checklist, appearance panels and per-field AI interface are removed.

Drafts autosave under `careerlens.readme.v1` in browser localStorage; reloading a completed draft opens its output. Clearing site storage removes it. Existing drafts remain compatible. Preview and export share a section model with escaped text and safe links; user content is never inserted as HTML.

Technology logos use [Skill Icons](https://github.com/tandpfun/skill-icons), pinned Devicon SVGs and Simple Icons. Exported logos link to GitHub topics. Expandable output sections use GitHub-supported details markup; there is no exported JavaScript or custom CSS. Generated banners use [Capsule Render](https://github.com/kyechan99/capsule-render), which receives the display name and headline in its image URL. External image providers can be unavailable and receive image requests, never API credentials. GitHub controls final page typography.

## OpenAI on Vercel

The optional assistant calls `POST /api/readme-ai`. Only the server reads the API key.

In the Vercel project's **Settings → Environment Variables**, configure:

| Variable                    | Value                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `OPENAI_API_KEY`            | Your OpenAI project API key (required for AI)                                                                |
| `OPENAI_README_MODEL`       | Optional; defaults to `gpt-5-nano`                                                                           |
| `README_AI_ALLOWED_ORIGINS` | Optional comma-separated exact origins for additional trusted frontend origins; same-origin works by default |

Enable the variables for the deployment environments you use, then redeploy. Do not place the key in Angular environment files, public-prefixed variables, browser code, or Git. `.env.example` contains names only; real `.env` files are ignored.

`vercel.json` builds the Angular production bundle into `dist/monorepo/browser` and retains the Node API route alongside SPA routes. `ng serve` alone does not run Vercel Functions. For local AI integration, use `vercel dev` with a local server environment key. Browser tests mock the endpoint and do not consume API credits.

The default is the low-cost [GPT-5 nano model](https://developers.openai.com/api/docs/models/gpt-5-nano). OpenAI usage is paid and subject to account quota. Custom models must support Responses API structured outputs and `reasoning.effort: minimal`; incompatible model overrides fail with a configuration message.

## Review and data flow

Full generation reads the public GitHub profile and up to 30 recently pushed repositories, then selects at most three non-fork, non-archived, public repositories, excluding the repository named after the account. For each selected repository it reads the language breakdown and up to 6,000 characters of README text. At most eight GitHub requests are made per uncached generation. Repository content is data for the model, never executed or followed as instructions. This is a sample, not an exhaustive account audit.

GitHub evidence is cached per server instance for ten minutes, with at most 100 accounts. Requests stop on a supplementary rate-limit error and disclose incomplete evidence. Missing accounts and initial GitHub failures stop before the paid AI call. Optionally set the server-only `GITHUB_README_TOKEN` for a higher API allowance; no token input is needed from users. Only public account endpoints are read. Tokens are never sent to the model or browser.

OpenAI receives the entered name and major, public biography, sampled repository metadata, language names and README excerpts. It selects suggested tools only from the observed candidates; the server filters unsupported tool claims and unknown project IDs, and constructs project links from GitHub evidence rather than model-generated URLs. Repository ownership does not establish sole authorship or proficiency. Learning/collaboration copy is aspirational, and every result should be reviewed before publishing. Unsupported achievements and outcomes may remain empty rather than being invented. Accounts without eligible projects receive a major-based introduction and learning suggestions without fabricated projects or badges.

The API uses `store: false`, which does not promise zero provider retention under every OpenAI account policy. Drafts autosave only in this browser. The legacy refinement API remains compatible, but is no longer exposed in the wizard.

Generation caps model output at 3,800 tokens, GitHub lookup at 12 seconds and OpenAI at 30 seconds. Vercel allows 60 seconds; the browser times out at 55 seconds. Per-field refinement retains its 2,200-token cap and shorter timeout. No automatic retries occur. Schema validation, fixed upstream endpoints and no-store responses apply to both modes. Errors leave the current draft unchanged.

Same-origin checks and a best-effort per-instance limit of five calls per ten minutes reduce accidental misuse. They are **not authentication or a global spending cap**: instances do not share the counter, and non-browser clients can supply Origin headers. For a public deployment, configure shared rate limiting or authenticated quotas and monitor OpenAI usage. Saved drafts remain editable if AI is unavailable.

## Verification

```sh
npm run test:readme
npm run typecheck:readme
npm run test:readme:function
npm run lint
npm run build:prod
npx playwright test e2e/readme.spec.ts
```

Server tests use an injected fake upstream. Browser tests cover the two-step wizard, project opt-out, safe preview/export, saved drafts, undo, LinkedIn icons, mobile layout and plain-text server failures. A real OpenAI response must be verified after the deployment has its key; automated tests do not assert live provider availability.

The function smoke check transpiles the server files using the root TypeScript settings and starts them in plain Node, without tsx's import resolution or automatic ESM detection. It copies the root package's module type rather than supplying its own. The root `package.json` must declare `"type": "module"`, and server imports must include their emitted `.js` extensions because `module: preserve` retains ES imports. Missing the package declaration causes `Cannot use import statement outside a module`; extensionless imports cause `ERR_MODULE_NOT_FOUND`. Either can produce Vercel's `FUNCTION_INVOCATION_FAILED`. After updating these files, redeploy the function; the Angular dev server cannot verify that deployment. Plain-text platform failures produce a readable client message without exposing JSON parser errors or changing the draft.
