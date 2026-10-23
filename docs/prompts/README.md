# Antigravity prompts

Each file is a self-contained prompt: copy it whole into Antigravity. Every prompt ends with the AGENTS.md report format, so Claude can review it.

## Before anything
1. Merge PR #1 (adds `AGENTS.md`), then tag `main` as `pre-stabilisation` (rollback point).
2. No staging database (Supabase free tier allows 2 projects, both used). Agents therefore never connect to Supabase: tests and screenshots use mocked data (a mocked store or Supabase module, as existing component tests do). Anything needing the real backend, such as RLS behaviour, realtime and live sign-in, is reported as unverified and covered by a short manual checklist you run on the real app at the end.
3. Each prompt runs on its own branch `prompt/<n>-<name>` cut from the current integration branch, in its own folder (git worktree), so parallel agents never share files. Example, run from the main project folder:
   `git worktree add ../fajr-01 -b prompt/01-bug-hunt` then open `../fajr-01` in Antigravity and run `npm ci` there. Do the same for `../fajr-02` (`prompt/02-invoice-pdf`) and `../fajr-03` (`prompt/03-security`). Worktrees do not contain your gitignored `.env.local`, which also keeps the live Supabase keys away from the agents.

## Run order (the numbers are the order)
Only 1, 2 and 3 are safe to run simultaneously. 4 and 5 rewrite the same CSS and page components that 1 and 2 touch, and 5 depends on 4, so running them at the same time would produce merge conflicts and wasted work. 6 needs everything merged.

| Order | Prompt | Notes |
|---|---|---|
| 1, 2, 3 (run at the same time, each in its own worktree) | **01 Bug hunt**, **02 Invoice PDF**, **03 Security (report only)** | Mostly disjoint files: 01 owns store, lib and order components; 02 owns `pdf.ts`, `invoiceFormatter.ts` and the invoice components; 03 edits nothing. |
| 4 then 5 (one after the other) | **04 CSS engineering**, then **05 UI/UX** | Both rewrite `globals.css` and page components, so they must follow 01 and 02. 04 first so 05 starts from a clean base. |
| 6 | **06 Final verification** | Report only, on the fully integrated branch. Security fixes from 03 (a new prompt from Claude after reviewing the report) go in before this. |

Claude reviews each report before the next wave starts. Merge a branch only after its review passes.

## Security tools (primary repos checked 2026-10-23)
- **First choice: Cloudflare Security Audit Skill** (`github.com/cloudflare/security-audit-skill`, MIT, free). Needs an agent with tool use and parallel sub-agents, Node.js, and an OS-enforced sandbox only if target code is to be executed; without one it stays read-only and marks leads `needs_validation`. Install: `npx skills add https://github.com/cloudflare/security-audit-skill --skill security-audit`. Its README does not name Antigravity, so Prompt 3 tests that it loads and otherwise falls back to a manual review.
- **Not used: Google Mantis.** Its README says "USE THIS ONLY IN ISOLATED, RESTRICTED ENVIRONMENTS", not for machines with production access or sensitive data, is a demonstration rather than an official product, needs Python plus Google Cloud credentials for its reference harness, and requires expert verification of findings. Does not fit an unsandboxed Antigravity workspace.
- **Not usable in Antigravity: Anthropic `security-guidance` plugin** (Claude Code only; its GitHub page could not be fetched, details from a secondary article). Claude runs its own `/security-review` on the final diff.
- **Not used: OpenAI Codex Security** (`github.com/openai/codex-security`). Needs Node 22+/Python 3.10+, a `cs login` account or API key, and some protected findings need "Trusted Access for Cyber" approval; cost unstated.
- Already available and used regardless: `npm audit`, secret scan of the tree and git history, manual review of RLS/functions/storage.
- Taste-Skill (`github.com/Leonxlnx/taste-skill`): one skill, `design-taste-frontend` (v2.1, includes dashboards/app screens and the old redesign skill). Install: `npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"` (Node 22+, Chrome/Edge/Chromium). Its page does not mention Antigravity, so Prompt 5 falls back to reading the skill files directly.
