# CHECK: independent review of the statistics and Year in Coffee build (multi-agent)

Run this only after the BUILD prompt's PR exists. You are the checkers. You did not write the code, you do not fix it, you report. Nothing you find is "fine" until you have proved it. Do not trust the builder's report.

Branch: check out the PR branch (`feat/stats-year-in-coffee`) in a clean worktree and say the commit. Do NOT edit any file in the repo. Write your findings only to `docs/stats-redesign/check/` in a separate scratch branch, or paste them in the report.

## Read first (every checker)
`AGENTS.md`, `docs/stats-redesign/AUDIT.md` (the contract for every number), `docs/stats-redesign/stitch/NOTES.md` and the five screens in that folder.

## How to run
Use up to six agents in parallel, each with its own worktree of the same commit. Each returns findings in the format below. The lead (Agent 0) then writes the final verdict.

Finding format: `id | severity (blocker, should fix, nit) | where (file:line or screen and width) | what is wrong | proof (command output, test, screenshot name) | how to fix in one line`. A finding without proof is dropped.

### Checker 1: the numbers
Recompute the statistics by hand from at least three made-up order sets and compare with the code, using the definitions in AUDIT.md: a 1 kg bag shared by 4; old orders without bag detail; an order with no roaster; the same roaster saved by id in one order and by name in another; a roaster tie; 31 Dec and 1 Jan; 29 Feb; one-order year; a year with no orders; a person who joined in August. Run the machine in time zones UTC+14 and UTC-11 and show the year and month do not move. Try to break it: empty lists, missing dates, zero grams, invalid orders, half-filled date range, backwards range. Confirm: favourite roaster means most coffee taken; the percentage uses the right total; "style of year" only with 4 or more orders and shows its numbers; same-dates comparison is fair; skipped orders are counted and shown. Confirm no cost per bag or per gram exists anywhere. Confirm the tests would FAIL on the old code (revert one fix and show it).

### Checker 2: phones
Test at 320, 375, 390, 430 and 768 in Classic light and Modern dark, with browser screenshots you took yourself. Prove: no sideways scroll; every button and row at least 44 px; the year sheet traps focus, closes with Escape, backdrop and the close button and returns focus; the bottom tab bar and safe areas never hide content; recap chapters snap gently and the dots are labelled; month bars readable at 320 and tap-to-read works; no layout jump while loading; 200% text size; reduced motion. Compare each screen with the Stitch phone screens and list every visible difference, saying whether it is a fix from NOTES.md (allowed) or a miss.

### Checker 3: desktop and tablet
Same method at 768, 1024 and 1440, both themes, light and dark. Compare with the Stitch desktop screens. Check hierarchy, spacing, one card level only, restrained colour, no gradients, no floating cards, no badges or scores. Check the year dropdown, keyboard use, and every state: loading, no linked person, no orders, no orders in this choice, one-order year, joined part-way, skipped orders. Zero console errors; paste the log.

### Checker 4: words and honesty
Read every visible word on every screen and state. Flag any banned word (finalized, ZAR share, lot, 250g eq, participated, settled by the organiser, ledger, allocated), any jargon, any invented fact (origin, process, brewing, ratings, tasting, "single origin lot"), any claim the data cannot support, and any sentence that is not true for the person's real numbers (for example "you tried more roasters" when it did not happen). Confirm a chapter with nothing true is left out. Confirm the "style of year" wording never reads like a personality test.

### Checker 5: code and scope
Review the whole diff. Prove nothing outside scope changed: `calculations.ts`, header and lockup, PDF files, `supabase/*`, saving and sync code, `package.json` and lock file must be untouched. Look for: unused code, dead styles from the old page, hard-coded colours, copied code, comments that only narrate, tests that were weakened or skipped, new dependencies, `any`, `!` assertions, `new Date(text)` used to read a year or month, and logic placed inside components instead of `src/lib`. Run `npm ci && npm run typecheck && npm test && npm run build` yourself and paste the real output. Check the bundle did not grow more than the new screens justify.

### Checker 6: privacy and safety
Prove stats use only the signed-in person's own coffee: an order as a non-admin sees it (other people's shares removed) gives the same numbers for that person as the full order. Prove nothing from other people reaches the screen, the page text, the accessible labels or the console. Confirm no new network calls, no new storage, no database change, no secrets. Confirm the page works when the person's link to a participant is missing or unclear and says so plainly.

## Final verdict (lead, Agent 0)
Collect all findings, remove duplicates, keep only proven ones. Return:
1. **YES or NO** to merging. NO if any blocker remains, any number is wrong, any invented fact is shown, any outside file changed, or checks were not run.
2. The findings table, blockers first.
3. For each blocker and should-fix: one specific correction instruction the builder can follow.
4. What was verified (with the command or screenshot), what was only partly verified, and what could not be checked.
5. The commit you checked.
Do not give YES because the builder said it passes. Do not give NO for taste alone: a difference from Stitch counts only if it hurts clarity, accuracy or phone use.
