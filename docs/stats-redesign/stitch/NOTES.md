# Stitch references (project 8221864628334960661, design system "Emerald Ledger")
Made 2026-10-30. All numbers and names in the screens are SAMPLE values. Classic (emerald) only; for Modern use the same layout with the yinmn tokens.
- phone-1-stats-home.png: Statistics home (390 wide)
- phone-2-year-recap.png: Year in Coffee, five chapters
- phone-3-year-picker-and-empty.png: year bottom sheet, empty state, one-order year
- desktop-1-stats-home.png, desktop-2-year-recap.png (2-column recap: the saved desktop-2 shows the intended layout)

## Follow the layout, but fix these in the build
1. Header lockup (italic "by Fajr Brews"): ignore; the real lockup is owned by the identity work. Do not copy it.
2. Invented sub-lines under coffee names ("Single origin lot", "Volcanic terroir lot", "Clean process lot", "Highland lot"): do NOT build. The app does not record origin or process. Show roaster and order name only.
3. Wording: "typed coffee lots" -> "coffees you took"; "settled by the organiser" -> "once an order is done"; "allocated across 8 friends" -> remove; "A printed one-page ledger note" -> "A look back at your year".
4. Cards inside cards (summary panel containing a roaster panel containing a note): flatten to one card level with hairline rules.
5. Recap chapter 5 numbered circles: use plain rows. Chapter progress dots are phone-only.
6. The picker's "Statistics update automatically..." footer and the "Contextual States Specification / Design Standards" blocks are design annotations, not UI.
7. Desktop favourite block has dead space under the runner-up line: tighten.
