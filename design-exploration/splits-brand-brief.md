# Splits (by Fajr Brews): Brand and Header Exploration Brief

For Google Stitch. Use together with `design.md` (a copy sits beside this file) and the screenshots listed at the end. `design.md` marks what is current versus planned; where it lists a planned font, treat it as one input, not a requirement.

## What this is

Splits is a small web app a group of friends use to split a shared coffee order and settle who owes what. It is not a marketing site. The brand mostly shows up in the top header, the sign-in screen, the browser tab and invoices.

The brand name is changing:

| Role | Text |
|---|---|
| Primary product name | **Splits** |
| Secondary attribution | **by Fajr Brews** (smaller, quieter) |
| Removed | "Coffee Splitter" tagline (no longer part of the lockup) |

Today the header shows a ☕ emoji, "Fajr Brews" in large type and "Coffee Splitter" underneath. We want to reverse that hierarchy.

## Your job

Explore how the **Splits** identity could look and feel inside the *existing* app. This is a design exploration, not an implementation plan, and not a rebrand of the whole product. Do not redesign unrelated screens.

## Existing constraints (treat as evidence, challenge only with good reason)

Read from the code, not from screenshots:

- **Two themes**, each with light and dark modes. Both must be explored.
  - **Emerald Ledger**: warm mineral feel, deep emerald accent (about `#1B5E40`), off-white green-tinted backgrounds, serif display headings (currently Fraunces), Manrope body. This is the warm, editorial-leaning theme. We have been calling it **Classic**.
  - **YInMn Ledger**: cool mineral feel, YInMn blue accent (about `#2E4DAA`), cool grey-blue backgrounds, geometric sans headings (currently Space Grotesk), Inter body. This is the contemporary theme. We have been calling it **Modern**.
  - The Classic/Modern labels are our shorthand. The app itself calls them "Emerald Ledger" and "YInMn Ledger". The accents and fonts above are today's values, not requirements.
- **Header structure**: a sticky top bar with brand on the left, desktop tab navigation in the middle, and a user menu with a small realtime-sync dot on the right. On mobile the brand shrinks and navigation moves elsewhere. Keep this structure recognisable.
- The brand block is currently an emoji plus two lines of text. It sits in a bar about 64px tall.
- Status colours (paid, partial, unpaid) are semantic and should not be disturbed by the brand.
- Invoices and PDFs also carry the name, so the lockup should still work in a plain, mostly black-and-white context.

## Opportunities to explore

**Hierarchy**
- Splits clearly dominant, "by Fajr Brews" clearly secondary but still readable. Try different relationships: stacked, inline baseline, attribution tucked under or beside the wordmark, attribution hidden on very small screens with a sensible fallback.

**Logo mark**
- Move beyond the generic coffee cup. The mark should be simple and distinctive. Directions worth trying: a split or divided shape, two complementary halves that fit together, sharing or passing between people, or a custom S. A coffee reference (bean, steam, cup edge) is optional, never required.
- Must stay legible at about 16 to 24px (browser tab, mobile header) and work in one colour.

**Typography**
- Look for readable, distinctive type. Intended personalities, not prescriptions:
  - Modern: contemporary and confident.
  - Classic: timeless, warm, potentially more editorial.
- You may propose better alternatives to the current fonts. Explain why.

**Theme compatibility**
- Show the identity working in **both** themes, respecting each one's personality and colour system. The two versions should feel like the same product but should not be identical. Do not just recolour one design. Consider whether the mark itself, the wordmark weight or the spacing should differ per theme.
- Show light and dark for at least the strongest direction.

## Practical limits

- Anything proposed must be realistic for a web app: a mark that can be an SVG, fonts available as web fonts, and a header that does not grow much taller.
- Please do not claim to have verified font licensing, loading speed, rendering or layout-shift behaviour. These are flagged for later technical checking: font loading and fallback behaviour, cumulative layout shift when a custom font loads, performance cost of any additional font family, whether the mark renders crisply in the browser tab and in printed or PDF invoices.
- Colours: stay inside each theme's palette family unless you have a clear reason. Treat any new colour as a suggestion to be justified.

## What to deliver

1. **3 to 4 genuinely different header/identity directions.** Different ideas, not variations of one. Each with a one-line rationale.
2. **Your recommendation** of the strongest direction and why, including any font suggestions and trade-offs.
3. **Refined mockups of that direction**, desktop and mobile, in **both** themes (Classic/Emerald and Modern/YInMn).
4. **Small-size check**: the mark at tab-icon and mobile-header size, and a one-colour version.

Keep the rest of each screen recognisable (tabs, user menu, page content) so the brand change can be judged in context.

## Screenshots to attach

Most useful, in this order:

1. A desktop view of the home or order screen in Emerald (light), showing the full header.
2. The same screen in YInMn (light).
3. A mobile view of the same screen in each theme, showing the compact header.
4. The sign-in screen (desktop and mobile), where the brand is most prominent.
5. One dark-mode screenshot per theme.
6. An invoice view, if available, to show how the name appears on a document.

These are included in `design-exploration/screenshots/` beside this file:

- `emerald-light-desktop-home.png`, `emerald-light-desktop-summary.png`, `emerald-light-desktop-invoices.png`
- `yinmn-light-desktop-home.png`, `yinmn-light-desktop-summary.png`, `yinmn-light-desktop-invoices.png`
- `emerald-light-mobile-home.png`, `emerald-light-mobile-summary.png`
- `emerald-dark-mobile-home.png`, `emerald-dark-mobile-summary.png`
- `auth-desktop.png`, `auth-mobile.png`

Gaps: there are no YInMn mobile screenshots and no YInMn dark screenshots. Stitch should extrapolate from the Emerald mobile and dark screens and the YInMn desktop screens, or those can be captured separately. These screenshots predate the Splits rename, so they still show the old "Fajr Brews / Coffee Splitter" header.
