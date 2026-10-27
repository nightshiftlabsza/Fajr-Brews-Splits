# Prompt 11: Fast startup (stop preloading the PDF library, parallel startup queries)

Branch: `prompt/11-fast-startup`, cut from current `main`. Touches only `vite.config.ts`, `package.json`, `package-lock.json`, `src/store/appStore.ts` (the `initialize` action only) and `src/store/appStore.test.ts`. Safe to run alongside prompts 08, 09 and 10: none of them touch these files.

## Objective
The owner sees the "Fajr Brews" loading screen for too long every time the app opens (including when a phone browser reloads a background tab). Cut the two verified causes on the startup path:
1. The browser downloads the whole PDF library on every open, before any PDF is requested.
2. `initialize` fetches startup data one query after another instead of together.

## Verified context (checked by Claude on `main` at `cf7b216`)
- `npm run build` on `main` prints `pdf-*.js 358.62 kB │ gzip: 118.49 kB`, and `dist/index.html` contains `<link rel="modulepreload" ... href="/assets/pdf-*.js">`. The entry chunk starts with `import{_ as Xa}from"./pdf-*.js"`: Vite's preload helper was placed into the `pdf` manual chunk, so the entry chunk imports that chunk statically and the browser fetches all of jsPDF at startup.
- Cause: `vite.config.ts` `build.rollupOptions.output.manualChunks.pdf: ['jspdf', 'jspdf-autotable']`. `src/lib/pdf.ts:7` already loads jsPDF with `await import('jspdf')`, so the manual chunk is unnecessary.
- Claude removed that one line locally and rebuilt: the modulepreload for the PDF chunk disappears and jsPDF becomes its own lazy chunk (`jspdf.es.min-*.js`, 118 kB gzip) loaded only when a PDF is made. Startup JavaScript drops from about 275 kB to about 158 kB gzip (entry + vendor). Reproduce this; do not take it on trust.
- `jspdf-autotable` is a dependency but nothing in `src/` imports it (`grep -rn autotable src` returns nothing).
- `initialize` in `src/store/appStore.ts` (lines ~543-753), for a signed-in owner, runs: `getSession` → `Promise.all([workspace_members, resolve_my_person_link])` → `people` → `orders` (for a plain member also `get_my_participant_orders`, after the owned-orders query) → `roasters` → `_loadSettings` (`user_settings`). After the access check these queries do not depend on each other, but each waits for the previous one: 4 to 5 extra network round trips before the loading screen can go away.

## Required changes
1. `vite.config.ts`: delete the `pdf` entry from `manualChunks`. Keep the `vendor` entry.
2. Remove `jspdf-autotable` from `package.json` with `npm uninstall jspdf-autotable` so the lockfile updates. Do not touch any other dependency.
3. `initialize`: after the `workspace_members` / `resolve_my_person_link` step, issue every remaining startup query at the same time (one `Promise.all`): people; owner/admin orders, or the member's owned orders and, when `linkedPersonId` is set and the user cannot fetch all orders, `get_my_participant_orders`; roasters (members only); and settings. Then process the results in the same order and with exactly the same rules as today:
   - Any people, orders or participant-orders error still throws and ends in the same `error` state.
   - A roaster error still does not fail startup: it logs, sets `roasterFeatureStatus: 'unavailable'` and the same message from `getRoasterLoadFailureMessage`.
   - Settings: `PGRST116` (no row) is still fine; any other settings error still throws. The theme/mode is still applied to the DOM and localStorage before the final `set`.
   - Orders from both order queries are still merged by id through the same `Map`.
   - Realtime is still set up before the fetches start.
   - Users without workspace access still skip the data queries; settings handling for them must be unchanged.
   Keep `_loadSettings` as the single place that maps a settings row: either await it inside the `Promise.all`, or split its query from its mapping without duplicating the mapping. Pick whichever is the smaller diff.

## Constraints
- No change to what data is fetched, which columns, filters, RLS assumptions or the order of rows. Same queries, issued together.
- No change to the loading screen, `isLoading`/`isSyncing`/`isInitialized` semantics, the `initializePromise` de-duplication, or any UI file.
- No new dependencies, no new files except tests if you choose to put a new test in a new file (prefer `appStore.test.ts`).
- Do not touch `src/lib/pdf.ts`, the PDF output, or any money logic.

