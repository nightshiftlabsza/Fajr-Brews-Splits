# Prompt 9: People directory as a list

Branch: `prompt/09-people-list`, cut from current `main`. Run one prompt at a time; do not start while another prompt's branch is unmerged and touching `globals.css` or `PeoplePage.tsx`.

## Objective
Change the People directory from a grid of cards to a compact single-column list: one row per person. No behaviour change.

## Verified context
- `src/components/pages/PeoplePage.tsx` renders `.people-grid` containing one `.person-directory-card` per person (avatar, name, "You" badge, phone and email line, note, Edit and Remove buttons in a footer). Used standalone and embedded in `SettingsPage.tsx` (`embedded` prop).
- Styles `.people-grid`, `.person-directory-card`, `.person-avatar` live in `src/styles/globals.css` under "People Directory Grid" (about line 2101). `.person-avatar` is reused as is.
- `src/components/pages/PeoplePage.test.tsx` (about line 315) asserts on `.people-grid` and `.person-directory-card`.
- Existing tokens only: `var(--color-*)`, `var(--space-*)`, `var(--radius-*)`. Check whether `.data-table-container` / `.data-table` fit before writing new CSS (reuse first).

## Scope
1. Render people as a list container with one row per person: avatar, then name (with the "You" badge) over a one-line contact summary (phone, email, note if present), with Edit and Remove on the right of the row. Rows separated by a border, the container having a border and radius like other lists. Keep the title tooltips and ellipsis truncation on name and contact line.
2. Replace the grid CSS with list CSS (remove `.people-grid` and `.person-directory-card` rules and their media queries if no longer used; leave nothing dead). Move inline styles you touch into classes.
3. Mobile at 360px: no horizontal scroll; name and contact line truncate; Edit and Remove stay tappable (at least 44px tall hit area, matching how other buttons handle this in `globals.css`). If the buttons do not fit on one line, put them under the text inside the row instead of squeezing.
4. Update `PeoplePage.test.tsx` to the new structure; keep every existing assertion's intent (initials avatar, You badge, tooltips, empty state, search, edit, remove flows).

## Out of scope
Search, add/edit modal, delete rules, store, other pages, sorting or new features, dependencies, colours.

## Acceptance criteria
- Standalone People page and the embedded one in Settings both show the list; no grid or card classes remain anywhere (`grep -rn "people-grid\|person-directory-card" src` returns nothing).
- Works at 1280px and 360px; state what you checked and how (mock-data screenshots saved to `docs/evidence/09-people-list/`, desktop and 360px).
- Uses only existing tokens; no hard-coded colours; no new dependencies.
- Edit and Remove still work (tested). Existing tests still pass, with only the necessary selector changes in `PeoplePage.test.tsx`.
- Gate green: `npm run typecheck && npm test && npm run build` (there is no linter; do not add one).

## Ground rules
Read `AGENTS.md` first; it is binding (conventions, anti-slop, reuse first, definition of done). Never use production Supabase credentials; mock data only. Work only on your branch; do not push to or merge into `main`. One coherent commit series; state the base commit hash.

## Report back (exact AGENTS.md format)
1. Files changed (added / modified / deleted)
2. Diff summary per file
3. Commands run with real output (tail of typecheck, test counts, build)
4. Each acceptance criterion marked met / not met with evidence
5. Skipped or uncertain (write "none" only if true)
