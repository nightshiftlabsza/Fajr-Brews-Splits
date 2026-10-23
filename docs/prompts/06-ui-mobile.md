# Prompt 6: Mobile adversarial pass

Branch: `prompt/06-ui-mobile`, cut from the integration branch after Prompt 5 is merged.

## Objective
Act as a deeply sceptical mobile front-end engineer and nitpicker. Prompt 5 perfected the desktop; your job is to make every screen and workflow as functional and pleasant on a phone as on desktop, and to prove it by trying to break it. Do not redesign the desktop: keep its look, hierarchy and information architecture, and keep desktop screenshots unchanged except for defects you can show.

## Verified context
- Tabs: `order`, `people`, `my-stats`, `history`, `settings` (`App.tsx`, `components/layout/Header.tsx`). Three themes + light/dark in `styles/tokens.css`; use variables only.
- Active-order experience: `OrderPage.tsx` (744 lines) with wizard steps `OrderSetup` -> `CoffeeLotsSection` (1453 lines) -> `GoodsAndFees` -> `SettlementPacks` -> `OrderSummary`; multiple active orders selected via `currentOrderId`; `lib/orderLifecycle.ts` labels (Planning, Locked, Completed, Past order). A recent commit introduced an "order cockpit" summary.
- Prompt 4 has already centralised tokens and CSS structure; extend them rather than bypass them.

## Rendering without a backend
The app throws at import without `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` and there is no safe database. Use dummy env values (a throwaway `.env.local` with placeholder URL and key is fine; never real ones) and serve fixture data: intercept the Supabase REST/auth/realtime requests in the browser (for example Playwright `page.route` from a scratch directory outside the repo, installed with `npx` and not added to `package.json`) or add a temporary local-only harness that you delete before committing. Fixtures must cover: signed-in owner and ordinary member, 0, 1 and 3 active orders in different statuses, long names, an order with many lots and people. Nothing from this harness is committed. State exactly how you did it.

## Method
1. Baseline: screenshots at 360x640, 375x667, 390x844, 430x932 and landscape 844x390, plus 768x1024, default theme light and dark, every page, every wizard step, every modal, with 0, 1 and 3 active orders. Inspect every image.
2. Attack list, each checked on the real rendered page (not by reading CSS): horizontal overflow and clipped text; long names, long numbers and large ZAR amounts; 200% browser zoom and large system text; on-screen keyboard covering inputs or sticky actions; fixed/sticky headers and bars overlapping content or each other; tap targets under 44x44 px and targets too close together; hover-only affordances; scroll traps in modals and nested scroll areas; safe-area insets (notches, home bar); orientation changes; number/decimal keyboards on money and gram inputs (`inputmode`, comma decimals); autofill and password managers on auth; focus order and visible focus; contrast outdoors-level (AA minimum); table/list layouts that need horizontal scroll; share/copy/WhatsApp/email invoice buttons; the multi-order switcher (can I tell which order I am in and switch with a thumb?); loading, empty and error states; slow-network behaviour (throttle) for visible jank or layout shift.
3. Rank the defects (blocks task / hard to use / cosmetic), fix them root-cause first (no arbitrary overflow hiding, fixed heights or z-index escalation), re-run the full attack list after each batch. Stop only when a full pass finds nothing in the first two severity classes.

## Design objectives (owner brief)
- The active order is unmistakable at first glance; several simultaneous orders are easy to tell apart and switch between.
- Clear hierarchy for status, lots, quantities, prices, actions. No overlaps, clipping, cramped controls or unexplained whitespace.
- Standardised spacing, type, colour, buttons, fields, status indicators. Do not invent order states or change the lifecycle (`planning|locked|completed|archived`); label what exists.
- Avoid decorative gradients, glassmorphism, oversized rounded cards, excess panels, random icons, needless animation.
- Preserve useful functionality and familiar workflows; no new features, no data-field renames, no changes to calculations, the rounding rule, data shapes or SQL. Business logic stays in `src/lib` and the store. Do not touch `pdf.ts`/invoice PDF layout (Prompt 2).

## Scope
Responsive CSS, mobile-specific markup and behaviour, input modes, sticky/safe-area handling, mobile navigation. Presentational TSX only; business logic untouched.

## Acceptance criteria
- Defect table: id, screen, viewport, severity, root cause (file:line), fixed yes/no, evidence.
- Before and after screenshots for every page and wizard step at 390 and 360 px (and landscape for Order), default theme light and dark, saved in `docs/evidence/06-ui-mobile/` and each inspected by you.
- Zero horizontal overflow on every page at 360 px (state how checked), all interactive targets at least 44 px, no overlapping or hidden controls with the keyboard open.
- Desktop screenshots at 1440 px for Order and History are unchanged apart from listed fixes.
- Component tests updated (never weakened); gate passes.
- A closing section: what you attacked and could not break, and what remains unverified (real devices, real keyboards, real browsers other than the one used).

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
