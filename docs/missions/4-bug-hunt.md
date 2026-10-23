# Mission 4: Functional bug hunt and fix (Wave 1)

Branch: `mission/4-bug-hunt`

## Objective
Make the core group workflow trustworthy: create an order, add roaster/lots/bags/shares, add goods and fees, share with members, lock, produce per-person totals, mark paid, archive. Users have hit bugs here and abandoned the app. Find real defects by reproducing them, fix root causes, add regression tests.

## Verified context
- State and all Supabase I/O: `src/store/appStore.ts` (1597 lines). Active order = `currentOrderId`, persisted in localStorage `fb_current_order_id`; lifecycle in `src/lib/orderLifecycle.ts` (`planning|locked|completed|archived`); `createOrder`, `updateOrder`, `updateOrderStatus`, `joinOrder`, `leaveOrder`, `deleteOrder`, `flushOrderWrites`, realtime subscriptions.
- Order UI: `components/pages/OrderPage.tsx`, `components/order/{OrderSetup,CoffeeLotsSection,GoodsAndFees,SettlementPacks,OrderSummary,CoffeeCostSummary}.tsx`, also `HistoryPage`, `MyStatsPage`, `PeoplePage`.
- Logic: `lib/calculations.ts` (money, rounding), `orderWizard.ts`, `allocationInference.ts`, `orderIntegrity.ts`, `myStats.ts`, `storeState.ts`.
- Existing tests are dense in `src/lib` and store; none exercise a real browser.

## Investigate (in this order)
1. Multiple simultaneous active orders: create 3 orders in different states; switch between them; reload; delete or archive the current one; join/leave; confirm the right order stays selected, edits never land on the wrong order, and no stale data appears after switching quickly (race between `flushOrderWrites`, realtime echoes, and switching).
2. Draft/edit persistence: type in lots, bags, shares, fees; navigate away, refresh, go offline briefly; confirm nothing is lost or silently overwritten, including concurrent edits by two sessions via realtime.
3. Money: independently recompute totals for at least 6 scenarios (equal split, uneven grams, fixed and proportional fees, payer is also a buyer, zero-gram person, odd cents) against `calculations.ts`, and confirm UI numbers, `myStats`, history and invoice figures agree with each other and reconcile exactly to the goods total.
4. Auth/access: sign-in, sign-up, pending-access, reset password, sign-out and back in, link-person flow (`confirmPersonLink`), and what a non-owner member can and cannot do in the UI.
5. Edge inputs: empty order, 0 or negative or very large values, decimals with comma, very long names, deleting a person who is in shares, importing JSON (`importJSON`/`exportJSON`) round-trip.
6. Error states: Supabase failures must surface a visible message and not leave the UI claiming success.
For each suspected bug: reproduce (test or browser), identify root cause, then fix.

## Scope
- Fix confirmed bugs in the files above. Refactor only where the root cause requires it (e.g. splitting a function out of `appStore.ts` or `CoffeeLotsSection.tsx`), keeping behaviour covered by tests.
- Do not touch `pdf.ts`, `invoiceFormatter.ts`, invoice components (Mission 5) or visual CSS/layout (Missions 1 and 2) except for minimal changes a fix requires.
- Do not alter the rounding rule or SQL. If a bug needs SQL, write the proposed migration under `supabase/migrations/` mirrored in `schema.sql` plus test update, mark it NOT APPLIED, and flag it.
- Do not add features. If something is missing rather than broken, list it as a finding.

## Acceptance criteria
- A findings table in the report: id, severity (blocks workflow / wrong money / annoying), repro steps, root cause (file:line), fixed yes/no.
- Every fixed bug has a test that fails on the baseline and passes now (state how you proved the fail).
- Scenario 3 results listed numerically with the independent recomputation.
- Multi-order switching verified in a real browser against staging (or marked unverified with reason).
- Gate passes; test count rises; nothing in the baseline removed.

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