## Anti-patterns to avoid
- Do not add caching, localStorage snapshots, service workers, or lazy-loaded pages here. Those are separate decisions.
- Do not wrap everything in `Promise.allSettled` and swallow errors; the error behaviour above must stay identical.
- Do not add `React.memo`/`useMemo`/`useCallback` anywhere; rendering is not in scope.
- Do not move PDF chunking into a new hand-written `manualChunks` function. Deleting the entry is the fix.
- Do not change tests' expectations to make them pass.

## Verification required
1. Build evidence, before and after (run `npm run build` on the base commit and on your final commit). Paste both chunk tables and both `grep -E "script|modulepreload" dist/index.html` outputs. After: no modulepreload or static import of any jsPDF chunk from the entry; `grep -c 'from"./jspdf' dist/assets/index-*.js` prints 0.
2. A new test in `src/store/appStore.test.ts` that proves the queries run together: make the `people` query return a promise that you resolve manually, call `initialize()` for an owner, and assert that the `orders`, `roasters` and `user_settings` queries have already been requested before you resolve `people`. Run it against the unmodified `initialize` first and paste the failing output, then paste it passing.
3. Tests that the error rules still hold: a roaster error leaves `accessStatus: 'member'` and `roasterFeatureStatus: 'unavailable'` (existing test must still pass unchanged); a people error ends in `error` set and `isLoading: false`; a non-`PGRST116` settings error ends in `error` set. Add the last two if they do not already exist.
4. Prove PDFs still work: the existing `src/lib/pdf.test.ts` and `src/lib/pdf-scenarios.test.ts` pass, and in `npx vite preview` with mocked data (or, if mocks do not allow a signed-in view, by reasoning from the build output) the jsPDF chunk is requested only when a PDF is generated. State plainly which of the two you did.
5. Gate from a clean state after the final edit: `npm run typecheck && npm test && npm run build`. Paste real output with pass/fail counts.

## Stop conditions
Stop and report instead of guessing if: removing the manual chunk changes PDF output or breaks a PDF test; the `Promise.all` would require changing what a participant-only user can fetch; any existing test has to be edited for anything other than adding the new mock hooks it needs; or the work seems to need SQL, a live Supabase connection, or a new dependency.

## Completion report (AGENTS.md format, plus)
1. Files changed (added/modified/deleted).
2. Diff summary per file.
3. Commands run with real output: both build tables (before/after), both `index.html` greps, the failing-then-passing parallelism test, and the full gate.
4. Each acceptance criterion below: met / not met, with evidence.
5. Skipped or uncertain, including that real-network timing was not measured (no live backend).

## Acceptance criteria (Claude reviews against these)
- AC1: `dist/index.html` has no modulepreload for a jsPDF chunk; the entry chunk has no static import of it; entry+vendor gzip total is within 2 kB of 158 kB (Claude's local measurement).
- AC2: `jspdf-autotable` is gone from `package.json` and `package-lock.json`; no other dependency changed.
- AC3: after the access check, `initialize` issues people, orders (both kinds where they apply), roasters and settings in one `Promise.all`; shown by a test that fails on the old code and passes on the new.
- AC4: error and fallback behaviour unchanged (roaster soft failure, people/orders hard failure, settings `PGRST116` tolerated), each covered by a passing test.
- AC5: no file outside the five listed is changed; no UI, money or PDF code touched; no new comments that narrate code.
- AC6: gate passes with pasted output; test count is the baseline (424) plus only the new tests.

## Ground rules (all prompts)
- Read `AGENTS.md` and `docs/PROJECT_BRIEF.md` first; they are binding.
- Work only on your own branch. Do not push to or merge into `main`.
- Never use production Supabase credentials or data. Mocked data only; `.env.local` must not point at the live project.
- Never apply SQL, change RLS or auth config, print secrets, change deploy settings, add dependencies, or skip/loosen tests.
- Gate after final edit, from a clean state: `npm run typecheck && npm test && npm run build`. Paste real output.
- Rollback: one coherent commit series on your branch; state the base commit hash.
