# Start learning Git

The complete English/Arabic Git workshop is integrated at `/learn-git`. Its engine and all 30 challenges were recovered from the supplied `git_workshop` repository at commit `4c62f53` because its copied working tree lacked the source files. The original folder was not modified.

Localization uses `@jsverse/transloco` and standalone `TranslocoPipe` imports, with a route-local service and bundled `i18n/en.json` and `i18n/ar.json` catalogs. Arabic remains the default. The language selector persists its preference separately under `careerlens.git-learning.language`; blocked storage does not prevent switching. A signal derived from Transloco's language stream drives `lang` and `dir`, and document attributes are restored when leaving the workshop. Layout uses logical spacing and borders, with deliberate LTR islands for Git commands, file contents, and commit graphs. Both catalogs load with the lazy route so switching works offline after the workshop has loaded.

Curriculum titles, instructions, hints, requirements and explanatory domain events carry stable translation keys; the pure reducer does not depend on Angular or the active language. Command output and user-authored file contents remain unchanged. Templates translate at display time, and the command guide searches the active language's translated descriptions. Catalog tests verify key/parameter parity and message references; browser coverage completes all 30 English lessons, checks the Arabic journey, persistence, RTL/LTR, and unchanged learning state across language switches.

The lazy-loaded Angular route renders the workshop directly, with no iframe or React runtime. Source lives in `src/app/features/git-learning`: `domain` contains the pure Git simulation, `curriculum` contains the challenges and reference, `state` contains the immutable reducer and route-scoped signal store, and `ui` contains standalone OnPush components. Read-only computed signals drive repository views, completion, drafts and progress. Signal inputs/outputs connect components; linked signals reset terminal controls at challenge checkpoints. Effects are reserved for persistence and phased DOM focus/scroll work. The store is destroyed when leaving the route and flushes its journal before cleanup. Local fonts and their licenses live in `public/assets/git-learning`. The normal Angular build includes everything.

All original functionality remains: staged and working snapshots; command history and Tab completion; 30 outcome-gated challenges in one repository; branch/commit graphs and inspection; merge conflicts, abort and retry; remote fetch/pull/push simulation; amend, soft reset, restore and revert; stash save/apply/drop/pop and conflicts; one-action-at-a-time solutions; challenge checkpoints; group resets; display size, reduced motion and fullscreen controls.

Enhancements:

- Homepage links and a dedicated learning section, plus a return link to CareerLens.
- Automatic browser-local resume of repository state, drafts, challenge progress, command history and preferences.
- A versioned, validated action journal. Corrupt/incompatible progress starts a fresh round with a notice. Storage failure never blocks the workshop.
- A 30-challenge course outline and Arabic command/concept reference.
- Ctrl/Command + Enter saves the current editor draft; saving still does not stage or commit.
- Mobile layout, keyboard skip link and visible completion progress.
- A signal-driven learning panel with course percentage, the next unfinished goal, and per-challenge hints that never execute commands.
- Live counts for unsaved drafts, unstaged/staged files and commit objects, with keyboard-friendly jumps to the terminal and editor.
- Search the command guide by Arabic concept or Git command, with empty-state recovery and focus restoration.

Progress uses `careerlens.git-learning.v1` in localStorage. It is device/browser-specific and not synchronized between tabs or accounts. The journal limits saved sessions to 1,500 actions / 1 MB; sequential draft edits are coalesced. If storage cannot save, the UI explains that the current page must stay open. A confirmed new-group reset compacts the journal and retains display preferences.

Run from the repository root:

```sh
npm run build:prod
npm run typecheck:git-learning
npm run lint
npm run test:git-learning
npm run test:ci
npx playwright test e2e/git-learning-journey.spec.ts e2e/git-learning-integration.spec.ts
```

The simulation runs entirely in the browser once its local assets load, without Git, GitHub or internet access. It is not an operating-system shell. Commit IDs are educational, merge semantics are bounded, and hard reset/force push/rebase are not implemented. The lab blocks rewriting published history as a teaching guardrail; real Git permits it. Stash conflict recovery uses an ordinary one-parent commit; merge abort is separate.
