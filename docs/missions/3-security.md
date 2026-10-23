# Mission 3: Security assessment (Wave 1, REPORT ONLY)

Branch: `mission/3-security` (reports only; do not change application code or SQL in this mission)

## Objective
Find real, exploitable security and privacy weaknesses in this app and its Supabase configuration as committed, rank them by realistic threat, and propose precise fixes. A later mission applies the fixes after Claude reviews your report.

## Verified context
- Client-only React app talking directly to Supabase with a publishable key; security therefore rests entirely on Row Level Security, storage policies and database functions in `supabase/schema.sql` and `supabase/migrations/*.sql` (20260330 roasters, 20260701 privacy projection, 20260814 order status and join, 20260814 participant privacy projection).
- Single hard-coded workspace id in `src/lib/supabase.ts`. Membership via `is_workspace_member`/`is_order_full_viewer` style helpers, several `security definer` functions. Storage bucket `roaster-logos`. Auth: email+password, reset flow (`ResetPasswordPage`, `appConfig.ts`).
- Existing SQL tests (`supabase/*.test.ts`) only match text; they do not prove behaviour.
- The README commits the project URL and a publishable key. Publishable keys are public by design; judge whether anything beyond RLS depends on its secrecy.
- No CI, no dependency audit configured.

## Tooling
Use the smallest effective set:
1. Run `npm audit --omit=dev` and `npm audit` and triage results (reachable or not, in a client bundle or dev only).
2. Try Google Mantis (`https://github.com/google/mantis`, open source; Google's guide runs it from Antigravity): clone it to a directory OUTSIDE this repo, then ask your agent: "I would like to use Mantis framework in `<path to mantis>` to review my code in `<path to this repo>`, can you help me get started?" Give it human context: this is a client-side app, RLS is the trust boundary, XSS/CSRF-style web issues matter, and crashing your own client does not. If Mantis cannot run, say so and continue manually; do not install other scanners.
3. Manual review regardless of tool output. Check at least:
   - Every table and view: RLS enabled, policies per operation (select/insert/update/delete), `with check` clauses present, no policy that lets a member read or change another member's private data beyond the intended projection.
   - Each `security definer` function: `set search_path`, authorization inside the function, `grant`/`revoke execute` (anon and public must not call privileged ones), input validation.
   - Privilege escalation: can a normal member make themselves admin/owner, add members, or edit `workspace_members`? Can a user who is not yet approved ("pending access") read anything? Can the anon role read anything?
   - Order privacy: what a non-owner participant can see versus what the app shows (phones, emails, other people's amounts).
   - Storage: who can upload/overwrite/delete logos, allowed types and sizes, public URL exposure.
   - Client: any `dangerouslySetInnerHTML`/`innerHTML`, `window.open` use (`sharing.ts`: phone/email into URLs), `importJSON` trust of imported data (can it write arbitrary fields or other workspaces' ids), localStorage contents, password reset redirect base `APP_URL`.
   - Deployment headers: no `_headers` file exists in `public/`; assess whether CSP/frame/referrer headers are worthwhile on Cloudflare Pages (free).
   - Whether staging vs production separation exists and how an agent could accidentally hit production.

## Constraints
- Read-only against code. Do not connect to the production Supabase project, and do not probe any live system. If you test policies dynamically, use only a local or staging Supabase with synthetic users.
- Do not print secrets or customer data. Redact in the report.
- Do not apply or write migrations.

## Acceptance criteria
- A single findings table: id, severity (critical/high/medium/low/info), location (file:line), realistic attack scenario (who, what they do, what they gain), evidence, whether verified dynamically or by reading, proposed fix (exact SQL or code sketch), and whether it needs a production migration.
- Explicit "checked and found fine" list for the areas above, so gaps are visible.
- Tool section: what Mantis and `npm audit` actually reported, what you had to discard as false positives and why.
- Recommended fix order and which fixes can ship as code-only versus need a production SQL change (owner approval).
- No code changes; the report is your deliverable. Gate not required, but state `git status` is clean.

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
Return the findings table and the sections above, concisely, plus `git status` output, any commands run (with real output tails for `npm audit`), and anything you could not verify.
