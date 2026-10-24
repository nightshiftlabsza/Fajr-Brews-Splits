# Desktop & Tablet Baseline UI/UX Friction Report

**Project**: Fajr Brews Splits — Desktop UI/UX Redesign  
**Document**: `docs/evidence/05-ui-desktop/baseline_friction_report.md`  
**Milestone**: M1_BASELINE_AUDIT (Prompt `05-ui-desktop`)  
**Date**: October 2026  
**Auditor**: `worker_m1` (Teamwork Preview Worker)  
**Evidence Source**: 104 verified baseline screenshots in `docs/evidence/05-ui-desktop/baseline/` and automated journey audit in `docs/evidence/05-ui-desktop/baseline_journey_log.md`

---

## Executive Summary

A comprehensive visual audit and end-to-end user journey analysis of Fajr Brews Splits was executed across 5 viewports (1440px desktop large, 1280px desktop medium, 1024px standard desktop, 768px tablet portrait, 390px mobile baseline), 3 theme/mode variations (`emerald` light, `emerald` dark, `yinmn` light), and 3 active order states (0 active orders, 1 active order, 3 active orders).

While the application’s underlying money calculations and Supabase data synchronization are mathematically robust, the desktop and tablet presentation exhibits significant visual incoherence, container stair-stepping, cognitive friction from technical jargon, and buried participant state.

Below is the prioritized, ranked catalogue of the **Top 12 Desktop & Tablet Friction Points**, complete with exact code locations, screenshot evidence, diagnostic before notes, and proposed architectural resolutions for subsequent milestones (M2 through M4).

---

## Friction Points Ranking Matrix

| Rank | Friction Point | Category | Impact | Affected Views | Target Milestone |
|:---:|---|---|:---:|---|:---:|
| **#1** | [Stair-Stepping Container Max-Widths & Asymmetric Padding](#1-stair-stepping-container-max-widths--asymmetric-horizontal-padding) | Layout / Grid | Critical | Shell, Header, All Pages | M2 |
| **#2** | [Active Order Switcher Ambiguity & Inconsistent Status Pills](#2-active-order-switcher-ambiguity--inconsistent-status-pills) | Navigation / Hierarchy | Critical | Multi-Order Switcher | M3 |
| **#3** | [Missing Theme Warning Tokens (`--color-warning`, `--color-warning-bg`)](#3-missing-theme-warning-tokens) | Design System | High | Tokens, Lots, Invoices | M2 |
| **#4** | [Monolithic 1,453-Line `CoffeeLotsSection.tsx` & Cluttered Cards](#4-monolithic-coffeelotssectiontsx--cluttered-lot-cards) | Architecture / UI | Critical | Wizard Step 2 (Coffees) | M3 |
| **#5** | [Buried Personal Invoice State & Missing Read-Only Indicators](#5-buried-personal-invoice-state--missing-read-only-indicators) | UX / Journey | High | Wizard Step 5 (Invoices) | M3 |
| **#6** | [Cockpit Summary Sticky Sidebar Pinning & Column Cramping](#6-cockpit-summary-sticky-sidebar-pinning--column-cramping) | Layout / Hierarchy | High | Wizard Step 4 (Summary) | M3 |
| **#7** | [Confusing Domain Jargon & Obscure Section Naming](#7-confusing-domain-jargon--obscure-section-naming) | Content / Mental Model | Medium | Wizard Tabs, Lot Modals | M3 |
| **#8** | [Low-Contrast, Obscured Rounding Absorption Readout](#8-low-contrast-obscured-rounding-absorption-readout) | Financial Clarity | Medium | Wizard Step 4 (Cockpit) | M3 |
| **#9** | [People Directory Grid Overflow on Long Names & Emails](#9-people-directory-grid-overflow-on-long-names--emails) | Data Density / Layout | Medium | People Page / Settings | M4 |
| **#10** | [My Stats Space Inefficiency on Wide Desktop (1440px)](#10-my-stats-space-inefficiency-on-wide-desktop) | Layout / Typography | Medium | My Stats Page | M4 |
| **#11** | [Past Orders Archive Vertical Disruption & Heavy Modals](#11-past-orders-archive-vertical-disruption--heavy-modals) | Layout / Usability | Medium | History Page | M4 |
| **#12** | [Subtle Focus Rings, Contrast Drops & Missing Motion Guards](#12-subtle-focus-rings-contrast-drops--missing-motion-guards) | Accessibility / WCAG | High | All Buttons, Modals, Forms | M2, M4 |

