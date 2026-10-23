# Mission 1: UI/UX redesign (Wave 2, after Mission 2)

Branch: `mission/1-ui-ux`, cut from the integration branch after Missions 4, 5 and 2 are merged.

## Objective
A coherent, calm, professional interface that makes the group's core job obvious: see the active order(s), know what is mine to do next, enter coffee and costs without confusion, and see what everyone owes. Usefulness first; no decoration for its own sake.

## Design guidance
Inspect the current official docs of `github.com/Leonxlnx/taste-skill`, decide whether it suits redesigning an existing app screen set (say so in the report), and if so install and read the front-end skill (`github.com/Leonxlnx/taste-skill`, skill `design-taste-frontend`, v2.1 includes dashboards and app screens): `npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"` (needs Node 22+). If Antigravity cannot load it, clone the repo outside this project and read its `SKILL.md` and references directly. Apply its principles, but this project's constraints override it: no new dependencies, no images fetched from the internet, no gradients or glassmorphism, no animation beyond subtle state transitions, no decorative card stacks. Do not install anything into the repo.

## Verified context
- Tabs: `order`, `people`, `my-stats`, `history`, `settings` (`App.tsx`, `components/layout/Header.tsx`). Three themes + light/dark in `styles/tokens.css`; use variables only.
- Active-order experience: `OrderPage.tsx` (744 lines) with wizard steps `OrderSetup` -> `CoffeeLotsSection` (1453 lines) -> `GoodsAndFees` -> `SettlementPacks` -> `OrderSummary`; multiple active orders selected via `currentOrderId`; `lib/orderLifecycle.ts` labels (Planning, Locked, Completed, Past order). A recent commit introduced an "order cockpit" summary.
- Mission 2 has already centralised tokens and CSS structure; extend them rather than bypass them.

## Investigate first
0. Before changing anything, run the app against staging and capture baseline screenshots (390, 768, 1440 px; default theme, light and dark) of every page and wizard step, with 1, 3 and 0 active orders. Inspect them, document layout defects and their causes, and record the brand identity and behaviours that must be preserved. No generic redesign: understand the product first. If your tooling supports it, use independent reviewers for visual design, mobile usability and order workflows.
1. Walk each primary user journey in a real browser against staging as three roles (owner, ordinary member, pending-access user): start an order; add my share of a lot; see what I owe; open/share my invoice; check history; invite or link a person. Record each point of friction (extra taps, unclear labels, hidden state, dead ends, jargon like "inference", "settlement packs", ambiguous statuses).
2. Check how multiple simultaneous active orders are presented: can I tell at a glance which order I am in, its status, my part, and switch safely on mobile?
3. Produce a short ranked list (max 12) of the highest-value changes before editing. Implement in that order until done; discard changes that add polish without reducing friction.

## Scope
- Change layout, hierarchy, labels, empty states, error and loading states, navigation, mobile ergonomics (thumb reach, sticky actions, 44 px targets), and visual consistency across all pages and modals.
- May restructure presentational TSX and split oversized components when it serves the above. Business logic stays in `src/lib` and the store; do not alter calculations, the rounding rule, data shapes or SQL.
- No new features. No renaming of data fields. Keep all existing capabilities reachable.
- Do not touch `pdf.ts`/invoice PDF layout (Mission 5), only the on-screen styling around it.

## Design objectives (owner brief)
- The active order is unmistakable at first glance; several simultaneous orders are easy to tell apart and switch between.
- Clear hierarchy for status, lots, quantities, prices, actions. No overlaps, clipping, cramped controls or unexplained whitespace. Mobile is first-class.
- Standardised spacing, type, colour, buttons, fields, status indicators. Do not invent order states or change the lifecycle (`planning|locked|completed|archived`); label what exists.
- Avoid decorative gradients, glassmorphism, oversized rounded cards, excess panels, random icons, needless animation.
- Check long content, narrow screens, multiple in-progress orders, empty, loading and error states; fix the worst defects found in screenshot review, then re-inspect.

## Acceptance criteria
- The ranked friction list with a before/after note for each item implemented.
- Screenshots before and after for: Order (every step), multi-order switcher, People, My Stats, History, Settings, Auth, one modal; at 390 px and 1440 px, default theme light and dark, plus one other theme. Save in `docs/evidence/1-ui/` and inspect each one yourself; report any flaw you see and fix it.
- Journey walkthroughs repeated after changes with results (pass/fail per step).
- No horizontal overflow at 360 px; AA text contrast; visible focus states; reduced-motion respected.
- Component tests updated for changed markup (never weakened); gate passes.

## Ground rules (all missions)
- Repo: Fajr Brews Splits (React 18, TS strict, Vite, Zustand, Supabase, jsPDF, Vitest). Read `AGENTS.md` and `docs/PROJECT_BRIEF.md` first; they are binding. Money rule is in `README.md`.
- You have high autonomy: investigate, delegate independent read-only investigations to sub-agents if available, refactor where demonstrably necessary, fix, test, and re-verify without asking. Do not let multiple agents edit the same file at once.
- Work only on your own branch. Do not push to or merge into `main`.
- Never use production Supabase credentials or data. Run the app only against the staging project in `.env.local`, or mock. If no staging backend exists, say so and limit browser evidence to what mocks allow; do not fake it.
- Never: apply SQL migrations anywhere, change RLS or auth config, rotate or print secrets, delete or rewrite data, change deploy settings, add dependencies (unless this mission says so), skip or loosen tests.
- No filler comments, speculative abstractions, dead code or unrequested features.
- Gate after final edit, from a clean state: `npm run typecheck && npm test && npm run build`. Paste real output.
- Screenshots: save under `docs/evidence/<mission>/` only if asked below; otherwise describe what you inspected. Do not commit `.env*`, PDFs with real names, or secrets.
- Rollback: one coherent commit series on your branch; state the base commit hash and that `git revert`/branch deletion restores the baseline.

## Report (end with exactly this, concise)
1. Files changed (added/modified/deleted).
2. Diff summary per file, one or two lines.
3. Commands run with real output tails (typecheck, test counts, build).
4. Acceptance criteria: each marked met / partially / not met, with evidence (test name, file:line, screenshot path).
5. Verified vs partially verified vs unverified behaviour, stated separately.
6. Skipped, uncertain, deviations from this prompt, unresolved defects.
