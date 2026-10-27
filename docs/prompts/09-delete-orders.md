# Prompt 9: Delete unneeded orders from the Order page

Branch: `prompt/09-delete-orders`, cut from current `main`. Run after prompt 06 (it rewrites page components) and before prompt 07. Independent of prompt 08 (disjoint files).

## Objective
Owners and admins can already delete an order in two places: the last wizard step of an unsaved order and the Delete button in Past Orders. The Order page, where people actually look, only offers "Archive Order". Add a "Delete Order" action there so an unneeded order can be removed in two taps, with a clear confirmation.

## Verified context
- No database change is needed. `supabase/schema.sql` policy "Members can delete orders" already allows delete when `is_order_full_viewer(workspace_id, coalesce(owner_id, created_by))`, i.e. the order owner or a workspace owner/admin. Do not touch SQL, RLS or `supabase/`.
- Store action `deleteOrder(id)` in `src/store/appStore.ts` (about line 1248) already deletes the row, clears local state, and moves `currentOrderId` to the next active order. It throws on failure. Reuse it unchanged.
- `src/components/pages/OrderPage.tsx`: the actions menu has `Archive Order` behind `isOwner` (about line 405), with `archiveTargetOrder` state, `confirmArchiveOrder` (about line 196) and a `ConfirmModal` (about line 555). Mirror that pattern. `isOwner` already includes workspace owner/admin.
- `OrderSummary.tsx` (`handleConfirmDelete`) shows the existing pattern for surfacing a delete error.
- `Order.payments` is `Record<personId, PaymentRecord>`; see `src/types/index.ts` for what counts as a recorded payment.

## Rules (decided, do not change)
1. Who: only when `isOwner` is true, same as Archive. Non-owners never see the action.
2. Works on any order in the active list, whatever its status (planning, locked, completed).
3. Always a confirm step using `ConfirmModal`, `variant="danger"`, confirm text `Delete Order`, title `Delete "<name>"?`. Description says it is permanent and cannot be undone, and suggests Archive to keep a record.
4. If the order has any recorded payment (any `payments` entry with a paid or partial amount), the description must add a line saying how many payments are recorded and that they will be lost too. No extra typing step.
5. After deleting, select the next remaining active order, or none, exactly as the archive flow does.
6. On failure, keep the modal closed and show the error message in an `alert alert-error` near the actions menu; never fail silently.

## Scope
- `src/components/pages/OrderPage.tsx`: the menu item (below Archive, `dropdown-item-danger`), state, handler, modal, error alert.
- If the payment count needs logic, put one small pure function in `src/lib/orderLifecycle.ts` with tests in `orderLifecycle.test.ts`; otherwise keep it inline. No new files unless needed.
- `src/components/pages/OrderPage.test.tsx`: add tests (see below).

## Out of scope
SQL, RLS, `appStore.ts`, Past Orders and wizard delete buttons (leave as is), bulk delete, undo/trash, soft delete, restyling, dependencies.

## Acceptance criteria
- Owner/admin sees "Delete Order" in the actions menu; a plain member does not. Test both.
- Clicking it opens the modal with the right title; Cancel does nothing; Confirm calls `deleteOrder` with that order's id. Test each.
- An order with recorded payments shows the extra payments warning; an order without does not. Test both.
- After a successful delete the next active order becomes current; with none left the empty state shows. Test.
- A rejected `deleteOrder` shows the error text. Test.
- Existing tests unchanged and green; no new dependencies; no hard-coded colours.
- Gate from a clean state: `npm run typecheck && npm test && npm run build`, real output pasted.

## Ground rules
Read `AGENTS.md` and `docs/PROJECT_BRIEF.md` first; binding. Use mocked store data only; never use live Supabase credentials (`.env.local` must not point at the live project). Never apply SQL. Work only on your branch; do not push to or merge into `main`. Reuse existing components and tokens; no filler comments, dead code or unrequested features. State the base commit hash; branch deletion/`git revert` restores the baseline.

## Report (end with exactly this, concise)
1. Files changed (added/modified/deleted).
2. Diff summary per file, one or two lines.
3. Commands run with real output tails (typecheck, test counts, build).
4. Acceptance criteria: each marked met / partially / not met, with evidence (test name, file:line).
5. Verified vs partially verified vs unverified behaviour, stated separately (real delete against the live database is unverified).
6. Skipped, uncertain, deviations, unresolved defects.
