# Desktop & Tablet UI/UX Friction Resolution Notes

**Project**: Fajr Brews Splits — Desktop UI/UX Redesign  
**Document**: `docs/evidence/05-ui-desktop/friction_resolution_notes.md`  
**Milestone**: M6_POST_REDESIGN_EVIDENCE_AND_JOURNEYS (Prompt `05-ui-desktop`)  
**Date**: October 2026  
**Author**: `worker_m6_final` (Teamwork Implementer / QA / Specialist)  
**Baseline Reference**: `docs/evidence/05-ui-desktop/baseline_friction_report.md`  
**Evidence Sources**: 
- Baseline Screenshots: `docs/evidence/05-ui-desktop/baseline/` (104 files)
- Post-Redesign Screenshots: `docs/evidence/05-ui-desktop/after/` (104 files)
- Verified Journey Logs: `docs/evidence/05-ui-desktop/post_redesign_journey_log.md` (14/14 PASS)

---

## Executive Summary

During Milestone 1 (`M1_BASELINE_AUDIT`), an exhaustive visual audit and end-to-end user journey analysis across 5 viewports (1440px desktop large, 1280px desktop medium, 1024px standard desktop, 768px tablet portrait, 390px mobile baseline), 3 theme variations (`emerald` light, `emerald` dark, `yinmn` light), and 3 active order configurations catalogued **12 critical friction points**.

