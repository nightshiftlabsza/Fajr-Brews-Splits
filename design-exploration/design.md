# Splits (by Fajr Brews): Design Language

What the app looks like today, what is planned, and the rules the upcoming UI work follows. Source: the code (`tokens.css`, `globals.css`, `Header.tsx`, `index.html`) and the UI audit in `docs/UI_AUDIT.md` (PR #15). Nothing here comes from screenshots reviewed for this file. The audit itself ran the app and checked screens.

**Legend:** **[Current]** is in the code now. **[Planned]** is agreed direction, not built yet. **[Rule]** is enforced by UI prompts 14 to 17.

## 1. What the product is

A private ledger for a small group splitting imported specialty-coffee orders in rand. One organiser enters coffees, bags, who takes what and fees. Everyone else wants to see what they owe, pay by EFT and check history. The key screens are the Summary (who owes what), the invoices and Coffees & Bags (data entry).

Personality: **a well-kept ledger.** Precise, calm, trustworthy, a little warm. Not a café brand. Money is the content, so amounts must be the easiest thing on every screen to read.

## 2. Themes

Two themes, each with light, dark and auto modes, set on `<html>` with `data-theme` and `data-mode`. Layout, components and spacing are shared. Themes differ only in type and colour.

| | **Classic** = `emerald` ("Emerald Ledger") | **Modern** = `yinmn` ("YInMn Ledger") |
|---|---|---|
| Feel | Warm, editorial, timeless | Cool, crisp, contemporary |
| Accent, light **[Current]** | Deep emerald `#1B5E40` | YInMn blue `#2E4DAA` |
| Background, light **[Current]** | `#F4F7F2` (green-tinted) | `#EEF0F7` (blue-grey) |
| Dark accent **[Current]** | `#4ADE80` on `#0D1510` | blue on `#0F1524` |
| Headings **[Current]** | Fraunces | Space Grotesk |
| Body **[Current]** | Manrope | Inter |
| Headings **[Planned]** | Fraunces, weight 600 (keep) | Hanken Grotesk, weight 600 to 700 |
| Body **[Planned]** | Manrope 400/600/700 (keep) | Hanken Grotesk 400/500/600 |

Classic and Modern are our shorthand. The app labels them Emerald Ledger and YInMn Ledger.

Status colours (paid, partial, unpaid, warning) exist in both themes and must not be touched by any brand work. Colours live in `src/styles/tokens.css` as `--color-*` tokens. Components must use tokens, not hex values.

## 3. Foundations

**[Current]**
- **Spacing:** 4px base scale, `--space-1` (4px) to `--space-16` (64px).
- **Radius tokens:** 6, 10, 16, 24px and full. The CSS also hard-codes 4, 14, 18, 20 and 22px (a defect, see section 6).
- **Shadows:** four soft levels, used sparingly. No gradients beyond three, no glass, no glow.
- **Layout:** content max width 1200px, header 64px (`--nav-top-height`).
- **Breakpoints:** mobile below 768px, tablet 768 to 1023px, desktop 1024px and up. The CSS actually contains 11 variants (480, 767, 768, 900, 1023, 1024 and ranges).
- **Money:** a shared `.amount` style with `tabular-nums`. Currency is rand, formatted by `formatZAR`.
- **Buttons:** one system, `btn-primary`, `btn-secondary`, `btn-ghost`, `btn-danger`, in `sm`, `xs` and `lg` sizes.
- **Fonts:** loaded from Google Fonts in `index.html`: Fraunces, Manrope, Space Grotesk, Inter and IBM Plex Mono.

**[Planned]**
- Fonts self-hosted, reduced to Fraunces, Manrope and Hanken Grotesk. Space Grotesk, Inter and IBM Plex Mono dropped.
- A seven-step type scale as tokens, weights 400/600/700 only.
- A single radius scale used everywhere.

## 4. Header (current structure, keep it recognisable)

A sticky top bar, 64px tall. Left: brand block (the emoji logo, then "Fajr Brews" over "Coffee Splitter"). Middle (desktop): tab navigation. Right: user menu with a small realtime-sync dot. On phones the brand shrinks and navigation moves to a floating bottom bar.

**The brand lockup is being redesigned separately** as "Splits", with "by Fajr Brews" as the smaller attribution and "Coffee Splitter" removed. The exploration brief is `design-exploration/splits-brand-brief.md`. UI prompts 14 to 17 must not touch the brand name, logo or the header's brand block.

## 5. What is good and stays

- A real token file with two themes and three modes.
- The Emerald palette is restrained and coherent.
- `tabular-nums` is already on most money cells.
- Muted text passes AA contrast on the background (4.86:1 measured).
- The order wizard (Setup, Coffees & Bags, Goods & Fees, Summary, Invoices) matches the job.

The visual direction is right. The work is refinement, not a redesign.

## 6. Problems found (from the audit)

1. **Nested cards.** Up to four levels of border on the Summary; every participant row is its own card.
2. **Status shown twice.** Each participant row has a filled "Unpaid" control and an "UNPAID" pill. A column of solid green buttons outshines the real primary action. Long names break row alignment.
3. **Uppercase labels everywhere.** 15 uppercase rules and 11 letter-spacing values. When everything is a label, nothing is.
4. **Repeated identity marks.** The grey "OR" roaster tile appears 5 times on one screen; the order title and status badge are repeated; the logo is an emoji that renders differently on every device.
5. **No type system.** 30 font sizes, 29 inline weights, weight 800 used but never loaded, five font families loaded on every visit. Money has positive letter-spacing that pulls figures apart. Modern's Space Grotesk + Inter pairing reads as a generic SaaS template.
6. **Inconsistent controls.** Four tab styles, an unstyled native radio in the theme picker, emoji icons on the mode buttons.
7. **Phone layout.** The sticky "Finalize order" bar overlaps the bottom nav (about 24% of the screen). The cost table wraps coffee names a word per line. No page title on phones. Two-line uppercase nav labels.
8. **Contrast and format defects.** Warning text `#d97706` on `#fef3c7` is 2.86:1 (fails AA). My Stats shows "1,3 bags" next to "R1,501.61", two decimal formats on one card.
9. **Implementation debt.** 283 inline `style` props, 8 hard-coded hex colours, off-scale radii, a 2,294-line `globals.css`.

Not covered by the audit: the Goods & Fees step, People, open modals and dropdowns, keyboard use, screen readers, real phones, Safari.

## 7. Rules for UI prompts 14 to 17 **[Rule]**

1. **Money is the hero.** One amount style: tabular figures, no letter-spacing, right-aligned in lists. One hero total per screen. Amounts line up down a list.
2. **One level of card.** Inside a card, separate sections with spacing, a heading or a hairline rule, never another border. Lists are rows divided by rules.
3. **One signal per fact.** A status appears once; the payment control is the status. Destructive actions are text or outline, never filled beside the primary action.
4. **Sentence case.** Uppercase only for table column headers and compact status badges. Remove eyebrow labels that repeat their heading.
5. **A small type scale** of seven token sizes; weights 400, 600 and 700 only.
6. **One tab pattern** for page sections and **one segmented control** for choices, used everywhere.
7. **Phones get their own composition:** a page title, at most one sticky bar, tables that become stacked rows.
8. **Restraint.** No gradients, glass, illustrations or new animation. Faster and quieter, not busier.
9. **Tokens, not literals.** No new hard-coded colours, radii or font sizes; no new inline styles on touched pages.
10. **Contrast:** all text at least AA (4.5:1) in every theme and mode.

| Prompt | Scope |
|---|---|
| 14 | Type and theme foundations: self-hosted fonts, type scale, weights, number style |
| 15 | Shared components: tabs, segmented control, badges, buttons, radius scale, eyebrow cleanup, warning contrast, no emoji icons (except the brand mark) |
| 16 | Order flow composition: order header, Coffees, Summary and participant rows, Invoices, no nested cards |
| 17 | Phones and secondary pages: mobile title, nav and sticky bar, tables on phones, My Stats, Past Orders, Settings, sign-in, the "1,3" number bug |

## 8. Open items for later technical checks

- Hanken Grotesk is chosen from test renders only; confirm its licence file (SIL Open Font License) before self-hosting.
- Font loading, fallback stacks and layout shift for self-hosted fonts.
- Dark mode of the Modern theme after the font and colour changes.
- Print and PDF styles (`print.css` names Sora and Cormorant Garamond, which are never loaded).
