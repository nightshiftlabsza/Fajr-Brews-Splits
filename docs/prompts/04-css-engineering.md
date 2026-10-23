# Prompt 4: CSS and frontend engineering quality

Branch: `prompt/04-css-engineering`, cut from the integration branch after prompts 1 and 2 are merged.

## Objective
Make the styling layer coherent, token-driven and safe to change, without changing how the app looks (Prompts 5 and 6 change the look afterwards). Fix responsive and layout defects that are engineering faults rather than design choices.

## Verified context
- `src/styles/globals.css` is 2027 lines with only 7 `@media` blocks; `tokens.css` (254 lines) defines theme variables for 3 themes plus light/dark; `print.css` 123 lines. No CSS framework, no CSS modules, no `!important`. AGENTS.md rule: use `var(--color-*)`/`var(--font-*)`, no hard-coded colours, no new styling libraries.
- Largest components: `CoffeeLotsSection.tsx` 1453 lines, `HistoryPage.tsx` 805, `OrderPage.tsx` 744, `GoodsAndFees.tsx` 448, `Header.tsx` (has a test).
- Component tests exist for Header, CoffeeLotsSection, OrderSetup, OrderSummary, HistoryPage, MyStatsPage.

## Rendering without a backend
The app throws at import without `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` and there is no safe database. Use dummy env values (a throwaway `.env.local` with placeholder URL and key is fine; never real ones) and serve fixture data: intercept the Supabase REST/auth/realtime requests in the browser (for example Playwright `page.route` from a scratch directory outside the repo, installed with `npx` and not added to `package.json`) or add a temporary local-only harness that you delete before committing. Fixtures must cover: signed-in owner and ordinary member, 0, 1 and 3 active orders in different statuses, long names, an order with many lots and people. Nothing from this harness is committed. State exactly how you did it.

## Investigate
1. Measure first: count hard-coded colours/px/z-index values, duplicate or dead selectors (find selectors matching no class used in `src/`), conflicting rules for the same element, specificity fights, inline `style={{}}` usage in TSX, magic numbers for breakpoints.
2. Run the app at 360, 390, 768, 1024, 1440 px widths, in all 3 themes and light and dark: capture screenshots of Order (each wizard step), People, My Stats, History, Settings, Auth, and modals. List concrete defects: horizontal overflow, clipped text, unreachable buttons, tap targets under 44 px, sticky elements covering content, unreadable contrast, focus states missing, themes with unset variables.
3. Check keyboard focus order and visible focus on interactive elements, and `prefers-reduced-motion`.

## Scope
- Consolidate colours, spacing, radii, shadows, z-index and breakpoints into `tokens.css` variables; remove hard-coded values, dead and duplicate rules. Split `globals.css` into a few clearly named files by area (e.g. base, layout, order, history, modals) imported from `App.tsx`, only if it reduces risk; keep the cascade order identical.
- Fix the engineering-level defects found in step 2. Move inline styles to classes where they cause inconsistency.
- Visual output at the five widths must be unchanged apart from the defect fixes. No redesign, no new animations, no new dependencies, no behaviour changes.
- Do not restructure TSX beyond class names and removing inline styles. Do not touch `pdf.ts` or store logic.

## Additional requirements (owner brief)
- Diagnose before editing: record causes and affected files for duplicate/conflicting rules, fragile selectors, specificity fights, repeated UI patterns that deserve shared components, layout techniques causing clipping/overlap/unexpected scroll, unnecessary abstractions.
- Fix layout problems at their source: no arbitrary overflow rules, fixed heights or z-index escalation to hide defects.
- No new UI framework, styling library or build dependency; if you believe one is justified, stop and ask with the concrete benefit and cost.
- Do not invent a visual direction: Prompts 5 and 6 own it and run after you. Final diff review for duplicate rules, dead code, accidental logic changes.
- Report remaining technical debt.

## Acceptance criteria
- Before/after counts: hard-coded colours, `style={{` occurrences, total CSS lines, dead selectors removed.
- Before/after screenshots at the five widths for Order and History in each theme saved in `docs/evidence/04-css/` and a short list of visible differences (should be only the defect fixes).
- Zero horizontal overflow at 360 px on every page (state how you checked).
- Contrast of text on its background meets WCAG AA for the default theme in light and dark (list any exceptions).
- Gate passes; existing component tests unchanged and green.

## Ground rules (all prompts)
- Repo: Fajr Brews Splits (React 18, TS strict, Vite, Zustand, Supabase, jsPDF, Vitest). Read `AGENTS.md` and `docs/PROJECT_BRIEF.md` first; they are binding. Money rule is in `README.md`.
- You have high autonomy: investigate, delegate independent read-only investigations to sub-agents if available, refactor where demonstrably necessary, fix, test, and re-verify without asking. Do not let multiple agents edit the same file at once.
- Work only on your own branch. Do not push to or merge into `main`.
- Never use production Supabase credentials or data. Use mocked data only; there is no staging backend and `.env.local` must not point at the live project. Limit browser evidence to what mocks allow; do not fake it.
- Never: apply SQL migrations anywhere, change RLS or auth config, rotate or print secrets, delete or rewrite data, change deploy settings, add dependencies (unless this prompt says so), skip or loosen tests.
- No filler comments, speculative abstractions, dead code or unrequested features.
- Gate after final edit, from a clean state: `npm run typecheck && npm test && npm run build`. Paste real output.
- Screenshots: save under `docs/evidence/<prompt>/` only if asked below; otherwise describe what you inspected. Do not commit `.env*`, PDFs with real names, or secrets.
- Rollback: one coherent commit series on your branch; state the base commit hash and that `git revert`/branch deletion restores the baseline.

## Report (end with exactly this, concise)
1. Files changed (added/modified/deleted).
2. Diff summary per file, one or two lines.
3. Commands run with real output tails (typecheck, test counts, build).
4. Acceptance criteria: each marked met / partially / not met, with evidence (test name, file:line, screenshot path).
5. Verified vs partially verified vs unverified behaviour, stated separately.
6. Skipped, uncertain, deviations from this prompt, unresolved defects.