---

## Detailed Friction Point Audits

### 1. Stair-Stepping Container Max-Widths & Asymmetric Horizontal Padding
- **Severity**: Critical (Foundational layout defect)
- **Direct Observation**:
  - `Header.tsx` line 56: `.nav-top-inner` defines `max-width: 1100px; margin: 0 auto; padding: 0 var(--space-4);`.
  - `globals.css` line 34: `.app-shell` defines `max-width: 1400px; margin: 0 auto;`.
  - `globals.css` line 62: `.page-container` defines `max-width: 1200px; margin: 0 auto; padding: var(--space-6) var(--space-4);`.
  - `OrderPage.tsx` line 383: `.order-section-nav` renders at width `1136px`.
  - Automated measurement check output at 1440px viewport:
    ```json
    {
      "navTopInnerWidth": "1100px",
      "navTopInnerActual": 1100,
      "appShellWidth": "1400px",
      "pageContainerWidth": "1200px",
      "pageContainerActual": 1200,
      "orderNavWidth": 1136
    }
    ```
- **Visual Evidence**: `3orders_order-coffees_1440px_emerald_light.png`, `settings_1440px_emerald_light.png`.
- **Before Analysis**: On standard and wide desktop screens (1024px, 1280px, 1440px), the application headers and cards stair-step irregularly. The fixed header bar is narrower than the cards below it (1100px vs 1200px), while the shell spans 1400px. Content edges do not align vertically, creating an uncalm, amateur appearance.
- **Resolution Plan (M2)**: Unify `--content-max-width: 1200px` across `.nav-top-inner`, `.app-shell`, and `.page-container` with consistent `margin: 0 auto` and `padding: 0 var(--space-6)`.

---

### 2. Active Order Switcher Ambiguity & Inconsistent Status Pills
- **Severity**: Critical (Core workflow blocker)
- **Direct Observation**:
  - `OrderPage.tsx` lines 270–315: The active orders strip renders simple pill chips.
  - When 3 active orders are present (`order-tw-01` in `planning`, `order-manhattan-02` in `locked`, `order-friedhats-03` in `completed`), the chips lack distinct visual hierarchy. In dark mode, active vs inactive borders are barely distinguishable (1px subtle contrast difference).
  - Status indicators are plain uppercase text without standardized background tints, making it impossible to tell at a glance whether an order is in planning, locked for payments, or completed.
- **Visual Evidence**: `3orders_switcher_1440px_emerald_light.png`, `3orders_switcher_1440px_emerald_dark.png`, `3orders_switcher_1024px_yinmn_light.png`.
- **Before Analysis**: In a group managing multiple active coffee orders, users struggle to know immediately which order is currently active in the workspace and what state it is in. Clicking between orders lacks crisp visual feedback.
- **Resolution Plan (M3)**: Redesign `.order-switcher-strip` into a calm, horizontal segment of order cards featuring roaster initials/avatars, explicit colored status badges (`Planning` / `Locked` / `Completed`), bag counts, and an active indicator with clear focus and selection styling.

---

### 3. Missing Theme Warning Tokens
- **Severity**: High (Design system defect)
- **Direct Observation**:
  - `src/styles/tokens.css` defines `--color-success: #15803d` and `--color-error: #b91c1c`, but lacks `--color-warning` and `--color-warning-bg`.
  - Component files fall back to ad-hoc styling: `CoffeeLotsSection.tsx` uses hardcoded amber `#f59e0b` and `#fef3c7`, which clash in dark mode and fail WCAG AA contrast against dark backgrounds (`#181a1b`).
