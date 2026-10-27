# Prompt 4 of 9: Type and theme foundations

Branch `prompt/04-type-foundations`, cut from current `main` **after prompts 1, 2 and 3 are merged**. Read `AGENTS.md` and `docs/UI_AUDIT.md` (sections 5 and "Design direction") first; they are part of this prompt.

## Objective
Give the two themes distinct, deliberate typography and a single type system, and load fonts faster and more reliably than today. The **Classic** theme is `emerald` (Emerald Ledger). The **Modern** theme is `yinmn` (YInMn Ledger). This batch changes fonts, sizes, weights and number styling only. Layout, components, colours and copy stay as they are, apart from the two theme descriptions in Settings.

## Verified starting point (check each against the code before you change anything)
- `index.html` loads five Google Fonts families render-blocking on every visit: Fraunces, Manrope, Space Grotesk, Inter, IBM Plex Mono.
- `tokens.css`: emerald uses `--font-display: Fraunces` and `--font-body: Manrope`. yinmn uses Space Grotesk and Inter. `--font-mono` is IBM Plex Mono, used once in `globals.css`.
- `print.css` names Sora, Inter and Cormorant Garamond. Sora and Cormorant are never loaded.
- `globals.css` has 30 distinct `font-size` values (0.68rem, 0.72rem, 0.76rem, 0.78rem, 0.8rem, 0.82rem, 0.84rem, 0.86rem, …) and no type-scale tokens. `font-weight: 800` appears twice, but 800 is not loaded.
- Amounts and stat values carry positive `letter-spacing`, which spreads money figures apart.
- `SettingsPage.tsx` describes the themes as "Serif headings" and "Geometric headings".

## Decisions already made (do not re-litigate; report evidence if one fails in practice)
| Theme | Headings and hero totals | UI, body, labels, tables, amounts |
|---|---|---|
| Classic (`emerald`) | Fraunces, variable (opsz), weight 600; 700 only if needed | Manrope 400 / 600 / 700 |
| Modern (`yinmn`) | Hanken Grotesk 600 / 700 | Hanken Grotesk 400 / 500 / 600 |

- Remove Space Grotesk, Inter, IBM Plex Mono, Sora and Cormorant Garamond from the code. Amounts use the body font with `font-variant-numeric: tabular-nums` and `letter-spacing: normal`.
- Why: Fraunces + Manrope already gives the classic theme character and reads well. Space Grotesk + Inter is the generic template pairing. Hanken Grotesk is one variable file, and its tabular figures stay tight (Schibsted Grotesk was rejected because it spaces money figures apart; Instrument Sans because it is visually indistinguishable from Inter).

## Required changes
1. **Self-host the fonts.**
   - Use WOFF2 variable files limited to the weight ranges above, as `latin` and `latin-ext` subsets with correct `unicode-range`, so `latin-ext` downloads only when a name needs it.
   - Get the files from the official source: the Google Fonts CSS2 API's woff2 files, or the font's upstream repo. Commit each family's `OFL.txt` next to its files. Confirm from that file that the licence permits self-hosting and redistribution, and quote the line in your report.
   - Put the files under `src/assets/fonts/` and reference them from a new `src/styles/fonts.css` (imported by `globals.css`), so Vite fingerprints them into `/assets/` and the immutable cache rule from the security prompt covers them.
   - Do not add an npm dependency (no Fontsource).
2. **Loading.**
   - Use `font-display: swap`.
   - Add a metric-matched fallback `@font-face` for each family (`size-adjust`, `ascent-override`, `descent-override`, `line-gap-override` on a local system font) so the swap barely moves text. Fallback stacks: serif → Georgia, "Times New Roman", serif; sans → system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif.
   - Preload only the Manrope `latin` file, since Classic is the default theme. If Vite cannot emit a working preload to the hashed file from `index.html`, leave the preload out and say so.
   - Remove the Google Fonts `<link>` and both `preconnect` tags.
   - Do not touch `vite.config.ts` or `package*.json`; the speed prompts own them.
3. **Type scale tokens** in `tokens.css`, shared by both themes: `--text-xs` 12px, `--text-sm` 13px, `--text-md` 14px, `--text-base` 16px, `--text-lg` 18px, `--text-xl` 22px, `--text-2xl` 28px, plus `--text-hero: clamp(1.75rem, 4vw, 2.25rem)` for the single hero total or page title.
   - Replace every raw `font-size` in `globals.css` with the nearest token. Where that changes a size by more than 1px, list it in the report with a reason.
   - Add line-height tokens: tight 1.2 for headings, normal 1.5 for body, and 1.35 for dense table rows if needed. Apply them where they replace ad-hoc values.
   - `print.css` keeps `pt` sizes but uses `var(--font-body)` and `var(--font-display)`.
4. **Weights.** Only 400, 500 (Modern only), 600 and 700 appear in CSS. Change the two `800`s to 700. Each theme's font files must cover every weight its CSS uses, so the browser never fakes bold.
5. **Numbers.** Add one shared rule or class for money and quantities: tabular figures, `letter-spacing: normal`, body font. Apply it to amounts in the Summary, Invoices, Past Orders, My Stats and cost tables, and remove positive tracking from them. The single hero total per screen (Grand total, Total amount due) uses the display font at `--text-hero`.
6. **Settings copy.** Theme descriptions become "Classic · Deep emerald · Editorial serif headings" and "Modern · YInMn blue · Clean grotesk type". Nothing else in Settings changes.

