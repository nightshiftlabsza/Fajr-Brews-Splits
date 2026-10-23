# Prompt 2: Invoice PDF repair

Branch: `prompt/02-invoice-pdf`

## Objective
Per-person and whole-order PDF invoices must be arithmetically correct, compact (one A4 page for a normal invoice), professional, and consistent with what the app shows and what the WhatsApp/email/clipboard text says.

## Verified context
- `src/lib/pdf.ts` (408 lines) draws directly with jsPDF in mm on A4, hard-coded 20 mm margins, fixed row heights, `ensurePageSpace` adds pages. Exports `generateInvoicePDF` (per person) and `generateOrderInvoicePDF` (whole order). Built-in `helvetica` font only.
- Content comes from `src/lib/invoiceFormatter.ts` (`buildInvoiceModel`, `formatFeeForOwner`, share-text builders). Formatting helpers in `formatters.ts` (`formatZAR`, `formatGrams`, `formatDate`, filenames). Sharing in `sharing.ts`. On-screen invoice: `components/invoice/{InvoiceView,InvoiceActions}.tsx`, `styles/print.css`.
- Existing tests: `pdf.test.ts`, `invoiceFormatter.test.ts`, `formatters.test.ts`, `calculations.test.ts`. jspdf-autotable is installed.
- Money rule (README): non-payers floored to 2 dp, payer absorbs remainder; totals reconcile exactly. Recent commits changed payment references and invoice sharing, so regressions are likely.

## Reported symptom
The owner downloaded an order invoice PDF: three pages, repeated coffee costs, overlapping content. Reproduce this first (per-person and order PDFs, with multiple lots and bags), then establish the root cause before changing layout. Decide among: duplicated source data, the same lot or bag emitted in more than one section, repeated subtotal/total calculation, row-height or pagination logic in `pdf.ts` (`ensurePageSpace`, fixed offsets), or autotable/library behaviour. Do not hide repeated text, drop line items, hard-code values or alter business calculations to make the PDF look cleaner. This app splits costs (lots, grams, shares, fees, rounding adjustment); it has no menu items, tax or discounts, so test the equivalents: several lots, several bags per lot, uneven shares, fixed and proportional fees, rounding adjustment. Compact is the goal, but do not force one page if readability suffers.

## Investigate and reproduce
1. After reproducing the owner's case, write a script or test that renders real PDFs for at least 6 synthetic orders: 1 lot / many lots; 1 bag / many bags per person; no fees / fixed and proportional fees; payer also a buyer; very long roaster, lot and person names; ZAR amounts with odd cents; many people (order PDF over 10 rows). Save outputs outside git (e.g. `/tmp`) and keep only the generator in tests if it is useful.
2. Inspect every PDF visually (convert to PNG with whatever is available, e.g. `pdftoppm`, or render via browser) and extract text (`pdftotext`). Look for: clipped or overlapping text, wrong alignment, wasted space, a second page for content that should fit, unreadable fonts, missing currency symbol or inconsistent formatting, wrong labels.
3. Recompute every figure on every page independently from the order data and compare: line items sum to subtotal, fees, rounding adjustment, total due; the payer's figures; the order PDF totals equal the sum of the per-person invoices equal the goods total plus fees. Compare against the UI invoice and the share text for the same data.

## Expected behaviour
- A typical per-person invoice fits one A4 page; longer ones paginate cleanly (header repeated or clear continuation, no orphaned totals, no split rows).
- Clear hierarchy: who owes whom, how much, reference, how to pay, then a compact breakdown. No decorative filler. Consistent ZAR formatting via `formatZAR`.
- Long text wraps or truncates deliberately, never overflows.
- Numbers identical across PDF, on-screen invoice and share texts.

## Scope
- Files: `pdf.ts`, `invoiceFormatter.ts`, `sharing.ts`, invoice components, `print.css` as needed, and their tests. Fix calculation discrepancies at the root, in `calculations.ts` or `invoiceFormatter.ts`, only if the defect is proven there; state it clearly.
- No new dependencies (jspdf-autotable already present). No custom font embedding. No new invoice features.
- Do not edit order-editing UI or store (Prompt 1 owns them).

## Acceptance criteria
- Table in the report: each test PDF, page count, issues found, fixed yes/no.
- Arithmetic check table for every scenario: expected vs PDF-extracted figures, all matching to the cent.
- Before and after PNGs of at least 3 scenarios saved in `docs/evidence/02-invoice-pdf/` (no real personal data).
- Regression tests: totals and key text asserted from the PDF-building path; page count asserted for typical and long cases.
- Gate passes.

## Ground rules (all prompts)
- Repo: Fajr Brews Splits (React 18, TS strict, Vite, Zustand, Supabase, jsPDF, Vitest). Read `AGENTS.md` and `docs/PROJECT_BRIEF.md` first; they are binding. Money rule is in `README.md`.
- You have high autonomy: investigate, delegate independent read-only investigations to sub-agents if available, refactor where demonstrably necessary, fix, test, and re-verify without asking. Do not let multiple agents edit the same file at once.
- Work only on your own branch. Do not push to or merge into `main`.
- Never use production Supabase credentials or data. Use mocked data only; there is no staging backend and `.env.local` must not point at the live project. Limit browser evidence to what mocks allow; do not fake it.
- Never: apply SQL migrations anywhere, change RLS or auth config, rotate or print secrets, delete or rewrite data, change deploy settings, add dependencies (unless this prompt says so), skip or loosen tests.
- No filler comments, speculative abstractions, dead code or unrequested features.
- Gate after final edit, from a clean state: `npm run typecheck && npm test && npm run build`. Paste real output.
- Screenshots: save under `docs/evidence/<prompt>/` only if asked below; otherwise describe what you inspected. Do not commit `.env*`, PDFs with real names, or secrets.
- Rollback: one coherent commit series on your branch; state the base commit hash and that `git revert`/branch deletion restores the baseline.

## Report (end with exactly this, concise)
1. Files changed (added/modified/deleted).
2. Diff summary per file, one or two lines.
3. Commands run with real output tails (typecheck, test counts, build).
4. Acceptance criteria: each marked met / partially / not met, with evidence (test name, file:line, screenshot path).
5. Verified vs partially verified vs unverified behaviour, stated separately.
6. Skipped, uncertain, deviations from this prompt, unresolved defects.
