# Statistics audit (2026-10-30)

Checked in code only. I have not run the app or the tests in this thread.

## What the app actually records
Per order: date (a plain calendar date), roaster (id or a saved name), status, lots. Per lot: a hand-typed name (e.g. "Kenya AA"), grams per bag, number of bags, who took how many grams of each bag, price in the roaster's currency, fees, payments.
NOT recorded anywhere: origin/country, process, variety, brewing method, equipment, tasting notes, ratings, bag finished/opened dates. So "origins explored", "brewing methods", "highest rated roaster" and "favourite characteristics" cannot be honestly built today. This is a coffee order-splitting tool, not a brewing journal.
Stats are personal and use only the signed-in person's own share (the server already hides other people's shares from non-admins).

## Bugs in the current Statistics page
1. Favourite roaster line mixes units: it shows "bags" (grams/250) then "% of finalized orders", and the % divides by ALL orders including ones with no roaster. Wrong denominator, mixed measures.
2. "Bag" is assumed to be 250 g everywhere (`grams / 250`). Lots have their own bag size (often 1 kg), so "Total Bags" and "bags" for the favourite are wrong. A bag shared by 4 people shows as 0.25-bag fractions.
3. Roaster identity splits: key is `id ?? lowercase name`. The same roaster saved once with an id and once as a name-only snapshot counts as two roasters, so the favourite can be wrong.
4. `subtractMonths` overflows at month ends (31 May minus 3 months lands in early March). "Last 3/6/12 months" edges are off.
5. Custom range: with only one date filled it silently shows everything; start after end silently shows nothing.
6. Orders whose calculation is invalid are dropped without telling the person.
7. "Newest: ..." takes the first row and assumes the list is newest-first. Nothing guarantees that.
8. "Average Cost per Bag" is a per-bag cost figure (built on the 250 g guess). The owner's rule is no cost-per-gram/per-bag figures in the app.
9. Money leads the page ("Total Spent" is the emphasised card). It reads like an expense tracker.
10. Jargon on screen: "finalized", "250g eq", "Participated", "Total Share (ZAR)", "Your own coffee-order metrics only. No shared invoices, payment widgets...".
11. Range buttons use tablist semantics without tabs (accessibility).
12. No loading state is separate from "empty"; nothing says how many orders were skipped.
Not a problem: all data is already loaded into the store, so no new database queries are needed; year totals are cheap to compute in the browser. No new RPC or migration is required.

## Definitions (apply everywhere)
- Counted order: status completed or archived, calculation valid, and the person has more than 0 g in it.
- Year of an order: the calendar year in its order date text (YYYY-MM-DD). Never parse it as UTC, never use `new Date(text)` for the year. "Today" is the device's local date.
- Coffee taken: the person's own grams, shown in kg/g.
- Bags shared in: number of distinct physical bags the person has grams in (bag-level data); for old orders without bag data, per lot, round up grams / bag size. Labelled "bags you shared in", never "250 g bags".
- Coffees tried: distinct lot names after trimming and ignoring capitals/extra spaces. Hand-typed, so shown as "coffees", never as origins.
- Roaster identity: id if present, otherwise normalised name; an id and a same-name snapshot are merged.
- Favourite roaster: most grams in the period; ties go to most orders, then most recent. Share = its grams / the person's total grams in that period; orders with no roaster are mentioned, not hidden.
- Came back to: roasters with 2 or more counted orders.
- New roaster in a year: first ever counted order with that roaster falls in that year.
- Most active month: month with the most counted orders; a tie means no winner is shown.
- Style of year (Explorer / Loyalist / Steady): only with 4+ orders. Loyalist if favourite roaster has at least 60% of orders; Explorer if roasters tried >= half the orders; else Steady. The numbers behind it are always shown next to the label.
- Year picker: only years with at least one counted order, newest first. The current year says "so far". Comparison with the year before only uses the same dates (1 Jan to today's date), and only when the earlier year has orders.
- Money: one quiet "Your share" line per order and a yearly total in the detail view only. No per-bag or per-gram prices.