## Out of scope
The header and sign-in brand lockup (name, logo, "Coffee Splitter" line; it is being redesigned separately as "Splits, by Fajr Brews"; the new fonts simply apply to it), layout, spacing, borders, radii, colours, components, uppercase labels and their tracking (prompt 5), inline styles in components (except a `fontFamily` or `fontSize` that blocks the token switch; list any you touch), money logic, PDF generation (`pdf.ts` and its embedded fonts), and anything the speed prompts own.

## Skills and agents
- **Install** Impeccable at project scope for Antigravity: `npx impeccable install --providers=antigravity --scope=project --no-hooks`. Do not run `init`.
- **Install** from `emilkowalski/skills` only `emil-design-eng`. Follow the repo README (`npx skills@latest add emilkowalski/skills`), choosing only that skill if the installer allows it; otherwise copy just that skill's folder into `.agent/skills/`.
- Keep `.agent/` and any `PRODUCT.md` or `DESIGN.md` these tools write out of git: add them to `.git/info/exclude`, not `.gitignore`.
- Do not change global configuration. If an install needs permissions you do not have, or would overwrite existing config, stop and report.
- **Baseline:** run `npx impeccable detect --json src/` before your first edit and again at the end, and report the typography-related findings from both runs.
- **Use three independent agents**, each given this prompt's acceptance criteria:
  - (a) a **typography critic**: uses `/impeccable typeset` and `emil-design-eng` on before/after screenshots;
  - (b) a **font-loading and CSS auditor**: network log, `@font-face`, weights, fallbacks, CLS;
  - (c) a **responsive and regression checker**: screenshots at every width, overflow, wrapping.
  - Only the main agent edits files. It must answer every substantive point from (a) to (c): fixed, or rejected with a reason.

## Test harness (same rule as prompts 05 and 06)
- Never touch real Supabase. Use dummy env values and serve fixture data by intercepting Supabase requests with Playwright `page.route`, run from a scratch folder outside the repo with nothing added to `package.json`. An example harness is in the project files at `design/mock-screens.cjs`; adapt it rather than writing one from scratch.
- Fixtures: signed-in owner, 8 people including "Imraan Mohamed-Abrahams" and "Aleksandra Wiśniewska-Kowalczyk", 3 orders (planning, locked, completed), 2 coffees, 5 bags, 2 fees, some payments partial.

## Acceptance criteria
1. No request to `fonts.googleapis.com` or `fonts.gstatic.com` in any theme. Paste the font requests (URL, bytes) from a cold load of the Summary screen for Classic and Modern, before and after. The total font bytes per theme must not exceed the before figure, measured the same way.
2. Every font file and `@font-face` rule is listed in a table: family, weights or range, subset, `unicode-range`, size. Every `font-weight` used in CSS for each theme is covered by its files. Show how you confirmed there is no synthetic bold (for example DevTools Rendered Fonts on a 700 heading and a 600 label).
3. `grep -nE "font-size:\s*[0-9.]+(rem|px|em)" src/styles/globals.css` returns nothing, or only lines you list and justify. No `800`. No Space Grotesk, Inter, IBM Plex Mono, Sora or Cormorant anywhere in `src/` or `index.html`.
4. Money and quantities: computed style for "Grand total", one participant amount and one My Stats value shows tabular figures and `letter-spacing: normal`, in both themes.
5. Layout shift: run a cold load (cache disabled) at 390px and 1440px for both themes and report cumulative layout shift from a `PerformanceObserver('layout-shift')`, before and after. After must be ≤ before, and under 0.02 at both widths.
6. Fonts blocked: with every font file request aborted, screenshots of Summary at 390px and 1440px show readable text with no clipping or overflow.
7. Glyphs: render a test string on a scratch page (not committed): "Aleksandra Wiśniewska-Kowalczyk · Ébrahim · R1,234.56 · 250g · “quotes” — ✓ →". It must show no missing-glyph boxes in either theme. Say which glyphs come from a fallback font.
8. Before/after screenshots at 390, 820 and 1440px of Coffees & Bags, Summary, Invoices, Past Orders, My Stats, Settings and Sign-in. Use Classic light, Modern light and Classic dark. Save them under `docs/evidence/04-type/before|after/`. Inspect every pair yourself and list each visible change and any defect found and fixed.
9. The two themes are visibly different in headings, body and numbers at 390px and 1440px, and no text wraps worse than before (compare headings, nav, buttons and the pill strip).
10. Gate: `npm run typecheck && npm test && npm run build` pass. Paste the output. No test is changed unless a test asserted a removed font name; if so, explain.
11. The diff touches only `index.html`, `src/styles/*`, `src/assets/fonts/*`, the two description strings in `SettingsPage.tsx`, and the evidence folder. If anything else changed, explain why.

## Report (in this order)
1. Files changed (added / modified / deleted).
2. Diff summary per file.
3. Font table: family, theme, role (headings, body, labels, numbers, buttons), rationale, files and sizes, fallback stack and overrides, licence line quoted.
4. Commands run, with pasted output: gate, both detect runs, network and CLS measurements.
5. Each acceptance criterion: met / partly / not met, with evidence (screenshot path, output, file:line).
6. Skills and agents actually used: what each agent found and what you did about it. "Installed" alone is not evidence of use.
7. Anything skipped, uncertain or worse in some view.
