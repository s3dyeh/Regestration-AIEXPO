# Profile README builder

Open `/readme` for the signal-based Angular editor. Manual editing needs no GitHub token or AI account.

## Authoring

Framework logos are the default badge appearance, including when restoring older drafts. All 41 catalog tools have a logo mapping: [Skill Icons](https://github.com/tandpfun/skill-icons) provides most logo tiles, with pinned Devicon SVGs via jsDelivr and Simple Icons for the remaining tools. The picker always shows the recognizable logos. The preview and README export display clickable 48px logos with accessible names; Text badges remains an optional appearance. These external image providers receive image requests, not API credentials.

The quick-start path requires only a GitHub username and career focus. Choose Botanical, After hours or Daybreak, then click **Create my profile**. It uses the username as the initial display name, fills empty introduction fields, selects portfolio navigation and enables a generated banner and expandable learning sections. It does not invent projects, achievements or tool proficiency. Add a focus badge pack separately and remove tools you do not use. The detailed editor is collapsed until needed.

The badge studio has live visual selection, curated logos, four styles, theme-matched colors and links to GitHub topics in the exported README. Expandable sections use [GitHub-supported details markup](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/organizing-information-with-collapsed-sections); there is no exported JavaScript or custom CSS. Theme colors apply to banner and badge images; GitHub controls its own page typography and heading colors.

Generated banners use [Capsule Render](https://github.com/kyechan99/capsule-render) with URL-encoded display name and headline, and send those values to its public image endpoint. This third-party service is best-effort and can be unavailable. The preview reports image failures; custom image URLs in older drafts remain supported and take precedence; their entry section has been removed, and a removal button is available for saved custom banners. Badges use [Shields.io](https://shields.io/badges/static-badge). Both image providers load independently of the optional OpenAI assistant. Theme, badge style and quick-start preferences are included in saved drafts; older version-1 backups receive defaults for the new settings.

- Classic or portfolio layout, with shared section ordering for preview and Markdown. Portfolio includes section navigation.
- Introduction, location, current work, highlights, tools, learning goals, collaboration, website and LinkedIn.
- Up to six projects with descriptions, links and individual contributions/outcomes.
- Major-specific badge suggestions, cross-major search, banner image and accessible alt text.
- Section visibility controls retain hidden content. Empty sections are omitted.
- A deterministic six-item content checklist offers writing prompts; it does not rate competence or verify claims.
- A starter fills only empty introduction fields. Review and personalize its aspirational text.
- Local autosave, versioned JSON backups and validated restore. Restoring replaces the current draft; download a backup first if needed. Draft data is stored under `careerlens.readme.v1` in browser localStorage. Avoid private information on shared devices; clearing this site's browser storage removes the saved draft.
- Escaped Markdown and a structured preview: user text is never inserted as HTML. Preview typography may differ from GitHub. External banner and badge images load from their respective hosts.

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

AI runs only when the user clicks the suggestion button. The request sends focus, tone, prose, technologies, project names, descriptions and outcomes. It excludes dedicated display-name, username, link, banner and token fields. Personal information typed inside prose is still sent. The server requests `store: false`; this does not promise zero provider retention under every OpenAI account policy.

The model is instructed to use supplied facts only, preserve learning status and avoid invented credentials or results. These instructions do not verify factual accuracy. Each suggestion shows the original, replacement and reason. Nothing changes until Apply. Suggestions become unavailable when their target text changes. Undo restores the most recent AI edit only while that text is unchanged.

The endpoint validates requests and structured responses, filters unknown project IDs and invalid field targets, caps the request at 24 KB and output at 2,200 tokens, times out upstream at 25 seconds, and never automatically retries. The browser times out at 30 seconds. Errors are sanitized, and requests/responses are not logged by this implementation.

Same-origin checks and a best-effort per-instance limit of five calls per ten minutes reduce accidental misuse. They are **not authentication or a global spending cap**: serverless instances do not share the in-memory counter, and non-browser clients can supply an Origin header. For a public deployment, configure a shared Vercel Firewall rate-limit rule for `/api/readme-ai` or add authenticated quotas. Monitor OpenAI usage and configure account budget alerts separately. The manual builder remains usable when AI is disabled or unavailable.

## Verification

```sh
npm run test:readme
npm run typecheck:readme
npm run test:readme:function
npm run lint
npm run build:prod
npx playwright test e2e/readme.spec.ts
```

Server tests use an injected fake upstream. Browser tests cover safe preview/export, autosave and backup restoration, layout visibility, suggestion review, stale edits, undo and quota failures. A real OpenAI response must be verified after the deployment has its key; automated tests do not assert live provider availability.

The function smoke check transpiles the server files using the root TypeScript settings and starts them in plain Node, without tsx's import resolution. Server imports must include their emitted `.js` extensions because this project's `module: preserve` configuration retains ES imports. Extensionless imports can compile successfully yet crash at startup with `ERR_MODULE_NOT_FOUND` and Vercel's `FUNCTION_INVOCATION_FAILED`. After updating these files, redeploy the function; the Angular dev server cannot verify that deployment. Plain-text platform failures now produce a readable client message without exposing JSON parser errors or changing the draft.
