# Mission 6: Independent final release verification (Wave 3, REPORT ONLY)

Branch: `release/candidate` (the fully integrated branch). You verify; you do not fix. Do not rely on any earlier mission report: re-derive everything.

## Objective
Produce evidence for a YES/NO merge decision. Be adversarial: try to break the application's core workflows, confirm the earlier fixes, and find regressions introduced by integration.

## Verified context
- Gate: `npm run typecheck && npm test && npm run build` (baseline 25 files / 204 tests before missions). No linter, no CI, no e2e suite at baseline.
- Core files: `src/store/appStore.ts`, `src/lib/{calculations,orderWizard,allocationInference,orderLifecycle,invoiceFormatter,pdf}.ts`, order components under `src/components/order/`, pages under `src/components/pages/`, `supabase/schema.sql` and `supabase/migrations/`.
- Security assessment findings are in the Mission 3 report and any follow-up fix branch; production SQL changes are NOT applied by agents.

## Verify
1. Diff review: `git diff pre-stabilisation...HEAD --stat` then read the substantive diffs. Flag unrelated changes, removed or weakened tests, new dependencies, committed secrets or `.env*`, debug code, TODOs, leftover evidence files with personal data, SQL files not mirrored in `schema.sql`.
2. Gate from a clean clone: `npm ci` then the gate. Report counts versus baseline and list tests removed, skipped or changed.
3. Browser journeys against staging with synthetic users, desktop (1440) and mobile (390): sign up/in/out, pending access, reset-password page, create three orders, switch between them, add roaster/lots/bags/shares, fees (fixed and proportional), join/leave, lock, mark paid, archive, history, My Stats, people, settings and themes, export/import JSON. Include two simultaneous sessions editing one order. Record pass/fail per step with screenshots in `docs/evidence/6-final/`, and inspect each screenshot.
4. Money: independently recompute at least 8 scenarios and compare to the UI, history, My Stats, share text and PDFs; totals must reconcile exactly to the goods total.
5. PDFs: generate per-person and order PDFs for 6 scenarios (short and long names, many people, many lots), view them as images, extract the text, and check arithmetic and one-page fit for typical invoices.
6. Security: re-check the top findings from Mission 3 on the final code, and run `npm audit --omit=dev`. List what remains open.
7. Error and edge behaviour: network offline mid-edit, Supabase error response, empty states, invalid inputs.
8. Release readiness: build output size versus baseline, `dist` serves with the `_redirects` fallback, no console errors on any page, list of SQL migrations that must be applied to production and in what order, with a rollback note for each.

## Constraints
- Report only. If you find a defect, document repro steps and file:line; do not fix it.
- Staging or synthetic data only. Never touch production.

## Acceptance criteria
- A verification matrix: each item above marked verified / partially verified / unverified with evidence.
- Defect list with severity (blocker / major / minor), repro and location.
- A recommendation line: YES or NO to merge within scope, with the blockers if NO. Final authority rests with Claude's review of your evidence.

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

## Report
Return: verification matrix, defect list, gate output tails (typecheck, test counts, build), `git status` clean confirmation, SQL migrations to apply, and anything unverified. Concise; evidence paths instead of narrative.
