# UI audit (2026-10-27)

Design and visual-quality audit of `main` at `52ccb12`. It is the basis for UI prompts 4 and 6 to 8.

## How this was checked

- Ran the app (`vite`, dummy env) in Chromium with Playwright and served mocked Supabase responses: a signed-in owner, 8 people (one long double-barrelled name), 3 orders (planning, locked, completed), 2 coffees, 5 bags, 2 fees. No real data or backend.
- Screenshots at 390×844, 820×1180 and 1440×900, both themes, light and dark: active order (Coffees, Setup, Summary, Invoices), Past Orders, My Stats, Settings, sign-in. Real Google Fonts loaded.
- Read `tokens.css`, `globals.css`, `print.css`, `index.html` and the page components; counted patterns with grep. Measured contrast with the WCAG formula.
- Rendered the Summary screen with five candidate font setups (screens in the project's `design/fonts/` folder).

**Not checked:** the Goods & Fees step (the mock never reached it), People, modals and dropdowns open, keyboard-only use, screen readers, real phones, Safari. The Impeccable detector could not run in this sandbox; prompt 4 runs it locally. Prompt 4 starts by filling these gaps.

## What the product is

A private ledger for a small group splitting imported specialty-coffee orders in rand. One organiser enters the coffees, bags, who takes what and the fees, on desktop or phone. Everyone else mainly wants to know what they owe, pay it by EFT and check their history. The screens that matter most are the Summary (who owes what), the invoices that get sent, and Coffees & Bags, where the data is entered.

So the personality is **a well-kept ledger**: precise, calm, trustworthy, with a little warmth. It is not a café brand, and coffee imagery (the ☕ emoji logo) adds nothing. Money is the content: amounts must be the easiest thing on every screen to read and compare.

## What is already good, and stays

- A real token file with two themes × light/dark/auto, a 4px spacing scale and one button system (`btn-primary/secondary/ghost`, sizes) used throughout.
- The Emerald palette is restrained and coherent. Only three gradients and no glass, glow or decorative blobs.
- `tabular-nums` is already set on most money cells. Muted text passes AA (4.86:1 on the background).
- The order wizard structure (Setup → Coffees & Bags → Goods & Fees → Summary → Invoices) matches the job.

The problem is not the visual direction. It is **too many boxes, too many labels shouting, weak number typography and one generic theme**. The fix is refinement, not a redesign.

## Findings, by impact

### 1. Cards inside cards inside cards
Summary (desktop): page card → "Participants & Invoices" card → "Your personal share" card → two more bordered cards, with every participant row its own bordered card as well. That is four levels of border. Elsewhere: a stats card sits flush against the card above it on My Stats, and Coffees has an intro card that only holds a heading and a button. 73 `className="…card…"` uses. Borders are doing the job headings and spacing should do.

### 2. Status shown twice, controls that look like the main action
Each Summary participant row shows a filled dark-green "Unpaid" segmented button and an "UNPAID" pill beside it. Eight solid green buttons in a column outshine the real primary action, "Save to Past Orders". On a long name (Imraan Mohamed-Abrahams) the row wraps into a different layout, so amounts stop lining up. Amounts sit at a different x position on each row because the controls are placed after names of varying length.

### 3. Uppercase tracked "eyebrow" labels everywhere
15 `text-transform: uppercase` rules, with letter-spacing from 0.04 to 0.18em (11 different values). On one Summary screen: ORDER OVERVIEW, ORDER TOTAL & FINALIZATION, GRAND TOTAL, YOUR PERSONAL SHARE, YOU ARE THE ORDER PAYER, TOTAL AMOUNT DUE, EFT / BANKING DETAILS, plus every status pill and the mobile nav. When everything is a label, nothing is. This is the main "generic AI dashboard" tell in this app.

### 4. Repeated, meaningless identity marks
A grey "OR" initials tile stands in for the roaster logo when there isn't one. It appears 5 times on one order screen (pill strip ×3, order header, summary header). The order title and status badge are repeated in the order header and again in "Order overview" directly below it. The brand mark is the ☕ emoji (header and sign-in), which renders differently on every platform. The brand lockup (name, logo, header and sign-in mark) is being redesigned separately as "Splits, by Fajr Brews" (`design-exploration/splits-brand-brief.md`), so prompts 4 and 6 to 8 leave it alone; prompt 5 (Splits identity) owns it.

### 5. Typography has no system
- 30 distinct `font-size` values in `globals.css`, including 0.68, 0.72, 0.76, 0.78, 0.8, 0.82, 0.84 and 0.86rem. There is no type scale token.
- 29 inline `fontWeight` values in components. CSS uses weight 800 in two places, but 800 is never loaded, so the browser fakes it.
- The Google Fonts link loads five families on every visit (Fraunces, Manrope, Space Grotesk, Inter, IBM Plex Mono). `print.css` names Sora and Cormorant Garamond, which are never loaded. IBM Plex Mono is used once.
- Money letter-spacing: totals and stat values have positive tracking. With some fonts it pulls "R1,501.61" apart (seen clearly in the Schibsted test).
- Theme identity: **YInMn = Space Grotesk + Inter**, the most common AI-template pairing, and with this palette it reads like a generic SaaS tool. **Emerald = Fraunces + Manrope** has real character and renders well.

### 6. Three different tab styles and native controls
The top nav uses filled pills, Settings tabs are pills on an underline, and the wizard uses underline tabs. The sign-in "Sign in / Create account" switch is a fourth style. The theme picker uses an unstyled native blue radio inside a green card with a double border, and the light/dark/auto buttons use emoji (☀️ 🌙 🖥).

### 7. Phone layout problems
- Summary at 390px: the sticky "Finalize order" bar sits on top of the floating bottom nav. Together they cover about 24% of the screen (verified in a viewport screenshot). Content shows through the gap between them, and "Delete order" gets equal visual weight to "Save to Past Orders".
- The Coffee cost table at 390px wraps coffee names a word per line and the header "AVERAGE COST / BAG" onto three lines.
- No page title or app header on phones: the top of every screen is an empty band, then the order pill strip, which runs off the edge.
- The bottom nav uses two-line uppercase labels (ACTIVE / ORDERS, PAST / ORDERS).

### 8. Contrast and number-format defects (verified)
- Warning text `#d97706` on `#fef3c7` is **2.86:1**, and on the page background 2.95:1. Both fail WCAG AA (4.5:1). It is used for "Complete bag allocations to continue" and the Summary validation messages.
- My Stats shows "1,3 bags" (en-ZA decimal comma from `formatNumber`) next to "R1,501.61" (decimal point from `formatZAR`). Two number formats on one card row.

### 9. Implementation debt that drives inconsistency
- 283 inline `style={{…}}` in components, including 48 in HistoryPage, 35 in SettingsPage and 29 in GoodsAndFees, plus 8 hard-coded hex colours. This is why the same pattern looks different on different pages.
- Radii: tokens define 6/10/16/24px, but CSS also hard-codes 4, 14, 16, 18 (×5), 20 and 22px.
- `globals.css` has 2,294 lines with 11 breakpoint variants (767, 768, 900, 1023, 1024, 480 and ranges).

## Design direction

**A well-kept ledger, in two editions.** The layout, components and spacing are shared. The two themes differ in type and colour personality only, so there is one design to maintain.

| | Classic: Emerald Ledger | Modern: YInMn Ledger |
|---|---|---|
| Feel | Editorial, warm, timeless | Crisp, confident, contemporary |
| Headings and big totals | **Fraunces** (variable, opsz), weight 600 | **Hanken Grotesk** (variable), weight 600 to 700 |
| UI and body | **Manrope** 400/600/700 | **Hanken Grotesk** 400/500/600 |
| Numbers | Manrope tabular figures; Fraunces only for the one hero total per screen | Hanken tabular figures |
| Palette | As now | As now (YInMn blue), dark mode checked |

**Why these fonts:**
- **Keep Emerald's fonts.** Fraunces + Manrope already gives the classic theme its character, and the screenshots show it reads well. Changing it would be change for its own sake. I compared Source Serif 4 + Source Sans 3 (flatter, and its narrower body text shifted layouts) and Newsreader + Manrope (fine, but no better than Fraunces). The fix is how the fonts are used, not which ones.
- **Replace Space Grotesk + Inter with Hanken Grotesk** for the modern theme. It is one variable family, so one font file. Its figures stay tight with tabular-nums. It has more character than Inter without Space Grotesk's quirks. I rejected Instrument Sans (indistinguishable from Inter at UI sizes) and Schibsted Grotesk (its tabular figures space out money as "R1 , 501 . 61"). All three chosen fonts are SIL Open Font License, which allows self-hosting; prompt 4 must confirm this from each project's own licence file.
- **Drop** Space Grotesk, Inter, IBM Plex Mono, and the Sora and Cormorant references.

**Principles that the later prompts apply:**
1. **Money is the hero.** One amount style (tabular, no tracking, right-aligned in lists). One hero total per screen. Amounts line up down a list.
2. **One level of card.** Sections inside a card are separated by spacing, a heading or a hairline rule, not another border. Lists are rows divided by rules, not stacked cards.
3. **One signal per fact.** A status appears once. The payment control *is* the status. Destructive actions are text or outline, never filled beside the primary action.
4. **Sentence case.** Uppercase only for table column headers and compact status badges. Remove the eyebrow labels whose heading already says the same thing.
5. **A small type scale** of seven sizes as tokens, and weights 400/600/700 only.
6. **One tab pattern for page sections, one segmented control for choices,** used everywhere.
7. **Phones get their own composition:** a page title, one sticky bar at most, and tables that turn into stacked rows.
8. **Restraint stays.** No gradients, glass, illustrations or new animation. The app should feel faster and quieter, not busier.

## Batches

Numbered in run order, after the speed prompts 1 to 3.

| # | Prompt | Main files | Why this order |
|---|---|---|---|
| 4 | Type and theme foundations: self-hosted fonts, type scale, weights, number style | `index.html`, `tokens.css`, `globals.css`, `print.css`, `public/fonts/` | Everything else builds on the scale and fonts; almost no markup changes |
| 6 | Shared components: one tab pattern, segmented control, badges, buttons and destructive actions, radius scale, eyebrow cleanup, warning contrast, no emoji icons (except the brand mark) | `globals.css`, `tokens.css`, `Header`, `SettingsPage`, `AuthPage`, `ConfirmModal` | Fixes patterns once before pages are recomposed |
| 7 | Order flow composition: order header and switcher, Coffees allocation display, Summary and participant rows, Invoices; remove the nested cards | `OrderPage`, `CoffeeLotsSection`, `OrderSummary`, `SettlementPacks`, `CoffeeCostSummary`, `InvoiceView` | Most-used, highest-value screens |
| 8 | Phones and secondary pages: mobile title, nav and sticky bar, tables on phones, My Stats, Past Orders, Settings, sign-in, the "1,3" number bug, inline-style cleanup on touched pages | `App`, `Header`, `HistoryPage`, `MyStatsPage`, `SettingsPage`, `AuthPage`, `globals.css` | Builds on 6 and 7 |

Prompts 6 to 8 are written after each previous batch is reviewed, so they start from the real result.

## Skills and agents for Antigravity

Checked on 2026-10-27 against the two repos' READMEs and skill files.

- **Impeccable** (`pbakaus/impeccable`, Apache-2.0). Lists Google Antigravity as supported (`.agent/skills/`).
  - **Use:** the `npx impeccable detect src/` CLI, which runs 62 deterministic rules with no LLM or API key, as a before/after scan in every batch.
  - **Use:** `/impeccable critique`, `audit`, `typeset` and `layout` as the critic's checklist.
  - **Skip:** `init`, `live`, `craft`, `bolder`, `delight` and `overdrive`. We already give product context, and these push toward redesign or decoration.
  - **Skip:** the edit hooks. Antigravity is not one of the tools they support.
  - **Install:** project scope, and keep `.agent/` and any `PRODUCT.md`/`DESIGN.md` it writes out of git.
- **Emil Kowalski skills** (`emilkowalski/skills`, MIT). Use only three:
  - `emil-design-eng` for polish critique.
  - `break-ui` for worst-case data: long names, many people, zero orders.
  - `mobile-native` for phone details (tap highlight, input zoom, safe areas), in prompt 8.
  - Skip the animation skills (motion is not a problem here), `ask-sonner` and `pick-ui-library` (no new dependencies), `prototype` (no competing redesigns), and the Swift, Expo and Apple ones.
- **Multi-agent:** in each batch, use separate critic, font/CSS and responsive/regression agents. The main agent alone edits files and settles disagreements. Critics receive the acceptance criteria, not "review this".
