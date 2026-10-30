PROMPT 5 of 5 - Final check (no new features)
Repo: Fajr Brews Splits. Read AGENTS.md first and follow it (strict TS, pure logic in src/lib with colocated tests, CSS variables only, no new dependencies, no linter, gate = npm run typecheck && npm test && npm run build). Read docs/stats-redesign/AUDIT.md for the data limits and the exact metric definitions; they are the contract. The app records orders, roasters, hand-typed coffee names, grams and dates. It does NOT record origin, brewing method, ratings or tasting notes, so never show those. Plain everyday words in anything visible (no "finalized", "ZAR share", "lot", "250g eq"). No per-bag or per-gram prices anywhere. No mock data in production code. No unrelated refactors. Do not touch the header lockup.

Goal: prove prompts 1-4 work together and clean up leftovers.
1. Run npm run typecheck && npm test && npm run build from a clean checkout; paste outputs.
2. Search for leftovers: unused exports, dead CSS from the old stats page, TODOs, console.log, hard-coded colours, text matching /ZAR share|finalized|250g|Participated/.
3. Walk with the mock harness: stats home, each period choice, year picker, recap for a year with 0, 1 and many orders, a person with no link, in both themes and at 320, 375, 430, 768, 1024, 1440. Zero console errors; paste the console log.
4. Confirm user isolation: stats use only the signed-in person's own shares; show how a participant-projected order (other people's shares removed) gives the same numbers as the full order for that person (add a test if missing).
5. Confirm no migration or schema change was made.
6. Screenshot check against the Stitch references, listing every visible difference.
Fix only defects found; list each.
REPORT (in this order): 1 files changed (added/modified/deleted); 2 diff summary per file; 3 commands run with real output (typecheck tail, test pass/fail counts, build tail); 4 each acceptance criterion marked met/not met with evidence; 5 skipped or uncertain, assumptions, deviations from the design. Claude will check each claim against the repo and reject vague or unverified reports.
