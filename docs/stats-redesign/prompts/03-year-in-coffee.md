PROMPT 3 of 5 - Year in Coffee
Repo: Fajr Brews Splits. Read AGENTS.md first and follow it (strict TS, pure logic in src/lib with colocated tests, CSS variables only, no new dependencies, no linter, gate = npm run typecheck && npm test && npm run build). Read docs/stats-redesign/AUDIT.md for the data limits and the exact metric definitions; they are the contract. The app records orders, roasters, hand-typed coffee names, grams and dates. It does NOT record origin, brewing method, ratings or tasting notes, so never show those. Plain everyday words in anything visible (no "finalized", "ZAR share", "lot", "250g eq"). No per-bag or per-gram prices anywhere. No mock data in production code. No unrelated refactors. Do not touch the header lockup.

Goal: a polished yearly recap that reads like a page of a coffee journal. Design reference: Stitch screens 3, 4, 5 in docs/stats-redesign/stitch/ (read NOTES.md there first: it lists what to ignore and fix); otherwise follow this spec and say so.
Files: new src/components/stats/YearInCoffee.tsx (+ small sections), a year picker component, route/tab wiring in src/App.tsx following how my-stats is wired, tests, src/styles/globals.css (own section).
Rules: use only fields from summarisePeriod and friends (prompt 1). Nothing invented, no personality quizzes: the "style of year" label appears only when defined (4+ orders) and always shows its numbers ("5 of your 6 orders came from Father Coffee").
Chapters (each a calm full-width section, large editorial type, restrained colour, generous space, one idea each):
1 Your year: number of orders, kg taken, bags shared in, roasters tried, coffees tried.
2 Your favourite roaster: logo/name, share of your coffee, "most coffee taken" wording (it is NOT a rating). Runner-up in one line.
3 Coffees you tried: the typed coffee names you took the most of (top 5), with grams.
4 Your months: the 12-month bars with the busiest month named (omit the naming on a tie).
5 Milestones, only those that are true: first order of the year, roasters you tried for the first time this year, best month. Omit chapters that have no truthful content.
6 Closing line plus "Back to your coffee".
Year picker: lists only years with counted orders, newest first; current year says "so far"; changes URL/state so a year can be revisited; keyboard and screen-reader friendly. Same-dates comparison with the previous year ("Same dates last year: 4 orders") only when the previous year has orders; never compare a partial year to a full one.
States: no counted years (friendly empty with link to start an order), year with 1 order (shortened recap, no "most", no bars), user who joined mid-year (no comparison), loading, skipped orders note.
No share-to-image, no animation beyond a 200 ms fade, honour prefers-reduced-motion, no new dependencies.
Tests: chapters omitted correctly for a 1-order year and a tie month; picker lists right years; comparison rules; Classic and Modern render.
Acceptance: gate passes; screenshots at 1440, 1024, 768 in both themes in docs/stats-redesign/evidence/03/; no console errors; every number on screen traceable to a tested function.
REPORT (in this order): 1 files changed (added/modified/deleted); 2 diff summary per file; 3 commands run with real output (typecheck tail, test pass/fail counts, build tail); 4 each acceptance criterion marked met/not met with evidence; 5 skipped or uncertain, assumptions, deviations from the design. Claude will check each claim against the repo and reject vague or unverified reports.