- **Visual Evidence**: `3orders_order-coffees_1440px_emerald_dark.png`, `3orders_order-coffees_1024px_emerald_dark.png`.
- **Before Analysis**: Unassigned bags or attention warnings appear either unreadable or visually jarring in dark mode because no standardized warning token exists in the theme contract.
- **Resolution Plan (M2)**: Define `--color-warning: #d97706` (light) / `#f59e0b` (dark) and `--color-warning-bg: #fef3c7` (light) / `#78350f` (dark) across both `emerald` and `yinmn` themes in `tokens.css`.

---

### 4. Monolithic `CoffeeLotsSection.tsx` & Cluttered Lot Cards
- **Severity**: Critical (Maintainability & Desktop usability)
- **Direct Observation**:
  - `src/components/order/CoffeeLotsSection.tsx` is 1,453 lines long, handling lot creation, list price display, bag-first allocation, 1-tap buyer chips, progressive adjustment panels, custom gram split modals, and directory quick-add.
  - On desktop (1440px and 1024px), lot cards feature multi-nested borders and heavy borders, small icons ("Adjust allocation ⚙"), and cramped buyer pills that wrap across multiple lines without alignment.
- **Visual Evidence**: `3orders_order-coffees_1440px_emerald_light.png`, `3orders_order-coffees_1024px_yinmn_light.png`.
- **Before Analysis**: Adding coffee lots and assigning bags is the core job of the application. The current layout feels cramped, noisy, and overwhelming with nested boxes and ambiguous button tiers.
- **Resolution Plan (M3)**: Refactor `CoffeeLotsSection.tsx` by modularizing into `LotEditorForm.tsx`, `BagAdjusterRow.tsx`, and `CustomSplitModal.tsx`. Use flat 1px rules, calm typography, tabular numerals for grams, and a standardized 2-column or structured table view on desktop.

---

### 5. Buried Personal Invoice State & Missing Read-Only Indicators
- **Severity**: High (Participant Journey failure)
- **Direct Observation**:
  - In `SettlementPacks.tsx`, participant invoices are rendered as a list of collapsed accordion cards.
  - In our automated journey audit (`baseline_journey_log.md`), Journey 2 Step 4 failed:
    `[FAIL] Member - Step 4: Inspect personal invoice and verify copy/share actions`
  - An ordinary member logging in to see what they owe must search through all participant cards and click to expand before finding their itemized breakdown and share buttons.
  - Furthermore, payment status toggle buttons (`Unpaid`, `Partial`, `Paid`) appear identically for members, even though members cannot update payment states (clicks do nothing or fail).
- **Visual Evidence**: `3orders_order-invoices_1440px_emerald_light.png`, `3orders_order-invoices_1024px_emerald_light.png`.
- **Before Analysis**: Ordinary members cannot quickly answer the single question: "What do I owe, and how do I pay?" It creates friction and unnecessary back-and-forth messages with the group organizer.
- **Resolution Plan (M3)**: If the logged-in user is a participant in the order, elevate a dedicated "Your Personal Share" card at the top of the Invoices view with ZAR owed, banking details, and instant copy/download buttons. Render admin payment toggles strictly read-only for non-owners.

---

### 6. Cockpit Summary Sticky Sidebar Pinning & Column Cramping
- **Severity**: High (Desktop hierarchy defect)
- **Direct Observation**:
  - In `OrderSummary.tsx`, desktop layout uses CSS grid (`minmax(0, 1.4fr) minmax(320px, 380px)`).
  - The sticky sidebar offset is hardcoded without factoring in the 64px fixed header (`--nav-top-height`), causing the summary card to clip behind the top navbar upon scrolling down.
  - Currency numbers in the financial summary cards and participant breakdown table use standard proportional fonts rather than tabular numerals (`font-variant-numeric: tabular-nums`), causing decimal points to wobble and misalign vertically.
