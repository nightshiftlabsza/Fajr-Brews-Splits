# Prompt 13: Stop hidden tabs re-rendering on every store change

Branch: `prompt/13-store-selectors`, cut from `main` after prompt 12 is merged (both change `src/App.tsx`).

## Objective
Make in-app interactions feel immediate by making each component re-render only when the store fields it actually uses change.

## Verified context (checked by Claude on `main`)
- 15 components read the store as `const { ... } = useAppStore();` with no selector: `App.tsx`, `Header`, `AuthPage`, `PendingAccess`, `OrderPage`, `PeoplePage`, `MyStatsPage`, `HistoryPage` (twice: the page and its wizard component around line 552), `SettingsPage`, `CoffeeLotsSection`, `OrderSummary`, `OrderSetup`, `SettlementPacks`, `GoodsAndFees`. With Zustand, a hook call without a selector re-renders on **every** `set`, whatever changed.
- `App.tsx` keeps all five tab pages mounted and hides inactive ones with CSS, so every store change re-renders every page, including hidden ones.
- Claude measured this in jsdom with the real store (Supabase mocked), 41 orders x 6 lots x 4 bags and 12 people, wrapping each page in `React.Profiler`: toggling only `isSyncing` twice re-rendered OrderPage, PeoplePage, MyStatsPage and HistoryPage twice each, costing about 39 ms of React render time (28 ms in HistoryPage). `isSyncing` toggles on every background refresh, and other unrelated fields (`error`, `sessionUi`, `workspaceMembers`, `settings`) change often.
- Zustand is 4.5.7, which ships `useShallow` at `zustand/react/shallow`.
- `OrderSetup.tsx` ~85: `const patchOrder = onOrderChange ?? ((patch) => updateOrder(order.id, patch));` creates a new function every render, and `patchOrder` is a dependency of the debounced name and bank save effects (~177-211). Every re-render restarts the 450/500 ms save timers.
- `App.tsx` mount effect (~237-259) registers a `prefers-color-scheme` listener whose handler sets `data-mode` to `'auto'` when it is already `'auto'`. That does nothing; CSS media queries re-evaluate on their own.
- Component tests mock the store as `useAppStore: () => mockStoreState`, which ignores any selector and returns the whole object; destructuring from a selector result still works with that mock.

## Required changes
1. In each of the 15 call sites, select only the fields that component uses: `useAppStore(useShallow((s) => ({ a: s.a, b: s.b })))`, or a plain `useAppStore((s) => s.field)` when it needs one field. Keep the existing destructured names so the component bodies do not change.
2. `OrderSetup.tsx`: make `patchOrder` stable with `useCallback`, depending on `onOrderChange`, `updateOrder` and `order.id`, so the debounce timers only restart when the user types. Do not touch the same pattern in `GoodsAndFees` or `CoffeeLotsSection`; there it is not an effect dependency.
3. `App.tsx`: delete the no-op colour-scheme listener, its two refs and its cleanup. Keep the theme and mode lines that read localStorage.

## Constraints
- No change to behaviour, markup, styling, store shape or store actions.
- Keep all five tabs mounted (scroll position and form state depend on it).
- No `React.memo`, no `useMemo`/`useCallback` other than item 2; calculations cost about 3 ms for 41 orders and are not the problem.
- Do not edit the existing component tests' expectations. Adjust a store mock only if a test fails because of the selector, and explain each one in the report.
- No new dependencies.

## Anti-patterns to avoid
- Selecting the whole state (`(s) => s`) or a new object without `useShallow`. The first changes nothing, the second re-renders on every change or loops.
- Creating new arrays or objects inside a selector (for example `s.orders.filter(...)`). Select raw fields; derive in the component as today.
- Splitting the store, adding contexts, or moving logic out of components.

## Verification required
1. New test `src/store/renderIsolation.test.tsx` (jsdom). Mock `../lib/supabase` (no network), use the real store, set a signed-in owner with a few people and orders via `useAppStore.setState`, and mount `OrderPage`, `PeoplePage`, `MyStatsPage` and `HistoryPage`, each wrapped in `React.Profiler` counting commits. Then:
   - `setState({ isSyncing: true })` and `setState({ error: 'x' })`: zero re-renders of all four pages.
   - Change one person's name: `PeoplePage` re-renders (proves selectors still update).
   Run it on the unmodified code first and paste the failing output, then paste it passing.
2. A test for item 2: in `OrderSetup`, type a name, trigger an unrelated parent re-render before 450 ms, and assert the save still fires once at 450 ms after the last keystroke (fake timers).
3. Report the before/after Profiler numbers for the four pages from the test (render count and total `actualDuration` for the two unrelated updates).
4. Gate from a clean state: `npm run typecheck && npm test && npm run build`. Paste real output.

## Stop conditions
Stop and report if a component needs a field that is only computed inside the store at render time, if a selector change alters behaviour a test depends on, or if any change seems to need store restructuring.

## Completion report (AGENTS.md format)
1. Files changed. 2. Diff summary per file. 3. Commands run with real output, including the failing-then-passing isolation test. 4. Each acceptance criterion: met / not met, with evidence. 5. Skipped or uncertain.

## Acceptance criteria (Claude reviews against these)
- AC1: `grep -rn "useAppStore()" src --include=*.tsx | grep -v test` returns nothing.
- AC2: no selector returns the whole state or builds derived arrays; every multi-field selector uses `useShallow`.
- AC3: the isolation test shows zero page re-renders for `isSyncing` and `error` changes and still updates `PeoplePage` on a people change; it failed before the change.
- AC4: `OrderSetup` save timer is not reset by unrelated re-renders (test).
- AC5: the no-op colour-scheme listener is gone; nothing else in `App.tsx` changed beyond the selector.
- AC6: no other files changed besides the 15 call sites, the two new or extended tests, and any store mock adjustments explained in the report; gate green.

## Ground rules (all prompts)
- Read `AGENTS.md` and `docs/PROJECT_BRIEF.md` first; they are binding.
- Work only on your own branch. Do not push to or merge into `main`.
- Never use production Supabase credentials or data. Mocked data only.
- Never apply SQL, change RLS or auth config, print secrets, change deploy settings, add dependencies, or skip/loosen tests.
- Rollback: one coherent commit series on your branch; state the base commit hash.
