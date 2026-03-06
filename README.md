# Fajr Brews — Coffee Splitter

> Shared coffee order reconciliation for the Fajr Brews group.

A production-ready web app that fairly splits the cost of imported coffee orders across group members. Features real-time collaboration via Supabase, per-person PDF invoices, 3 premium themes, and payment tracking.

---

## What It Does

When your group imports specialty coffee, the roaster applies tax deductions and discounts that change the per-bag cost unpredictably. This tool:

1. Takes the **final ZAR goods total** actually paid
2. Allocates it across lots by **original foreign list-price proportions**
3. Splits each lot's cost to members by **grams received**
4. Allocates additional fees by one of **3 allocation types** (fixed shared / proportional by value / per bag)
5. Generates **elegant per-person invoices** with split context and payment instructions
6. Syncs **live across all members** via Supabase Realtime

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| State | Zustand |
| Backend | Supabase (Postgres + Auth + Realtime) |
| PDF | jsPDF |
| Deploy | Vercel (static) |

---

## Local Setup

### Prerequisites

- Node.js 18+
- A Supabase project (already created at `evukrughkgpzjftwkinh.supabase.co`)

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Create `.env.local` (already done — do not commit to git):

```
VITE_SUPABASE_URL=https://evukrughkgpzjftwkinh.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_NHzJCQi5M_ghXCwZp92jEg_kmlutoe1
```

### 3. Run the Supabase schema

Open your Supabase project → **SQL Editor** → paste the full contents of `supabase/schema.sql` → Run.

This creates all tables, RLS policies, realtime publications, and seeds the Fajr Brews workspace.

### 4. Add yourself as the first workspace member

After running the schema, you need to:

1. Start the app: `npm run dev`
2. Sign up with your email and password
3. In Supabase Dashboard → **Auth → Users**, find your user and copy the UUID
4. In **SQL Editor**, run:
   ```sql
   insert into public.workspace_members (workspace_id, user_id, role)
   values ('a1b2c3d4-0000-0000-0000-000000000001', 'YOUR-UUID-HERE', 'owner');
   ```
5. Sign out and sign back in — you'll now have full access

### 5. Add more members

- Each new member signs up via the app
- You (as owner) go to **Settings → Workspace Members** and add them by email

---

## ✅ Supabase Checklist

After running `schema.sql`, confirm these in the Supabase Dashboard:

1. **Database → Replication**: Confirm `people` and `orders` tables appear in the `supabase_realtime` publication. If not, enable them manually.
2. **Database → Tables**: Confirm all 6 tables exist (`profiles`, `workspaces`, `workspace_members`, `people`, `orders`, `user_settings`)
3. **Auth → Settings**: Optionally disable email confirmation for easier testing (`Auth → Settings → Disable email confirmations`)
4. **Auth → Users**: After signing up, add your UUID to `workspace_members` via SQL Editor (step 4 above)

---

## Build & Deploy

### Local build

```bash
npm run build
```

Output goes to `dist/`.

### Deploy to Vercel

**Option A: Vercel CLI**

```bash
npx vercel --prod
```

Set these environment variables in Vercel Dashboard → Settings → Environment Variables:

```
VITE_SUPABASE_URL=https://evukrughkgpzjftwkinh.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_NHzJCQi5M_ghXCwZp92jEg_kmlutoe1
```

**Option B: GitHub + Vercel**

1. Push to GitHub
2. Import the repo in vercel.com
3. Set the two env vars above
4. Deploy

The `vercel.json` handles SPA routing (all paths → `index.html`).

---

## Data Architecture

### Supabase Schema

| Table | Purpose |
|---|---|
| `profiles` | Auto-created on signup; stores email + display name |
| `workspaces` | The Fajr Brews group (one workspace, pre-seeded) |
| `workspace_members` | Who has access; roles: owner / admin / member |
| `people` | The shared coffee order directory |
| `orders` | Coffee orders; lots, fees, payments stored as JSONB |
| `user_settings` | Per-user theme preference |

### JSONB Order Structure

```json
{
  "lots": [
    {
      "id": "uuid",
      "name": "Ethiopian Yirgacheffe",
      "foreignPricePerBag": 18.5,
      "gramsPerBag": 250,
      "quantity": 4,
      "shares": [
        { "id": "uuid", "personId": "people-uuid", "shareGrams": 500 },
        { "id": "uuid", "personId": "people-uuid-2", "shareGrams": 500 }
      ]
    }
  ],
  "fees": [
    { "id": "uuid", "label": "Disbursement", "amountZar": 250, "allocationType": "fixed_shared" }
  ],
  "payments": {
    "people-uuid": { "status": "paid", "amountPaid": 850.50, "datePaid": "2025-03-20" }
  }
}
```

