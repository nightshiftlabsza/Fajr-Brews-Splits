# Fajr Brews: project brief

Durable context for planning and review. Source of truth for conventions is `AGENTS.md`; for money rules, `README.md`. Last verified against `main` @ 0105f4b.

## Mission and priorities
Make the app reliable and pleasant for the Fajr Brews group (adoption so far: owner plus one user). Priority order: (1) correct real workflows, (2) dependable active-order experience incl. several simultaneous orders, (3) coherent desktop and mobile UI, (4) correct compact PDF invoices, (5) security and privacy, (6) maintainable with regression tests, (7) simple release with evidence.

## Verified facts
- Stack: React 18, TypeScript strict, Vite 5, Zustand, Supabase (Postgres, Auth, Realtime, Storage bucket `roaster-logos`), jsPDF + jspdf-autotable, Vitest (jsdom for components). Cloudflare Pages (`public/_redirects` SPA fallback). No router library: `App.tsx` switches tabs (`order`, `people`, `my-stats`, `history`, `settings`) plus a `/reset-password` path.
- Gate: `npm run typecheck && npm test && npm run build`. Baseline: 25 test files, 204 tests passing. No linter, no CI (`.github/` absent), no e2e or browser tests, no Playwright dependency. Chromium exists in Claude's cloud env only.
- State: one Zustand store, `src/store/appStore.ts` (1597 lines): auth, workspace, orders, realtime, all Supabase I/O. Active order tracked by `currentOrderId` (persisted to localStorage `fb_current_order_id`); active vs past via `src/lib/orderLifecycle.ts` (`planning | locked | completed | archived`).
- Money: `src/lib/calculations.ts` (+ README rule: non-payers floored to 2 dp, payer absorbs remainder). Wizard drafts in `orderWizard.ts`, `allocationInference.ts`.
- Largest UI files: `CoffeeLotsSection.tsx` 1453 lines, `HistoryPage.tsx` 805, `OrderPage.tsx` 744. CSS: `globals.css` 2027 lines (7 `@media` blocks, no `!important`), `tokens.css`, `print.css`. Three themes plus light/dark mode.
- PDF: `src/lib/pdf.ts` draws directly with jsPDF in mm on A4 (`generateInvoicePDF`, `generateOrderInvoicePDF`); content from `invoiceFormatter.ts`. Share text via `sharing.ts` (WhatsApp, email, clipboard). `InvoiceView.tsx`/`InvoiceActions.tsx` are the on-screen invoice.
- Database: `supabase/schema.sql` (74 KB, full) plus 4 dated migrations; `supabase/*.test.ts` only assert on SQL text, they do not execute it. Single hard-coded `WORKSPACE_ID` in `src/lib/supabase.ts`. Membership/roles via `is_workspace_member`; later migrations add privacy projection and order participation (`joinOrder`/`leaveOrder`).
- Auth: Supabase email+password, password reset flow, `PendingAccess` gate until a member is added.

## Risks and unknowns
1. **No non-production backend** and the owner cannot add one (Supabase free tier: 2 projects, both used). README points `.env.local` at the live project, so agents must not run the app against it: use mocks only. Live-backend behaviour (RLS, realtime, auth) stays unverified until the owner runs a manual checklist.
2. Browser screenshots need the app to render with mocked store data; no Playwright dependency exists (would need owner OK).
3. SQL tests are string assertions; actual RLS behaviour is unverified. Real checks need a real database (none safe to use).
4. `appStore.ts` and `CoffeeLotsSection.tsx` are large and shared by several workstreams: merge-conflict hotspots.
5. Junk tracked in git: `test_output.txt`, `.claude/settings.local.json`. Left alone for now.
6. README commits the Supabase URL and a publishable key. Publishable keys are designed to be public (security rests on RLS), but the key lives in git history; treat RLS as the only defence.
7. Unknown: what the live deployment's DB currently has applied (migrations were run by hand). Needs owner to confirm which migrations are live, read-only.

## Decisions so far
- Claude plans and reviews; Antigravity builds on isolated branches; owner merges.
- No new dependencies, linter, or features unless a mission says so.
- Production migrations, RLS, secrets, and deploy settings are never touched by agents.
- Security tooling: see `docs/missions/README.md`.