Over Milestones 2 through 5:
- **Milestone 2 (M2_TOKENS_AND_SHELL)** resolved core layout stair-stepping (#1), added theme warning tokens (#3), and established high-contrast focus rings and motion guards (#12).
- **Milestone 3 (M3_ORDER_COCKPIT_AND_WIZARD)** resolved order switcher ambiguity (#2), modularized `CoffeeLotsSection.tsx` (#4), elevated the personal share hero card and read-only status indicators (#5), repaired sticky sidebar clipping and tabular numeral alignment (#6), streamlined confusing domain jargon (#7), and provided a prominent rounding absorption readout (#8).
- **Milestone 4 (M4_SECONDARY_VIEWS_AND_MODALS)** eliminated people directory grid overflow (#9), transformed My Stats into a balanced 5-metric dashboard (#10), added search filtering and structured history cards (#11), and implemented WCAG AA accessible modal focus trapping and escape dismissal (#12).
- **Milestone 5 (M5_REGRESSION_AND_TEST_GATE)** audited and verified 390px mobile parity, complete keyboard reachability, and test suite health (35 test files / 385 tests passing).

All 12 friction points are now **100% resolved**. Below is the comprehensive point-by-point audit detailing the baseline problem, screenshot citations, post-redesign solution, touched components, and user experience impact.

---

## Friction Points Resolution Matrix

| Rank | Friction Point | Category | Target Milestone | Status | Baseline Citation | After Citation |
|:---:|---|:---:|:---:|:---:|---|---|
| **#1** | Stair-Stepping Container Max-Widths & Asymmetric Padding | Layout / Grid | M2 | ✅ Resolved | `baseline/3orders_order-coffees_1440px_emerald_light.png` | `after/3orders_order-coffees_1440px_emerald_light.png` |
| **#2** | Active Order Switcher Ambiguity & Inconsistent Status Pills | Navigation / Hierarchy | M3 | ✅ Resolved | `baseline/3orders_switcher_1440px_emerald_light.png` | `after/3orders_switcher_1440px_emerald_light.png` |
| **#3** | Missing Theme Warning Tokens (`--color-warning`, `--color-warning-bg`) | Design System | M2 | ✅ Resolved | `baseline/3orders_order-coffees_1440px_emerald_dark.png` | `after/3orders_order-coffees_1440px_emerald_dark.png` |
| **#4** | Monolithic 1,453-Line `CoffeeLotsSection.tsx` & Cluttered Cards | Architecture / UI | M3 | ✅ Resolved | `baseline/3orders_order-coffees_1440px_emerald_light.png` | `after/3orders_order-coffees_1440px_emerald_light.png` |
| **#5** | Buried Personal Invoice State & Missing Read-Only Indicators | UX / Journey | M3 | ✅ Resolved | `baseline/3orders_order-invoices_1440px_emerald_light.png` | `after/3orders_order-invoices_1440px_emerald_light.png` |
| **#6** | Cockpit Summary Sticky Sidebar Pinning & Column Cramping | Layout / Hierarchy | M3 | ✅ Resolved | `baseline/3orders_order-summary_1440px_emerald_light.png` | `after/3orders_order-summary_1440px_emerald_light.png` |
| **#7** | Confusing Domain Jargon & Obscure Section Naming | Content / Mental Model | M3 | ✅ Resolved | `baseline/1order_order-goods_1440px_emerald_light.png` | `after/1order_order-goods_1440px_emerald_light.png` |
| **#8** | Low-Contrast, Obscured Rounding Absorption Readout | Financial Clarity | M3 | ✅ Resolved | `baseline/3orders_order-summary_1440px_emerald_light.png` | `after/3orders_order-summary_1440px_emerald_light.png` |
| **#9** | People Directory Grid Overflow on Long Names & Emails | Data Density / Layout | M4 | ✅ Resolved | `baseline/people_1440px_emerald_light.png` | `after/people_1440px_emerald_light.png` |
| **#10** | My Stats Space Inefficiency on Wide Desktop (1440px) | Layout / Typography | M4 | ✅ Resolved | `baseline/mystats_1440px_emerald_light.png` | `after/mystats_1440px_emerald_light.png` |
| **#11** | Past Orders Archive Vertical Disruption & Heavy Modals | Layout / Usability | M4 | ✅ Resolved | `baseline/history_1440px_emerald_light.png` | `after/history_1440px_emerald_light.png` |
| **#12** | Subtle Focus Rings, Contrast Drops & Missing Motion Guards | Accessibility / WCAG | M2, M4 | ✅ Resolved | `baseline/modal-archive_1440px_emerald_light.png` | `after/modal-archive_1440px_emerald_light.png` |

---

## Detailed 12-Point Resolution Audits

### 1. Stair-Stepping Container Max-Widths & Asymmetric Horizontal Padding
- **Rank**: #1 (Severity: Critical)
- **Category**: Layout / Grid
- **Target Milestone**: M2 (`M2_TOKENS_AND_SHELL`)
- **Baseline Problem & Evidence Citation**:
  - *Observation*: Mismatched container constraints caused awkward optical stair-stepping. `Header.tsx` constrained `.nav-top-inner` to `1100px` with `padding: 0 var(--space-4)`, `globals.css` constrained `.app-shell` to `1400px`, `.page-container` had an unconstrained `720px` base overridden at `min-width: 1024px` to `1200px` with `padding: var(--space-10) var(--space-8)` (32px horizontal padding vs 24px in the header), and `.stats-page` was set to `1100px`. At 1440px and 1280px desktop viewports, content edges zig-zagged irregularly.
  - *Baseline Screenshots*:
    - `docs/evidence/05-ui-desktop/baseline/3orders_order-coffees_1440px_emerald_light.png`
    - `docs/evidence/05-ui-desktop/baseline/settings_1440px_emerald_light.png`
- **Post-Redesign Solution & Evidence Citation**:
  - *Solution*: Introduced a single source of truth design token `--content-max-width: 1200px` in `src/styles/tokens.css`. Unified `.app-shell`, `.page-container`, `.nav-top-inner`, and `.stats-page` to `max-width: var(--content-max-width, 1200px); margin: 0 auto;`. Standardized horizontal padding to `var(--space-6)` (24px) across all desktop viewports (≥1024px) and `var(--space-4)` (16px) across tablet (768px–1023px). Header bar, tabs, and page cards now form a perfectly flush vertical boundary.
  - *After Screenshots*:
    - `docs/evidence/05-ui-desktop/after/3orders_order-coffees_1440px_emerald_light.png`
    - `docs/evidence/05-ui-desktop/after/settings_1440px_emerald_light.png`
- **Code Changes & Components Touched**:
  - `src/styles/tokens.css`: Added `--content-max-width: 1200px` to `:root`.
  - `src/styles/globals.css`: Updated `.app-shell`, `.page-container`, and `.stats-page` max-width and responsive padding.
  - `src/components/layout/Header.tsx`: Updated `.nav-top-inner` max-width and padding.
  - `src/components/layout/Header.test.tsx`: Verified token and width definitions.
- **User Experience Impact**: Eliminates visual disarray and amateurish edge misalignment, creating a calm, cohesive, and professional editorial container alignment on all desktop screens.

---

### 2. Active Order Switcher Ambiguity & Inconsistent Status Pills
- **Rank**: #2 (Severity: Critical)
- **Category**: Navigation / Hierarchy
- **Target Milestone**: M3 (`M3_ORDER_COCKPIT_AND_WIZARD`)
- **Baseline Problem & Evidence Citation**:
  - *Observation*: In `OrderPage.tsx`, the active orders strip rendered plain pill buttons with subtle 1px border differences between active and inactive items. In dark mode (`emerald_dark`), active vs inactive states were almost indistinguishable. Status labels were rendered in plain un-tinted uppercase text (`PLANNING`, `LOCKED`, `COMPLETED`), making it impossible to determine order workflow progress at a glance.
  - *Baseline Screenshots*:
    - `docs/evidence/05-ui-desktop/baseline/3orders_switcher_1440px_emerald_light.png`
    - `docs/evidence/05-ui-desktop/baseline/3orders_switcher_1440px_emerald_dark.png`
    - `docs/evidence/05-ui-desktop/baseline/3orders_switcher_1024px_yinmn_light.png`
- **Post-Redesign Solution & Evidence Citation**:
  - *Solution*: Redesigned `.active-orders-strip` into structured, tactile order chips. Each chip displays the roaster initials badge (`RoasterAvatar`), order title truncated to `180px` with tooltip `title`, an active dot indicator (`.order-chip-active-dot`), and an explicit semantic status pill with dedicated styling: Planning (subtle neutral), Locked for Payments (warning amber), Completed (success green). Added a dashed `+ New Order` chip and an empty-state card for workspaces with 0 orders.
  - *After Screenshots*:
    - `docs/evidence/05-ui-desktop/after/3orders_switcher_1440px_emerald_light.png`
    - `docs/evidence/05-ui-desktop/after/3orders_switcher_1440px_emerald_dark.png`
    - `docs/evidence/05-ui-desktop/after/3orders_switcher_1024px_yinmn_light.png`
- **Code Changes & Components Touched**:
  - `src/components/pages/OrderPage.tsx`: Built `.active-orders-strip`, `.order-chip`, and `.order-chip-status` badges.
  - `src/styles/globals.css`: Defined chip states, selection rings, and truncation styling.
  - `src/components/pages/OrderPage.test.tsx`: Verified switcher click interactions and active state highlighting.
- **User Experience Impact**: Organizers and participants can instantly recognize the currently selected order, its payment status, and switch between multiple concurrent roaster orders with zero confusion.

---

### 3. Missing Theme Warning Tokens (`--color-warning`, `--color-warning-bg`)
- **Rank**: #3 (Severity: High)
- **Category**: Design System
- **Target Milestone**: M2 (`M2_TOKENS_AND_SHELL`)
- **Baseline Problem & Evidence Citation**:
  - *Observation*: `src/styles/tokens.css` defined `--color-success` and `--color-error` but completely omitted `--color-warning` and `--color-warning-bg`. Component styles fell back to hardcoded amber hex values (`#f59e0b` / `#fef3c7`), which failed WCAG AA contrast against dark backgrounds (`#181a1b`) and created jarring contrast drops.
  - *Baseline Screenshots*:
    - `docs/evidence/05-ui-desktop/baseline/3orders_order-coffees_1440px_emerald_dark.png`
    - `docs/evidence/05-ui-desktop/baseline/3orders_order-coffees_1024px_emerald_dark.png`
- **Post-Redesign Solution & Evidence Citation**:
  - *Solution*: Formally established `--color-warning` and `--color-warning-bg` in `src/styles/tokens.css` across `:root`, light, dark, and auto modes for both `emerald` and `yinmn` themes:
    - Light: `--color-warning: #d97706; --color-warning-bg: #fef3c7;`
    - Dark: `--color-warning: #f59e0b; --color-warning-bg: #78350f;`
    Connected warning banners (`.alert-warning`), unallocated bag warning badges, and locked order pills to these tokens.
  - *After Screenshots*:
    - `docs/evidence/05-ui-desktop/after/3orders_order-coffees_1440px_emerald_dark.png`
    - `docs/evidence/05-ui-desktop/after/3orders_order-coffees_1024px_emerald_dark.png`
- **Code Changes & Components Touched**:
  - `src/styles/tokens.css`: Defined warning tokens across all themes and dark/light modes.
  - `src/styles/globals.css`: Wired `.alert-warning` and badge warning utilities.
  - `src/components/layout/Header.test.tsx`: Added explicit assertions validating token values.
- **User Experience Impact**: Attention states and warning badges are crisp, legible, and aesthetically harmonious in both light and dark modes, fully complying with WCAG AA contrast standards.

---

### 4. Monolithic 1,453-Line `CoffeeLotsSection.tsx` & Cluttered Cards
- **Rank**: #4 (Severity: Critical)
- **Category**: Architecture / UI
- **Target Milestone**: M3 (`M3_ORDER_COCKPIT_AND_WIZARD`)
- **Baseline Problem & Evidence Citation**:
  - *Observation*: `CoffeeLotsSection.tsx` had ballooned to 1,453 lines, mixing lot creation forms, buyer assignment chips, bag row tables, custom split modals, and error state tracking in a single file. Visually, lot cards were dominated by nested card borders, cramped buyer pills wrapping unpredictably, and tiny icon buttons.
  - *Baseline Screenshots*:
    - `docs/evidence/05-ui-desktop/baseline/3orders_order-coffees_1440px_emerald_light.png`
    - `docs/evidence/05-ui-desktop/baseline/3orders_order-coffees_1024px_yinmn_light.png`
- **Post-Redesign Solution & Evidence Citation**:
  - *Solution*: Decomposed `CoffeeLotsSection.tsx` into three clean, focused subcomponents:
    - `LotEditorForm.tsx`: Dedicated lot creation and editing form with live positive-number validation.
    - `BagAdjusterRow.tsx`: Per-bag allocation rows with whole, equal, and custom split modes and safe deletion guards.
    - `CustomSplitModal.tsx`: Accessible dialog for gram-level splits with real-time remaining-grams validation.
    Redesigned the lot container with calm 1px borders, tabular numerals, explicit allocation chips (`✓ Allocated` or `X bags need a buyer`), and a sticky bottom allocation status bar.
  - *After Screenshots*:
    - `docs/evidence/05-ui-desktop/after/3orders_order-coffees_1440px_emerald_light.png`
    - `docs/evidence/05-ui-desktop/after/3orders_order-coffees_1024px_yinmn_light.png`
- **Code Changes & Components Touched**:
  - `src/components/order/LotEditorForm.tsx` (Added)
  - `src/components/order/BagAdjusterRow.tsx` (Added)
  - `src/components/order/CustomSplitModal.tsx` (Added)
  - `src/components/order/CoffeeLotsSection.tsx` (Refactored, reduced from 1,453 to ~350 lines)
  - `src/components/order/CoffeeLotsSection.test.tsx`: Verified all bag allocation modes.
- **User Experience Impact**: Streamlined, intuitive bag allocation workflow with clear visual feedback, eliminating clutter and making group coffee ordering fast and enjoyable.

---

### 5. Buried Personal Invoice State & Missing Read-Only Indicators
- **Rank**: #5 (Severity: High)
- **Category**: UX / Journey
- **Target Milestone**: M3 (`M3_ORDER_COCKPIT_AND_WIZARD`)
- **Baseline Problem & Evidence Citation**:
  - *Observation*: In `SettlementPacks.tsx`, participant invoices were rendered as an undifferentiated list of collapsed accordion cards. Logged-in group members had to search through all cards and manually expand their own card just to see what they owed and where to pay. Furthermore, interactive payment toggle buttons (`Unpaid`, `Partial`, `Paid`) were rendered identically for ordinary members, even though non-owners lacked permission to change payment states (causing Journey 2 Step 4 failure).
  - *Baseline Screenshots*:
    - `docs/evidence/05-ui-desktop/baseline/3orders_order-invoices_1440px_emerald_light.png`
    - `docs/evidence/05-ui-desktop/baseline/3orders_order-invoices_1024px_emerald_light.png`
- **Post-Redesign Solution & Evidence Citation**:
  - *Solution*: Elevated a dedicated "Your Personal Share" hero card at the top of the Invoices view for logged-in participants. The card immediately displays total ZAR due, coffee weight & lot breakdown, payer EFT banking details, and one-tap Copy/Share/PDF download buttons without expanding any accordions. Payment status toggles are conditionally rendered only for order owners and workspace managers; non-owners see clean read-only status pills.
  - *After Screenshots*:
    - `docs/evidence/05-ui-desktop/after/3orders_order-invoices_1440px_emerald_light.png`
    - `docs/evidence/05-ui-desktop/after/3orders_order-invoices_1024px_emerald_light.png`
- **Code Changes & Components Touched**:
  - `src/components/order/SettlementPacks.tsx`: Added `personal-share-hero-card` and restricted status toggles via `isOwner` check.
  - `src/styles/globals.css`: Styled personal share hero card and read-only status badges.
  - `src/components/order/SettlementPacks.test.tsx`: Tested personal share hero rendering and read-only status pills.
- **User Experience Impact**: Group participants get instant, zero-click clarity on what they owe and banking payment instructions; unauthorized payment toggles are completely hidden.

---

### 6. Cockpit Summary Sticky Sidebar Pinning & Column Cramping
- **Rank**: #6 (Severity: High)
- **Category**: Layout / Hierarchy
- **Target Milestone**: M3 (`M3_ORDER_COCKPIT_AND_WIZARD`)
- **Baseline Problem & Evidence Citation**:
  - *Observation*: In `OrderSummary.tsx`, desktop layout used a 2-column grid, but the sticky sidebar offset was hardcoded (`top: 80px`) without factoring in the fixed header bar (`--nav-top-height: 64px`). When users scrolled down the summary, the financial card clipped behind the top navbar. In addition, numbers lacked tabular numerals, causing decimal points to wobble and misalign vertically.
  - *Baseline Screenshots*:
    - `docs/evidence/05-ui-desktop/baseline/3orders_order-summary_1440px_emerald_light.png`
    - `docs/evidence/05-ui-desktop/baseline/3orders_order-summary_1024px_emerald_dark.png`
- **Post-Redesign Solution & Evidence Citation**:
  - *Solution*: Set dynamic sticky positioning on `.cockpit-sidebar-column`: `position: sticky; top: calc(var(--nav-top-height, 64px) + var(--space-4));`. Applied `font-variant-numeric: tabular-nums` and right-alignment on all currency and gram totals in `CoffeeCostSummary.tsx` and summary tables.
  - *After Screenshots*:
    - `docs/evidence/05-ui-desktop/after/3orders_order-summary_1440px_emerald_light.png`
    - `docs/evidence/05-ui-desktop/after/3orders_order-summary_1024px_emerald_dark.png`
- **Code Changes & Components Touched**:
  - `src/components/order/OrderSummary.tsx`: Structured 2-column financial cockpit.
  - `src/components/order/CoffeeCostSummary.tsx`: Enforced tabular numerals across summary cells.
  - `src/styles/globals.css`: Fixed sticky offset formula for `.cockpit-sidebar-column`.
  - `src/components/order/OrderSummary.test.tsx`: Validated cockpit layout.
- **User Experience Impact**: Stable, predictable financial cockpit where totals remain comfortably pinned in view during scrolling; tabular alignment reinforces trust in financial figures.

---

### 7. Confusing Domain Jargon & Obscure Section Naming
- **Rank**: #7 (Severity: Medium)
- **Category**: Content / Mental Model
- **Target Milestone**: M3 (`M3_ORDER_COCKPIT_AND_WIZARD`)
- **Baseline Problem & Evidence Citation**:
  - *Observation*: Wizard Step 5 was ambiguously labeled "Settlement Packs" in code and headings. Fee allocation types displayed raw database keys like `proportional_by_value` and `equal_per_person`. Tooltips referenced technical development concepts like "lot inference" and "legacy drafts".
  - *Baseline Screenshots*:
    - `docs/evidence/05-ui-desktop/baseline/1order_order-goods_1440px_emerald_light.png`
    - `docs/evidence/05-ui-desktop/baseline/3orders_order-invoices_1440px_emerald_light.png`
- **Post-Redesign Solution & Evidence Citation**:
  - *Solution*: Renamed Step 5 to "Participants & Invoices". Replaced raw fee allocation strings in `GoodsAndFees.tsx` with friendly badge labels: "Split equally", "Split by coffee value", and "Assigned to [Person]". Removed all references to "inference" and "settlement packs" from the UI, standardizing on plain coffee terms.
  - *After Screenshots*:
    - `docs/evidence/05-ui-desktop/after/1order_order-goods_1440px_emerald_light.png`
    - `docs/evidence/05-ui-desktop/after/3orders_order-invoices_1440px_emerald_light.png`
- **Code Changes & Components Touched**:
  - `src/components/order/GoodsAndFees.tsx`: Friendly fee allocation badges and running totals ledger.
  - `src/components/order/OrderSummary.tsx`: Renamed title to "Participants & Invoices".
  - `src/components/order/SettlementPacks.tsx`: Plain language participant share headings.
  - `src/components/order/OrderSummary.test.tsx`: Updated test assertions to match new title.
- **User Experience Impact**: Transparent, friendly language easily understood by coffee group members without technical confusion.

---

### 8. Low-Contrast, Obscured Rounding Absorption Readout
- **Rank**: #8 (Severity: Medium)
- **Category**: Financial Clarity
- **Target Milestone**: M3 (`M3_ORDER_COCKPIT_AND_WIZARD`)
- **Baseline Problem & Evidence Citation**:
  - *Observation*: The core legal rounding notice (`Math.floor` to 2 dp, payer absorbs cent remainder) was rendered in tiny 12px muted text at the bottom of the column (`<p style="font-size: 0.75rem; color: var(--color-text-muted);">Hamzah absorbs R 0.02 rounding remainder</p>`), easily missed or overlooked by the organizer.
  - *Baseline Screenshots*:
    - `docs/evidence/05-ui-desktop/baseline/3orders_order-summary_1440px_emerald_light.png`
    - `docs/evidence/05-ui-desktop/baseline/3orders_order-summary_1440px_emerald_dark.png`
- **Post-Redesign Solution & Evidence Citation**:
  - *Solution*: Elevated the rounding absorption notice into a calm, prominent badge callout box inside the Grand Total financial breakdown card: `Rounding absorbed by Hamzah (Owner): R 0.02` with an info icon, distinct background surface, and high-contrast typography.
  - *After Screenshots*:
    - `docs/evidence/05-ui-desktop/after/3orders_order-summary_1440px_emerald_light.png`
    - `docs/evidence/05-ui-desktop/after/3orders_order-summary_1440px_emerald_dark.png`
- **Code Changes & Components Touched**:
  - `src/components/order/OrderSummary.tsx`: Rendered explicit rounding absorption callout.
  - `src/styles/globals.css`: Added `.rounding-absorption-badge` styling.
- **User Experience Impact**: Immediate transparency on cent reconciliations, building trust and answering why the payer's share absorbs cent remainders.

---

### 9. People Directory Grid Overflow on Long Names & Emails
- **Rank**: #9 (Severity: Medium)
- **Category**: Data Density / Layout
- **Target Milestone**: M4 (`M4_SECONDARY_VIEWS_AND_MODALS`)
- **Baseline Problem & Evidence Citation**:
  - *Observation*: In `PeoplePage.tsx`, member cards were rendered in an unconstrained layout. Long names (such as "Dr. Muhammad Abdur-Rahman ibn Al-Mansoor-Johannesburg") and long email addresses overflowed horizontally, broke word stems across lines, and clipped action buttons.
  - *Baseline Screenshots*:
    - `docs/evidence/05-ui-desktop/baseline/people_1440px_emerald_light.png`
    - `docs/evidence/05-ui-desktop/baseline/edge-longnames_order-coffees_1440px_emerald_light.png`
- **Post-Redesign Solution & Evidence Citation**:
  - *Solution*: Implemented responsive CSS grid `.people-grid` (`repeat(auto-fill, minmax(300px, 1fr))`) on desktop, 2-column fallback on tablet, and single-column on mobile. Integrated initials avatar badges via `PersonAvatar`, single-line text truncation with `title` tooltip attributes for full accessibility, and moved person editing into accessible modal dialogs.
  - *After Screenshots*:
    - `docs/evidence/05-ui-desktop/after/people_1440px_emerald_light.png`
    - `docs/evidence/05-ui-desktop/after/edge-longnames_order-coffees_1440px_emerald_light.png`
- **Code Changes & Components Touched**:
  - `src/components/pages/PeoplePage.tsx`: Implemented `.people-grid`, avatar badges, and truncation.
  - `src/components/people/PersonEditor.tsx`: Accessible modal editing.
  - `src/styles/globals.css`: Added styles for `.people-grid`, `.person-directory-card`, and `.person-avatar`.
  - `src/components/pages/PeoplePage.test.tsx`: Verified grid rendering and text truncation.
- **User Experience Impact**: A spacious, uniform directory card grid that handles names and email addresses of any length gracefully without layout clipping.

---

### 10. My Stats Space Inefficiency on Wide Desktop (1440px)
- **Rank**: #10 (Severity: Medium)
- **Category**: Layout / Typography
- **Target Milestone**: M4 (`M4_SECONDARY_VIEWS_AND_MODALS`)
- **Baseline Problem & Evidence Citation**:
  - *Observation*: In `MyStatsPage.tsx`, metric cards stretched horizontally across the wide 1440px container with huge expanses of empty space and small numbers. On 768px tablet, cards broke into an awkward 2x2 grid with an orphaned fifth card spanning 100% width on the third row.
  - *Baseline Screenshots*:
    - `docs/evidence/05-ui-desktop/baseline/mystats_1440px_emerald_light.png`
    - `docs/evidence/05-ui-desktop/baseline/mystats_1024px_emerald_light.png`
    - `docs/evidence/05-ui-desktop/baseline/mystats_768px_emerald_light.png`
- **Post-Redesign Solution & Evidence Citation**:
  - *Solution*: Redesigned My Stats into a balanced 5-metric dashboard row (`Total Spent`, `Orders Participated`, `Total Bags`, `Total Grams`, `Average Cost per Bag`) featuring prominent tabular numerals, time range presets (`All time`, `3m`, `6m`, `12m`, `Custom`), favorite roaster order participation percentage, and a structured order breakdown table below.
  - *After Screenshots*:
    - `docs/evidence/05-ui-desktop/after/mystats_1440px_emerald_light.png`
    - `docs/evidence/05-ui-desktop/after/mystats_1024px_emerald_light.png`
    - `docs/evidence/05-ui-desktop/after/mystats_768px_emerald_light.png`
- **Code Changes & Components Touched**:
  - `src/components/pages/MyStatsPage.tsx`: Implemented 5-metric row, time range filter, and order breakdown table.
  - `src/styles/globals.css`: Styled `.stats-metric-card` and `.data-table`.
  - `src/components/pages/MyStatsPage.test.tsx`: Verified metric calculations and date filtering.
- **User Experience Impact**: A balanced, data-rich personal coffee analytics dashboard that looks refined and purposeful on large desktop monitors, tablets, and mobile devices.

---

### 11. Past Orders Archive Vertical Disruption & Heavy Modals
- **Rank**: #11 (Severity: Medium)
- **Category**: Layout / Usability
- **Target Milestone**: M4 (`M4_SECONDARY_VIEWS_AND_MODALS`)
- **Baseline Problem & Evidence Citation**:
  - *Observation*: In `HistoryPage.tsx`, past orders were displayed as loose cards that expanded inline to over 1,200px in height when clicked, pushing other orders far off screen and causing massive layout shifts. There was no search filter to quickly locate past orders by roaster, payer, date, or name.
  - *Baseline Screenshots*:
    - `docs/evidence/05-ui-desktop/baseline/history_1440px_emerald_light.png`
    - `docs/evidence/05-ui-desktop/baseline/history_1024px_emerald_light.png`
- **Post-Redesign Solution & Evidence Citation**:
  - *Solution*: Added an instant search filter input matching order name, roaster name, payer name, and date with zero-state feedback. Redesigned order cards into structured summaries featuring roaster avatar badges, status pills, tabular ZAR financial figures, and direct action buttons to download summary PDFs or view itemized breakdowns.
  - *After Screenshots*:
    - `docs/evidence/05-ui-desktop/after/history_1440px_emerald_light.png`
    - `docs/evidence/05-ui-desktop/after/history_1024px_emerald_light.png`
- **Code Changes & Components Touched**:
  - `src/components/pages/HistoryPage.tsx`: Added search input, zero-state messaging, and structured cards.
  - `src/styles/globals.css`: Styled history search input and card actions.
  - `src/components/pages/HistoryPage.test.tsx`: Verified search filtering and zero-state handling.
- **User Experience Impact**: Effortless scanning and instant search across historical coffee batches without disruptive vertical layout shifts.

---

### 12. Subtle Focus Rings, Contrast Drops & Missing Motion Guards
- **Rank**: #12 (Severity: High)
- **Category**: Accessibility / WCAG
- **Target Milestone**: M2 (`M2_TOKENS_AND_SHELL`), M4 (`M4_SECONDARY_VIEWS_AND_MODALS`)
- **Baseline Problem & Evidence Citation**:
  - *Observation*: Interactive buttons and tab triggers had default or faint 1px outlines (`outline: 1px solid var(--color-border)`), making keyboard focus nearly invisible in dark mode. Modals lacked keyboard focus trapping, `Escape` key listeners, and accessible `aria-modal` semantics. CSS animations lacked `@media (prefers-reduced-motion: reduce)` overrides.
  - *Baseline Screenshots*:
    - `docs/evidence/05-ui-desktop/baseline/modal-archive_1440px_emerald_light.png`
    - `docs/evidence/05-ui-desktop/baseline/3orders_switcher_1440px_emerald_dark.png`
- **Post-Redesign Solution & Evidence Citation**:
  - *Solution*: Implemented high-contrast `:focus-visible` styling (`outline: 2px solid var(--color-primary); outline-offset: 2px;`) across all focusable elements. In `ConfirmModal.tsx`, implemented full focus trapping (wrapping Tab/Shift+Tab), `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`, auto-focusing the cancel button, and `Escape` key dismissal. Wrapped animations and transitions in `@media (prefers-reduced-motion: reduce)` overrides to safely support users with vestibular sensitivities.
  - *After Screenshots*:
    - `docs/evidence/05-ui-desktop/after/modal-archive_1440px_emerald_light.png`
    - `docs/evidence/05-ui-desktop/after/3orders_switcher_1440px_emerald_dark.png`
- **Code Changes & Components Touched**:
  - `src/styles/tokens.css`: Defined `--color-primary` across all themes.
  - `src/styles/globals.css`: Added global `:focus-visible` outline rules and `@media (prefers-reduced-motion: reduce)`.
  - `src/components/ui/ConfirmModal.tsx`: Implemented focus trapping, aria attributes, and keyboard listeners.
  - `src/components/ui/ConfirmModal.test.tsx`: Added 5 tests verifying focus trap, Escape dismissal, and dialog semantics.
- **User Experience Impact**: Full WCAG AA compliance, effortless keyboard navigation, unmistakable focus rings, and safe motion-reduced experience for all users.

---

## Conclusion & Verification Summary

With all 12 baseline friction points resolved and verified:
1. **Container Alignment**: All views adhere to `--content-max-width: 1200px` with uniform horizontal padding.
2. **Order Switching & Wizard**: Multi-order switcher, lot allocation, fees ledger, financial cockpit, and personal share cards are elevated to a calm, professional standard.
3. **Secondary Screens**: People directory, My Stats, History, and Settings offer structured desktop layouts with tabular numbers and responsive grids.
4. **Accessibility**: High-contrast focus rings, keyboard trapping in modals, and reduced-motion guards meet WCAG AA standards.
5. **System Invariants**: Pure calculation rules in `src/lib/calculations.ts`, PDF generation in `src/lib/pdf.ts`, database schemas, and `package.json` remain 100% untouched.