### Row Level Security

Every table is protected by RLS. Access is determined by a single check:

```sql
is_workspace_member(workspace_id) -- user must be in workspace_members
```

No data leaks between workspaces.

### Realtime

`people` and `orders` tables have Postgres LISTEN/NOTIFY enabled via Supabase Realtime. When any member saves a change, all other members see it within ~200ms without refreshing.

---

## Calculation Logic

### A. Goods allocation to lots

```
TOTAL_LIST_FOREIGN = Σ(lot.foreignPricePerBag × lot.quantity)
LOT_GOODS_ZAR = (lot_total_foreign / TOTAL_LIST_FOREIGN) × GOODS_TOTAL_ZAR
```

The actual exchange rate and discount are irrelevant — we allocate by proportional share of original list prices.

### B. Share allocation per person

```
SHARE_GOODS_ZAR = (shareGrams / lotTotalGrams) × LOT_GOODS_ZAR
PERSON_GOODS_ZAR = Σ(all SHARE_GOODS_ZAR for that person)
```

### C. Fee allocation

| Type | Method |
|---|---|
| `fixed_shared` | `fee.amountZar / eligiblePeopleCount` |
| `proportional_value` | `fee.amountZar × personValueShare` |
| `per_bag` | `fee.amountZar × personBagFractionRatio` |

For `per_bag`: a person who takes 125g from a 250g bag counts as **0.5 bags**.

### D. Rounding rule (critical)

All calculations run at full floating-point precision. Before displaying:

- Every **non-payer** person is rounded **down** to 2 decimal places (`Math.floor`)
- The **payer** absorbs the remainder: `payer_total = total_order_zar − Σ(non_payer_finals)`

This guarantees:
1. No non-payer is ever overcharged due to rounding
2. `Σ(all person totals) = exact order total` — always reconciles

---

## Theming

Three premium themes switchable in Settings:

| Theme | Mood | Fonts |
|---|---|---|
| **Porcelain Ledger** (default) | Light luxury, warm ivory | Cormorant Garamond + Sora |
| **Obsidian Ledger** | Dark editorial, antique gold | Cormorant Garamond + Manrope |
| **Slate Monograph** | Swiss editorial, deep navy | Space Grotesk + Inter |

All components use CSS variables (`var(--color-*)`, `var(--font-body)`, etc.) defined in `src/styles/tokens.css`. Switching theme changes the `data-theme` attribute on `<html>`. No component duplication.

### Figma Prompts

**Obsidian Ledger:**
> "Design a mobile-first web app called Fajr Brews — Coffee Splitter with a premium dark-fintech aesthetic. Use warm black, charcoal, antique gold accents, refined editorial typography, generous whitespace, thin borders, soft shadows, and a luxury invoice feel. It should feel like boutique wealth-management software."

**Porcelain Ledger:**
> "Design Fajr Brews — Coffee Splitter as a premium light-mode financial web app with porcelain backgrounds, warm white surfaces, espresso typography, dark bronze or forest accents, and refined editorial headings. The style should feel like luxury printed stationery meets modern invoicing software."

**Slate Monograph:**
> "Design a refined single-page web app called Fajr Brews — Coffee Splitter with a contemporary Swiss editorial aesthetic. Use pale slate backgrounds, white cards, carbon typography, deep navy or oxidized teal accents, crisp spacing, subtle borders, and minimal shadows."

---

## Export / Import

In the **History** tab, you can:
- **Export JSON** — downloads a full snapshot of people, orders, and settings
- **Import JSON** — loads from a previously exported backup

This is a safety net. Supabase is the primary source of truth.

---

## Privacy Note: Default Directory

The `src/data/defaultDirectory.ts` file contains placeholder people with dummy phone numbers. These are only used as fallback seed data — in production they are replaced by the real People table data in Supabase.

**If you bundle real contact details** into this file, be aware that anyone who can access your Vercel deployment (or the source code) will be able to read those details. Only do this if the group is comfortable with that.

---

## Design Tokens (for reference)

```css
/* Core tokens from tokens.css */
--color-bg           /* Page background */
--color-surface      /* Card / panel background */
--color-surface-raised /* Slightly elevated surface */
--color-text-primary /* Main text */
--color-text-secondary /* Secondary/label text */
--color-text-muted   /* Placeholder, hint text */
--color-border       /* Default borders */
--color-border-focus /* Focus ring color */
--color-accent       /* Primary action color */
--color-accent-light /* Accent wash/tint */
--font-display       /* Heading typeface */
--font-body          /* UI typeface */
```

---

## TypeScript

```bash
npm run typecheck  # type-check without building
```

---

## Support

For issues or questions, open a GitHub issue or contact the Fajr Brews group admin.