- **Visual Evidence**: `3orders_order-summary_1440px_emerald_light.png`, `3orders_order-summary_1024px_emerald_dark.png`.
- **Before Analysis**: On desktop screens, financial cockpits should be rock-solid, easy to scan, and impeccably aligned. The clipping sticky sidebar and misaligned numbers degrade user trust in the financial calculations.
- **Resolution Plan (M3)**: Set `position: sticky; top: calc(var(--nav-top-height, 64px) + var(--space-4));` on the sidebar. Enforce `font-variant-numeric: tabular-nums` and `text-align: right` on all currency tables.

---

### 7. Confusing Domain Jargon & Obscure Section Naming
- **Severity**: Medium (Cognitive friction)
- **Direct Observation**:
  - Step 5 in `OrderPage.tsx` is named "Invoices", but within the code, modals, and export buttons it is termed "Settlement Packs".
  - In Step 2, UI tooltips and headings refer to "Progressive allocation mode", "legacy drafts", and "lot inference".
  - Fee types in Step 3 display raw strings like `proportional_by_value` and `equal_per_person` instead of human-friendly descriptions ("Split by coffee value" vs "Split equally per person").
- **Visual Evidence**: `1order_order-goods_1440px_emerald_light.png`, `3orders_order-invoices_1440px_emerald_light.png`.
- **Before Analysis**: Group members are coffee enthusiasts, not accountants or software developers. Technical internal jargon causes hesitation and confusion when configuring fees and viewing shares.
- **Resolution Plan (M3)**: Unify terminology to simple, clear labels: "Participants & Invoices", "Split equally", "Split proportionally by order value", and remove references to "inference" or "settlement packs".

---

### 8. Low-Contrast, Obscured Rounding Absorption Readout
- **Severity**: Medium (Financial transparency)
- **Direct Observation**:
  - `OrderSummary.tsx` line 142 renders the rounding remainder note:
    `<p style="font-size: 0.75rem; color: var(--color-text-muted);">Hamzah absorbs R 0.02 rounding remainder</p>`
  - It is rendered in tiny 12px text in low-contrast muted gray at the bottom of the column.
- **Visual Evidence**: `3orders_order-summary_1440px_emerald_light.png`, `3orders_order-summary_1440px_emerald_dark.png`.
- **Before Analysis**: Fajr Brews' strict money rule (`Math.floor` to 2 dp, payer absorbs cent remainder) is the core reason the app exists. Hiding this explanation in tiny gray text leads group payers to wonder why their personal invoice is a few cents higher than expected.
- **Resolution Plan (M3)**: Render the rounding absorption notice as a calm, explicit statement badge with an info icon inside the Grand Total breakdown card.

---

### 9. People Directory Grid Overflow on Long Names & Emails
- **Severity**: Medium (Edge case layout failure)
- **Direct Observation**:
  - `PeoplePage.tsx` renders member cards in a CSS grid (`grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`).
  - In `edge-longnames_order-coffees_1440px_emerald_light.png`, long names like `"Dr. Muhammad Abdur-Rahman ibn Al-Mansoor-Johannesburg"` cause horizontal overflow, line breaks across word stems, and clipping of card action buttons.
- **Visual Evidence**: `edge-longnames_order-coffees_1440px_emerald_light.png`, `people_1440px_emerald_light.png`.
- **Before Analysis**: Specialty coffee groups frequently include international participants and long emails. Unhandled overflow breaks the visual rhythm of directory cards.
- **Resolution Plan (M4)**: Implement `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` on name and email headers, with full text accessible via `title` attribute, and ensure minimum card widths adapt smoothly.

---

