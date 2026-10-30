# BUILD: Your coffee statistics and Year in Coffee (multi-agent)

This REPLACES the five separate prompts in this folder (01 to 05). Keep them only as reference for detail. One branch, one PR at the end.

Branch: `feat/stats-year-in-coffee`, cut from the latest `main`. Pull `main` first and say which commit you started from.

## Goal
Rebuild "My Stats" into a calm coffee overview plus a "Year in Coffee" recap, correct numbers first, then phone and desktop screens that match the Stitch designs. The people using it are friends sharing coffee orders; it must feel like a coffee journal, not a spending report.

## Read first (every agent)
1. `AGENTS.md` (rules, report format, "done" command).
2. `docs/stats-redesign/AUDIT.md`: what the app records, the bugs, and the exact meaning of every number. It is the contract.
3. `docs/stats-redesign/stitch/NOTES.md`, then the five screens in that folder. Copy the structure, spacing and feel. Do NOT copy what NOTES.md says to ignore.
4. `design.md` and `src/styles/tokens.css` for the look. Both themes (Classic emerald, Modern blue) must work, light and dark.

## Hard limits (every agent)
- The app does NOT record origin, brewing method, ratings or tasting notes. Never show them, never guess them from names.
- No money as the main thing. No cost per bag or per gram anywhere. Money appears only as a small "your share" line in the orders list.
- Do not touch: `src/lib/calculations.ts`, the header and Splits lockup, PDF files, `supabase/*` (no database change at all), saving or sync code. No new npm dependencies, no charts library (bars are plain CSS), no images from the internet.
- The year of an order comes from the date text (YYYY-MM-DD). Never turn it into a date in UTC to read the year or month.
- Plain everyday words in anything visible. Banned: "finalized", "ZAR share", "lot", "250g eq", "participated", "settled by the organiser", "ledger", "allocated". Use: "coffee taken", "bags you shared in", "roasters tried", "orders you were part of", "once an order is done".
- Only the signed-in person's own coffee counts. Other people's grams never appear.
- No filler comments, no unused code, no placeholder text, no sample data in the app.

## How to run this with several agents
Use up to five agents in parallel, each in its OWN git worktree and branch (`git worktree add ../w-<lane> -b feat/stats-<lane>`). The lead (Agent 0) owns `feat/stats-year-in-coffee`.

1. **File ownership.** An agent edits only the files its lane owns. If it needs a change elsewhere it writes the request to a notes file outside the repo and the lead decides. Only the lead edits `src/styles/globals.css`, `tokens.css` and `src/App.tsx`; each UI lane writes styles into its own NEW stylesheet and the lead adds the imports.
2. **Order.** Lane D (numbers) goes first and is merged before the UI lanes start building on it; the UI lanes may study the designs and write markup against the agreed function shapes meanwhile. Merge order: D, then W, then P, then T, running typecheck and tests after each. Stop and fix before the next.
3. **Conflicts.** The lead keeps the lane owner's version of its own files and re-applies the other lane's small change on top. Record every conflict and how it was resolved.
4. **Evidence per lane.** Each agent runs typecheck and its own tests before reporting, and returns: files changed, tests added, screenshots, what it did not do.

