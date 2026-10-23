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

## Security tools (checked against official or vendor pages, 2026-10-23)
- **Use: Google Mantis** (open source, `github.com/google/mantis`). Google's own getting-started post describes running it from Antigravity, which is the environment you use. Cost is only model usage in Antigravity. Mission 3 uses it, with a manual checklist as fallback.
- **Optional second pass: Cloudflare Security Audit Skill** (`github.com/cloudflare/security-audit-skill`, MIT, free). Needs an agent with parallel sub-agents; Antigravity is not listed as supported, so only try it if Mantis fails. Source is secondary reporting, not the repo README; confirm before relying on it.
- **Anthropic `security-guidance` plugin**: Claude Code only; not usable in Antigravity. Claude uses its own `/security-review` on the final diff instead.
- **Skip: OpenAI Codex Security.** Needs a ChatGPT/OpenAI account plus separate "Codex Security access"; cost unstated. Not justified.
- Taste-Skill (`github.com/Leonxlnx/taste-skill`): the live repo ships one skill, `design-taste-frontend` (v2.1, includes dashboards/app screens and the old redesign skill). Install with `npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"` (needs Node 22+). Its page does not mention Antigravity, so Mission 1 tells the agent to clone the repo and read the skill file if the installer does not work.
