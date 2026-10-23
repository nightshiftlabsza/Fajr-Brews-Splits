# Prompt 5: UI/UX redesign, desktop first

Branch: `prompt/05-ui-desktop`, cut from the integration branch after Prompts 1, 2 and 4 are merged.

## Objective
Make the desktop interface (1024 px and wider, with 768 px tablet checked) coherent, calm and professional, so the group's core job is obvious: see the active order(s), know what is mine to do next, enter coffee and costs without confusion, and see what everyone owes. Desktop only: do not optimise phone layouts here (Prompt 6 does that afterwards), but do not break them: below 768 px nothing may get worse than baseline.

## Design guidance
Inspect the current official docs of `github.com/Leonxlnx/taste-skill`, decide whether it suits redesigning an existing app screen set (say so in the report), and if so install and read the front-end skill (`github.com/Leonxlnx/taste-skill`, skill `design-taste-frontend`, v2.1 includes dashboards and app screens): `npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"` (needs Node 22+). If Antigravity cannot load it, clone the repo outside this project and read its `SKILL.md` and references directly. Apply its principles, but this project's constraints override it: no new dependencies, no images fetched from the internet, no gradients or glassmorphism, no animation beyond subtle state transitions, no decorative card stacks. Do not install anything into the repo.

## Verified context
- Tabs: `order`, `people`, `my-stats`, `history`, `settings` (`App.tsx`, `components/layout/Header.tsx`). Three themes + light/dark in `styles/tokens.css`; use variables only.
- Active-order experience: `OrderPage.tsx` (744 lines) with wizard steps `OrderSetup` -> `CoffeeLotsSection` (1453 lines) -> `GoodsAndFees` -> `SettlementPacks` -> `OrderSummary`; multiple active orders selected via `currentOrderId`; `lib/orderLifecycle.ts` labels (Planning, Locked, Completed, Past order). A recent commit introduced an "order cockpit" summary.
- Prompt 4 has already centralised tokens and CSS structure; extend them rather than bypass them.

## Rendering without a backend
The app throws at import without `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` and there is no safe database. Use dummy env values (a throwaway `.env.local` with placeholder URL and key is fine; never real ones) and serve fixture data: intercept the Supabase REST/auth/realtime requests in the browser (for example Playwright `page.route` from a scratch directory outside the repo, installed with `npx` and not added to `package.json`) or add a temporary local-only harness that you delete before committing. Fixtures must cover: signed-in owner and ordinary member, 0, 1 and 3 active orders in different statuses, long names, an order with many lots and people. Nothing from this harness is committed. State exactly how you did it.

## Investigate first
0. Before changing anything, capture baseline screenshots at 1440, 1280 and 1024 px (plus 768) in the default theme, light and dark, of every page and wizard step, with 0, 1 and 3 active orders. Inspect them, document layout defects and causes, and record the brand identity and behaviours that must be preserved. No generic redesign: understand the product first. If your tooling supports it, use independent reviewers for visual design and order workflows.
1. Walk each primary journey as owner, ordinary member and pending-access user: start an order; add my share of a lot; see what I owe; open/share my invoice; check history; invite or link a person. Record each friction point (extra clicks, unclear labels, hidden state, dead ends, jargon like "inference" or "settlement packs", ambiguous statuses).
2. Check how multiple simultaneous active orders are presented: can I tell at a glance which order I am in, its status, my part, and switch safely?
3. Produce a ranked list (max 12) of the highest-value changes, then implement in that order; discard changes that add polish without reducing friction.

## Design objectives (owner brief)
- The active order is unmistakable at first glance; several simultaneous orders are easy to tell apart and switch between.
- Clear hierarchy for status, lots, quantities, prices, actions. No overlaps, clipping, cramped controls or unexplained whitespace.
- Standardised spacing, type, colour, buttons, fields, status indicators. Do not invent order states or change the lifecycle (`planning|locked|completed|archived`); label what exists.
- Avoid decorative gradients, glassmorphism, oversized rounded cards, excess panels, random icons, needless animation.
- Preserve useful functionality and familiar workflows; no new features, no data-field renames, no changes to calculations, the rounding rule, data shapes or SQL. Business logic stays in `src/lib` and the store. Do not touch `pdf.ts`/invoice PDF layout (Prompt 2).

## Scope
Layout, hierarchy, labels, empty/error/loading states, navigation and visual consistency across all pages and modals on desktop. May restructure presentational TSX and split oversized components when it serves this.

## Acceptance criteria
- The ranked friction list with a before/after note for each implemented item.
- Before and after screenshots at 1440 and 1024 px for: Order (every step), multi-order switcher, People, My Stats, History, Settings, Auth, one modal; default theme light and dark plus one other theme. Save in `docs/evidence/05-ui-desktop/`, inspect each yourself, report and fix any flaw, re-inspect.
- Journey walkthroughs (mocked data) repeated after changes, pass/fail per step.
- AA text contrast, visible focus states, keyboard reachability, reduced-motion respected.
- Phone widths (390) are no worse than baseline (screenshot comparison).
- Component tests updated for changed markup (never weakened); gate passes.

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