### Lane D: the numbers
Owns: `src/lib/myStats.ts` and `myStats.test.ts`, new `src/lib/yearInCoffee.ts` and test, `src/lib/roasters.ts` (read mostly), new small pure helpers.
Build exactly the definitions in AUDIT.md: counted order, year, bags shared in, coffees tried, roaster identity, favourite roaster (most coffee taken, not a rating), roasters you came back to, new roasters, busiest month (no winner on a tie), "style of year" only with 4 or more orders and always with its numbers, same-dates comparison with last year. "Today" is passed in so tests are fixed. Fix every audited bug: wrong favourite share and units, the 250g guess, the same roaster counted twice, month-end ranges, half-filled or backwards custom dates (report as incomplete, never silently all or none), orders that cannot be counted (return how many were skipped), sorting inside the library. Remove average cost per bag and total bags.
Return shape (agree and freeze it in the first hour, publish it in the notes file): `getCountedYears`, `summarisePeriod` (grams taken, orders, bags shared in, roasters tried, coffees tried, favourite roaster with share, came-back-to list, orders per month x12, busiest month, new roasters, first order, skipped count), `compareSamePeriod`.
Tests that must fail without the change: month-end; a 1 kg bag shared by 4 = 1 bag shared in and 250g taken; old orders without bag detail; same roaster as id and as name merges; favourite tie-break; orders with no roaster; 31 Dec to 1 Jan and 29 Feb with the machine time zone set to UTC+14 and to UTC-11; empty year; one-order year; style of year below 4 orders is empty; same-dates comparison on 29 Feb; a person seeing a reduced copy of an order (others' shares removed) gets the same numbers as from the full order.

### Lane W: desktop and tablet screens
Owns: `src/components/pages/MyStatsPage.tsx` (+ test), new `src/components/stats/*` for the Statistics home, the Year in Coffee page and the year picker (desktop dropdown), new `src/styles/stats.css`.
Statistics home top to bottom: "Your coffee" title and one line; year dropdown (years that have orders, plus All time; the current year says "so far"; "More ranges" holds 3, 6, 12 months and a date range); three headline facts (coffee taken in kg, bags you shared in, roasters tried); favourite roaster with logo, share of coffee taken and orders count, plus "N orders have no roaster saved" when true; "You keep coming back to" (roasters with 2 or more orders, thin bars); monthly bars with the busiest month named and a plain-text summary for screen readers; a quiet link to Year in Coffee; the orders list (date, order name, roaster, grams, your share in small plain text).
Year in Coffee: five chapters (Your year; Your favourite roaster with runner-up; Coffees you took the most of, top 5 with grams; Your months; Milestones that are true: first order of the year, roasters tried for the first time this year, best month). A chapter with nothing true is left out. Desktop is the two-column version in the designs with a chapter list. Year picker rules in AUDIT.md. Same-dates comparison only when last year has orders.
States for both: loading (quiet placeholders), no linked person (plain message), no orders at all (friendly, with a link to start an order), no orders in this choice, one-order year (short recap, no "most", no bars), joined part-way through a year (no comparison), "N orders could not be counted". Never show NaN, "Not available" or an empty chart.
Add the page wiring in a note for the lead; Lane W does not edit `App.tsx`.

### Lane P: mobile app developer (phones)
You are a senior mobile app developer who ships phone-first products. Owns: new `src/styles/stats-phone.css`, the phone-only parts of the stats components (year bottom sheet, chapter dots, bar tap-to-read), and a review of Lane W's components at phone width. Work on Lane W's branch only through the lead's merge, never in the same files at the same time; send W your change requests in the notes file, or take over a component file when the lead hands it to you.
Requirements: phone-first compositions as in the Stitch phone screens, not shrunk desktop. Test at 320, 375, 390, 430, then 768. No sideways scrolling at any width. Buttons and rows at least 44 by 44 px, 8 px apart. Year picker is a full bottom sheet on phones (focus kept inside, closes with Escape, backdrop or a close button, focus returns). Respect the phone's safe areas and the bottom tab bar (`env(safe-area-inset-*)`, `dvh` not `vh`). The recap scrolls one chapter at a time with gentle snapping (proximity, never forced) and labelled progress dots. Month bars readable at 320 (one letter each, full month for screen readers); tapping a bar shows its value as text, no hover tips. No layout jump after load (reserve heights). 200% text size stays usable. Reduced-motion respected. Report bundle size before and after.

### Lane T: tests and wording (also does the final sweep)
Owns: component tests for the new screens, a wording test (extend the existing banned-words test) covering every stats file, and `src/App.test.tsx` changes the lead asks for. Tests: each state renders; year dropdown changes the numbers; the picker lists only years with orders; chapters are left out correctly for a one-order year and a tied month; both themes render; every control has a name; no banned words.

## Whole-run steps for the lead
1. Run `npx impeccable detect <dev-server-url>` before and after and report both counts (reinstall if missing: `npx skills add https://github.com/pbakaus/impeccable`).
2. After merging all lanes: `npm run typecheck && npm test && npm run build`, paste the real output.
3. Screenshots with the mock harness (`design/mock-screens.cjs` pattern), saved under `docs/stats-redesign/evidence/` (PNG, each under 300 KB): Statistics home, recap, year picker, empty and one-order states, at 320, 375, 430, 768, 1024, 1440, Classic light and Modern dark. Also paste a scripted check that the page is never wider than the screen at each width and that every button on these screens is at least 44 px.
4. One PR to `main`. Say plainly: no database change, nothing deployed.

## Report (lead returns one report; each lane's section inside it)
1. Files changed (added, modified, deleted), per lane.
2. What each lane did, one or two lines per file.
3. Commands run with real output (typecheck, test counts, build, impeccable counts).
4. Each requirement above marked met or not met with proof (test name, file and line, or screenshot).
5. Where the result differs from the Stitch screens and why.
6. Conflicts and how they were resolved.
7. Skipped or unsure, and every assumption. Write "none" only if true.
Claude will check each claim against the repo and send back anything vague, unproven, half-done or padded.
