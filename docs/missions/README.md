# Antigravity missions

Each file is a self-contained prompt: copy it whole into Antigravity. Every mission ends with the AGENTS.md report format, so Claude can review it.

## Before anything
1. Merge PR #1 (adds `AGENTS.md`), then tag `main` as `pre-stabilisation` (rollback point).
2. Create a staging Supabase project (free tier), run `supabase/schema.sql` there, add a synthetic workspace and 3 to 4 fake members. Put its URL and publishable key in `.env.local` only. Production credentials must never be used by agents. Missions 1, 2, 4, 5, 6 need this for browser checks.
3. Each mission runs on its own branch `mission/<n>-<name>` cut from the current integration branch.

## Sequence
| Wave | Missions | Why |
|---|---|---|
| 1 (parallel, separate branches) | **4 Bug hunt**, **5 PDF**, **3 Security (report only)** | Mostly disjoint files. 4 owns store/lib/order components; 5 owns `pdf.ts`, `invoiceFormatter.ts`, invoice components; 3 edits nothing. |
| 2 (sequential) | **2 CSS engineering**, then **1 UI/UX** | Both rewrite `globals.css` and page components, and must sit on the bug-fixed code. 2 first so 1 works on a clean base. |
| 3 | Security fixes (new prompt from Claude after reviewing 3), then **6 Final verification** | 6 is report-only and runs on the fully integrated branch. |

Claude reviews each report before the next wave starts. Merge a branch only after its review passes.

## Security tools (primary repos checked 2026-10-23)
- **First choice: Cloudflare Security Audit Skill** (`github.com/cloudflare/security-audit-skill`, MIT, free). Needs an agent with tool use and parallel sub-agents, Node.js, and an OS-enforced sandbox only if target code is to be executed; without one it stays read-only and marks leads `needs_validation`. Install: `npx skills add https://github.com/cloudflare/security-audit-skill --skill security-audit`. Its README does not name Antigravity, so Mission 3 tests that it loads and otherwise falls back to a manual review.
- **Not used: Google Mantis.** Its README says "USE THIS ONLY IN ISOLATED, RESTRICTED ENVIRONMENTS", not for machines with production access or sensitive data, is a demonstration rather than an official product, needs Python plus Google Cloud credentials for its reference harness, and requires expert verification of findings. Does not fit an unsandboxed Antigravity workspace holding staging credentials.
- **Not usable in Antigravity: Anthropic `security-guidance` plugin** (Claude Code only; its GitHub page could not be fetched, details from a secondary article). Claude runs its own `/security-review` on the final diff.
- **Not used: OpenAI Codex Security** (`github.com/openai/codex-security`). Needs Node 22+/Python 3.10+, a `cs login` account or API key, and some protected findings need "Trusted Access for Cyber" approval; cost unstated.
- Already available and used regardless: `npm audit`, secret scan of the tree and git history, manual review of RLS/functions/storage.
- Taste-Skill (`github.com/Leonxlnx/taste-skill`): one skill, `design-taste-frontend` (v2.1, includes dashboards/app screens and the old redesign skill). Install: `npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"` (Node 22+, Chrome/Edge/Chromium). Its page does not mention Antigravity, so Mission 1 falls back to reading the skill files directly.
