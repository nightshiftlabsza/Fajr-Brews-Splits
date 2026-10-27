# Antigravity prompts

Each file is a self-contained prompt: copy it whole into Antigravity. Every prompt ends with the AGENTS.md report format, so Claude can review it.

## Before anything
1. Merge PR #1 (adds `AGENTS.md`), then tag `main` as `pre-stabilisation` (rollback point).
2. No staging database (Supabase free tier allows 2 projects, both used). Agents therefore never connect to Supabase: tests and screenshots use mocked data (a mocked store or Supabase module, as existing component tests do). Anything needing the real backend, such as RLS behaviour, realtime and live sign-in, is reported as unverified and covered by a short manual checklist you run on the real app at the end.
3. Each prompt runs in a new Antigravity chat on the normal project folder, on its own branch `prompt/<n>-<name>` cut from the current integration branch. Rename `.env.local` to `.env.local.bak` first so agents cannot reach live Supabase keys.

## Run order (the numbers are the order)
Run them one at a time, in number order, merging each reviewed branch before starting the next. 1, 2 and 3 touch mostly different files and could run together only in separate git worktrees; 4 to 6 must follow one another because they rewrite the same CSS and page components; 19 needs everything merged.

| Order | Prompt | Notes |
|---|---|---|
| 1 | **01 Bug hunt** | Owns store, lib and order components. |
| 2 | **02 Invoice PDF** | Owns `pdf.ts`, `invoiceFormatter.ts`, invoice components. |
| 3 | **03 Security (report only)** | Edits nothing; fixes follow as a new prompt from Claude after review. |
| 4 | **04 CSS engineering** | Tokens and CSS structure, no visual change. |
| 5 | **05 UI desktop** | Full desktop redesign; phones must not get worse. |
| 6 | **06 UI mobile (adversarial)** | Attacks and fixes phone layouts once desktop is done. |
| 1 to 9 | Speed (1 to 3) and the rest of the plan (4 to 9) | Their own prompt files; numbers are the order. |
| 18 | **18 Security (code only)** | Headers (report-only CSP, immutable asset cache), mailto and import validation, SVG logos. Runs after the UI prompts so the CSP matches the final fonts. |
| 19 | **19 Final verification** | Report only, on the fully integrated branch. |

Performance batch (see `docs/PERF_AUDIT.md`): **Prompt 1 Fast startup** runs first. Then **Prompt 2 Instant reopen** after 1 merges, then **Prompt 3 Store selectors** after 2 merges. Design prompts (4 to 7) come after 3.

Claude reviews each report before the next wave starts. Merge a branch only after its review passes.

## Security tools (primary repos checked 2026-10-23)
- **First choice: Cloudflare Security Audit Skill** (`github.com/cloudflare/security-audit-skill`, MIT, free). Needs an agent with tool use and parallel sub-agents, Node.js, and an OS-enforced sandbox only if target code is to be executed; without one it stays read-only and marks leads `needs_validation`. Install: `npx skills add https://github.com/cloudflare/security-audit-skill --skill security-audit`. Its README does not name Antigravity, so Prompt 3 tests that it loads and otherwise falls back to a manual review.
- **Not used: Google Mantis.** Its README says "USE THIS ONLY IN ISOLATED, RESTRICTED ENVIRONMENTS", not for machines with production access or sensitive data, is a demonstration rather than an official product, needs Python plus Google Cloud credentials for its reference harness, and requires expert verification of findings. Does not fit an unsandboxed Antigravity workspace.
- **Not usable in Antigravity: Anthropic `security-guidance` plugin** (Claude Code only; its GitHub page could not be fetched, details from a secondary article). Claude runs its own `/security-review` on the final diff.
- **Not used: OpenAI Codex Security** (`github.com/openai/codex-security`). Needs Node 22+/Python 3.10+, a `cs login` account or API key, and some protected findings need "Trusted Access for Cyber" approval; cost unstated.
- Already available and used regardless: `npm audit`, secret scan of the tree and git history, manual review of RLS/functions/storage.
- Taste-Skill (`github.com/Leonxlnx/taste-skill`): one skill, `design-taste-frontend` (v2.1, includes dashboards/app screens and the old redesign skill). Install: `npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"` (Node 22+, Chrome/Edge/Chromium). Its page does not mention Antigravity, so Prompt 5 falls back to reading the skill files directly.

## Review checklist additions (reuse-first, from the Ponytail evaluation)
When reviewing any report, also check: new code that duplicates an existing helper or token; files changed that the task did not need; callers of renamed or changed functions outside the diff; risky logic shipped without a test; validation, error handling or accessibility removed to shrink the diff. Ponytail itself (`github.com/DietrichGebert/ponytail`, MIT, lists Antigravity as a supported host) is not installed: its useful part is the reuse-first ladder, now written into `AGENTS.md` and prompts 4 to 7. Prompts 1 to 3 are covered by `AGENTS.md` and by this checklist.
