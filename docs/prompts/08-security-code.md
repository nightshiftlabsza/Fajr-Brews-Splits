# Prompt 8: Security hardening (code only)

Branch: `prompt/08-security-code`, cut from current `main`. Run before the final verification (prompt 7).

## Objective
Close the code-side security items from the prompt 3 audit that are safe to fix without touching the database. The database fixes are a separate script the owner applies by hand (`docs/SECURITY_MIGRATION.md`); do not write, edit or run SQL.

## Verified context
- Client-only React app, Supabase publishable key in the bundle: the real trust boundary is RLS, not this code. These changes are defence in depth.
- Deploy target per `README.md`: Cloudflare Pages (`public/_redirects`). The owner may confirm a different host; if the owner's note below says so, follow it. HOST NOTE: (none yet; default to Cloudflare Pages)
- `src/lib/sharing.ts:53` builds `mailto:${email}?...` from stored person emails without validating them.
- `importJSON` in `src/store/appStore.ts` (about line 1419) inserts ids from a user-chosen JSON file; invalid ids abort that user's own write mid-import.
- The roaster logo picker (`src/components/roaster/RoasterPicker.tsx`, about line 233) accepts SVG; the new storage rule only allows PNG, JPEG and WebP.

## Scope (all four, nothing else)
1. **Security headers.** Add response headers for the real host: `Content-Security-Policy-Report-Only` first (never enforcing in this prompt), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` with camera, microphone and geolocation off, and frame protection (`frame-ancestors 'none'` in the CSP and `X-Frame-Options: DENY`). The CSP must allow what the app actually uses: its own scripts and styles (note the inline `<style>` blocks in components), Supabase REST/auth/storage over HTTPS and realtime over WSS (the project URL comes from `VITE_SUPABASE_URL`; use a placeholder you document and the owner fills in), `data:` and `blob:` images, the logo storage host, and whatever fonts and scripts `index.html` loads. Test it by loading the built app (`npm run build && npx vite preview`) in a browser with the dummy env and listing every console CSP report; the app must show zero reports on Order, History, Settings, a PDF download and a logo upload view. Do not apply an enforcing CSP.
2. **Email validation for mailto.** In `sharing.ts`, only build a `mailto:` link when the address passes a simple, sensible check (one `@`, no spaces or control characters, no `?`, `&`, `<`, `>`, `,`, `;`, `%`); otherwise fall back to the no-recipient form. Do not run `encodeURIComponent` on the address (it turns `@` into `%40` and breaks some clients). Add unit tests with good and hostile addresses.
3. **Import hardening.** Before `importJSON` writes anything, validate the file: it is an object with the expected arrays; every id that becomes a database uuid is a valid uuid (skip and report invalid rows, do not abort the whole import); strings are length-capped to sane limits; the file size is capped (for example 5 MB) in the two callers (`SettingsPage.tsx`, `HistoryPage.tsx`). Show the user a clear summary (imported N, skipped M with reasons). Add tests including a hostile file.
4. **SVG logos.** Remove SVG from the logo picker accept list and from any client-side validation, and show a plain message when a disallowed type or a file over 5 MB is chosen. Existing SVG logos keep displaying.

## Out of scope
SQL, RLS, auth settings, deploy settings, dependencies, UI redesign, money logic, PDF code. If you find another security issue, report it; do not fix it here.

## Acceptance criteria
- Headers file(s) added with the policy documented in comments; zero CSP violation reports in the evidence run (paste the list of pages checked and the console output).
- Tests for mailto validation and import validation; hostile inputs rejected; gate green.
- A short note in `docs/SECURITY_HEADERS.md`: what each header does, how to switch the CSP from report-only to enforcing later, and what to test first.
- Existing tests unchanged and green; no new dependencies.

## Ground rules (all prompts)
- Repo: Fajr Brews Splits (React 18, TS strict, Vite, Zustand, Supabase, jsPDF, Vitest). Read `AGENTS.md` and `docs/PROJECT_BRIEF.md` first; they are binding. Money rule is in `README.md`.
- You have high autonomy: investigate, delegate independent read-only investigations to sub-agents if available, refactor where demonstrably necessary, fix, test, and re-verify without asking. Do not let multiple agents edit the same file at once.
- Work only on your own branch. Do not push to or merge into `main`.
- Never use production Supabase credentials or data. Use mocked data only; there is no staging backend and `.env.local` must not point at the live project. Limit browser evidence to what mocks allow; do not fake it.
- Never: apply SQL migrations anywhere, change RLS or auth config, rotate or print secrets, delete or rewrite data, change deploy settings, add dependencies (unless this prompt says so), skip or loosen tests.
- Reuse first: read what your change touches, prefer existing helpers, components, tokens and platform features over new code, write the smallest version that works, and after any rename or signature change search every caller, including files outside your diff. Never cut validation, error handling, security, accessibility or tests for risky logic to make code smaller. (Full rule: `AGENTS.md`, Reuse first.)
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