### 10. My Stats Space Inefficiency on Wide Desktop
- **Severity**: Medium (Visual balance)
- **Direct Observation**:
  - In `MyStatsPage.tsx`, 5 metric cards stretch horizontally across the entire 1200px/1400px container.
  - The cards contain vast amounts of empty white/dark space with disproportionately small numeric values.
  - On 768px tablet, the cards break awkwardly into two columns of two, leaving the fifth card spanning 100% width on a third row.
- **Visual Evidence**: `mystats_1440px_emerald_light.png`, `mystats_1024px_emerald_light.png`, `mystats_768px_emerald_light.png`.
- **Before Analysis**: Metric dashboards should feel cohesive, balanced, and informative. The stretched layout feels hollow on desktop and poorly proportioned on tablet.
- **Resolution Plan (M4)**: Redesign the statistics layout using a balanced 4-or-5 column summary row with prominent tabular numerals, coupled with a structured roaster breakdown table below.

---

### 11. Past Orders Archive Vertical Disruption & Heavy Modals
- **Severity**: Medium (Usability in history)
- **Direct Observation**:
  - In `HistoryPage.tsx`, past orders are presented as loose cards. When a past order is clicked to view details, it expands inline to a height of over 1,200px, pushing all other past orders far down the screen.
  - The full summary PDF download button is visually lost among secondary actions.
- **Visual Evidence**: `history_1440px_emerald_light.png`, `history_1024px_emerald_light.png`.
- **Before Analysis**: Users reviewing past order history want to scan orders quickly. Inline expansion that doubles page height creates disorienting layout shifts.
- **Resolution Plan (M4)**: Transform past orders on desktop into a clean, searchable data table with date, roaster avatar, bag count, total ZAR, and quick action to view or download PDF.

---

### 12. Subtle Focus Rings, Contrast Drops & Missing Motion Guards
- **Severity**: High (Accessibility & WCAG AA compliance)
- **Direct Observation**:
  - Chip buttons in `CoffeeLotsSection.tsx`, switcher tabs, and secondary buttons have default outline `none` or faint 1px outlines (`outline: 1px solid var(--color-border)`).
  - Against dark backgrounds (`emerald_dark`), keyboard focus is almost invisible.
  - CSS animations on modal backdrops (`fade-in`, `slide-up`) lack `@media (prefers-reduced-motion: reduce)` media query overrides.
- **Visual Evidence**: `modal-archive_1440px_emerald_light.png`, `3orders_switcher_1440px_emerald_dark.png`.
- **Before Analysis**: Keyboard accessibility and contrast standards are mandatory requirements in `AGENTS.md` and `docs/prompts/05-ui-desktop.md`. Failing visible focus and motion preference reduces usability for keyboard and assistive tech users.
- **Resolution Plan (M2, M4)**: Add standardized `:focus-visible` styles with a high-contrast 2px ring (`outline: 2px solid var(--color-primary); outline-offset: 2px;`) and wrap transitions with `@media (prefers-reduced-motion: no-preference)`.

---

## Conclusion & Milestone Roadmap

With the baseline audit complete, the 104 baseline screenshots captured, user journeys verified, and the top 12 friction points rigorously catalogued, Milestone 1 (`M1_BASELINE_AUDIT`) objectives are 100% satisfied.

### Next Execution Milestones:
- **M2 (Tokens & Shell)**: Implement `--color-warning` tokens, unify `--content-max-width: 1200px`, standardize desktop header and navigation.
- **M3 (Order Cockpit & Wizard)**: Redesign active orders switcher strip, modularize `CoffeeLotsSection.tsx`, optimize Cockpit layout, elevate personal member invoice card, and clarify domain labels.
- **M4 (Secondary Views & Modals)**: Standardize People Directory grid, My Stats dashboard, History archive table, and accessible modals.
- **M5 (Regression & Test Gate)**: Run full test suite, typecheck, build, and verify zero 390px mobile regression.
- **M6 (Post-Redesign Evidence Pack)**: Capture after screenshots and journey logs demonstrating resolution of all 12 friction points.
