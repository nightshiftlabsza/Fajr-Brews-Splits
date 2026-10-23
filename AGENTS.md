# AGENTS.md

Instructions for coding agents (Google Antigravity) working in this repo. Work is planned and reviewed by Claude: you receive a build prompt, implement it, and return a report that Claude checks against the repo. Vague or unverified reports are rejected.

## What this is

Fajr Brews Splits: a React app that splits the ZAR cost of a shared imported-coffee order across group members and produces per-person invoices (PDF/shareable). Money correctness matters more than anything else here. `README.md` has the calculation rules; read it before touching `src/lib/calculations.ts`.

## Stack and commands

React 18, TypeScript (strict), Vite 5, Zustand, Supabase (Postgres, Auth, Realtime), jsPDF, Vitest. Deployed to Cloudflare Pages. Plain CSS with design tokens; no CSS framework.

```bash
npm ci               # install
npm run dev          # vite dev server
npm run typecheck    # tsc --noEmit
npm test             # vitest run (all tests)
npx vitest run src/lib/calculations.test.ts   # single file
npm run build        # vite build -> dist/
```

There is **no linter configured**. Do not add one unless asked. The gate is `typecheck` + `test` + `build`, all of which must pass. Baseline at time of writing: typecheck clean, 25 test files / 204 tests passing.

The app needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (in `.env.local`, gitignored) to run. `src/lib/supabase.ts` throws at import if they are missing, so tests that touch it must mock it. Never commit `.env*`, never use or add a service-role key.

## Architecture map

- `src/App.tsx`, `src/main.tsx`: shell, routing by path (`src/lib/appConfig.ts` holds `APP_URL`, `RESET_PASSWORD_PATH`).
- `src/store/appStore.ts`: the single Zustand store (auth, workspace, people, orders, roasters, settings, realtime subscriptions, all Supabase reads/writes). Largest file in the repo; add to it narrowly.
- `src/lib/`: pure logic, where almost all behaviour lives and where tests are densest.
  - `calculations.ts`: goods/fee allocation and the rounding rule. Source of truth for money.
  - `orderWizard.ts`: wizard steps, bag/share drafts (`expandLotToBagDrafts`, `collapseBagDraftsToShares`).
  - `allocationInference.ts`, `orderIntegrity.ts`, `orderLifecycle.ts`, `storeState.ts`, `myStats.ts`, `pastOrderSummary.ts`, `roasters.ts`, `peopleOptions.ts`.
  - `invoiceFormatter.ts`, `formatters.ts` (`formatZAR` etc.), `pdf.ts`, `sharing.ts`.
- `src/components/{auth,invoice,layout,order,pages,people,roaster,ui}`: presentational and page components. They read from the store; business rules do not belong in them.
- `src/types/index.ts`: all shared types, including `Db*` row shapes vs app shapes.
- `src/styles/`: `tokens.css` (theme variables), `globals.css`, `print.css`.
- `supabase/schema.sql` is the full schema; `supabase/migrations/*.sql` are dated patches. Both must stay consistent. `supabase/*.test.ts` assert on the SQL text (RLS, privacy projection, join flow).
- `dist/` is build output and is gitignored. `test_output.txt` and `.claude/` are stray local files; ignore them and do not edit them.

## Conventions (match the surrounding code)

- TypeScript strict. Use `import type` for types. No `any`; no non-null assertions to silence the compiler.
- Money is ZAR, full float precision internally, rounded only at the end per the README rule: non-payers `Math.floor` to 2 dp, the payer absorbs the remainder so totals reconcile exactly. Do not round earlier, do not change this rule without being told to. Format with `formatZAR`; do not hand-roll `toFixed` in components.
- Fee types: `fixed_shared`/`value_based` are legacy aliases of `equal_per_person`/`proportional_by_value`. Go through `normalizeFeeAllocationType`, do not branch on raw strings.
- Put new logic in `src/lib/` as pure functions with a colocated `*.test.ts`. Components stay thin.
- Styling uses CSS variables from `tokens.css` (`var(--color-*)`, `var(--font-*)`). No hard-coded colours, no new styling libraries.
- Component tests start with `/** @vitest-environment jsdom */` and mock `../../store/appStore` with `vi.mock`. Pure lib tests use the default node environment.
- Database changes: add a new dated file under `supabase/migrations/` and mirror it in `supabase/schema.sql`. Never edit an existing migration. Every table keeps RLS; access goes through `is_workspace_member(workspace_id)`. Update the matching `supabase/*.test.ts` when policies change. You cannot run migrations; state in the report that they were not applied.
- Dependencies: do not add any unless the build prompt says so.

## Anti-slop rules

- Do exactly what the prompt asks. No unrequested features, refactors, renames, or reformatting of untouched code.
- No speculative abstractions, helper layers with one caller, feature flags, or config for hypothetical needs.
- No placeholder, stub, TODO, or commented-out code. No dead code or unused exports left behind.
- Comments only where the why is non-obvious. Never narrate what the code does.
- No new README sections, docs, or changelog files unless asked.
- Fix root causes. Never skip, delete, loosen, or `.skip` a test to get green; if a test is wrong, say so in the report and explain.
- If the prompt is ambiguous or contradicts the code, stop and say so in the report rather than guessing.

## Definition of done

Run all of these, from a clean tree state, after your final edit:

```bash
npm run typecheck && npm test && npm run build
```

Done means: all three pass; new or changed behaviour has tests that fail without your change; every acceptance criterion in the prompt is met; the diff contains nothing outside the prompt's scope. "Done" without pasted command output does not count.

## Mandatory report back to Claude

End every task with this report, in this order. Be specific; Claude verifies each claim against the repo.

1. **Files changed**: every path, each marked added / modified / deleted.
2. **Diff summary**: per file, what changed and why, in one or two lines.
3. **Commands run**: the exact commands with their real output (at minimum the tail of typecheck, test with pass/fail counts, and build).
4. **Acceptance criteria**: each criterion from the prompt, marked met / not met, with the evidence (test name, file:line, or output).
5. **Skipped or uncertain**: anything not done, assumptions made, risks, anything you could not verify (for example SQL not applied to a live database). Write "none" only if true.

Do not pad the report, do not claim anything you did not run, and do not report partial work as complete.
