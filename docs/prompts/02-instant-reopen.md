# Prompt 2 of 9: Instant reopen from last visit's data

Branch: `prompt/02-instant-reopen`, cut from `main` **after prompt 1 is merged** (both change `initialize` in `src/store/appStore.ts`). Do not run at the same time as prompt 3 (both change `src/App.tsx`).

## Objective
When a signed-in user reopens the app (including when a phone browser reloads a tab it unloaded in the background), show their last-known people, orders, roasters and settings immediately instead of the "Fajr Brews" loading screen, then refresh from Supabase in the background. The owner has approved storing this copy in the browser's localStorage, provided it is wiped on sign-out.

## Verified context (checked by Claude on `main`)
- The splash in `src/App.tsx` shows only while `!isInitialized || accessStatus === 'checking'`. A silent re-init (`initialize({ silent: true })` when `isInitialized` is already true) already keeps the UI up and shows the small "Syncing..." badge via `isSyncing`. That path is what we want on every reopen.
- `initialize` (`appStore.ts`) starts with `supabase.auth.getSession()`. When the stored access token is near expiry (any reopen more than about an hour later), that call waits for a network token refresh, so the snapshot must be shown **before** `getSession` is awaited, not after.
- `safeLocalStorage` (`appStore.ts` ~235) already wraps localStorage in try/catch. Theme, mode and `fb_current_order_id` are already persisted there.
- `signOut` (`appStore.ts` ~814) resets state; the `!session?.user` branch of `initialize` does the same for sessions that ended elsewhere.
- The store's `error` field is never displayed anywhere in the UI (`grep` finds no reader). A failed background refresh would therefore be invisible.
- `updateOrder` writes whole `lots`/`fees`/`payments` JSON. Applying an edit on top of stale data and writing it would overwrite newer server data. Writes must wait for fresh data.

## Required changes
1. **New pure module `src/lib/startupSnapshot.ts`** with colocated `startupSnapshot.test.ts`:
   - `saveStartupSnapshot(storage, snapshot)`, `readStartupSnapshot(storage)`, `clearStartupSnapshot(storage)`. Take the storage object as a parameter (pass `safeLocalStorage`), so tests need no globals.
   - One localStorage key, versioned: `fb_startup_snapshot_v1`.
   - Snapshot contents: `version`, `savedAt` (ISO), `userId`, `accessStatus` (`'member' | 'participant'` only), `memberRole`, `linkedPersonId`, `people`, `orders`, `roasters`, `roasterFeatureStatus`, `settings`. Nothing else: no session tokens, no `linkResolution`, no `workspaceMembers`, no UI state.
   - `readStartupSnapshot` returns `null` (and clears the key) when the value is missing, not JSON, the wrong version, missing required fields or wrong top-level types, or older than 30 days. Check shape at the top level and that the arrays are arrays; do not write a deep validator.
   - `saveStartupSnapshot` must not throw: if `JSON.stringify` or `setItem` fails (quota), it leaves no partial value and returns quietly.
2. **Hydrate before the network.** In `initialize`, when this is the first (blocking) pass and a valid snapshot exists, `set` the snapshot data with `isInitialized: true`, `isLoading: false`, `isSyncing: true` **before** awaiting `getSession`. The user is `{ id: snapshot.userId }` plus whatever profile fields you also store for it (email/fullName are needed by the Header: store them in the snapshot as `user`). Then run the existing logic unchanged except:
   - If `getSession` returns no user, or a different user id than the snapshot's, clear the snapshot and fall through to the existing behaviour (auth screen or that user's normal load). The blocking spinner must not reappear for the no-session case: going straight to the sign-in screen is correct.
   - If access is now `none`, clear the snapshot.
   - On success, the existing final `set` replaces everything with fresh data and sets `isSyncing: false`; then save a new snapshot.
   - On failure while showing snapshot data, keep the snapshot data on screen, set `isSyncing: false`, and set the existing `error` field.
3. **Keep the snapshot current without per-keystroke writes.** Save the snapshot (a) after each successful `initialize`, and (b) when the page is hidden (`visibilitychange` to `hidden`, and `pagehide`), from listeners registered once in `App.tsx`'s existing mount effect and removed in its cleanup. Do not save on every store change.
4. **Clear the snapshot** in `signOut`, in the `!session?.user` branch of `initialize`, on user mismatch, and when access becomes `none`.
5. **Writes wait for fresh data.** While the visible data came from a snapshot and the refresh has not settled, every store action that writes to Supabase (orders, people, roasters, settings, members, join/leave, import) must first await the in-flight `initializePromise`, then read state and apply its change. Implement this with one small private helper used at the top of each such action; do not duplicate the waiting logic. After the refresh settles (success or failure), actions run immediately as today.
6. **Visible stale-data notice.** In `App.tsx`, next to the existing "Syncing..." badge, when the background refresh failed and the screen is showing snapshot data, show a small notice: "Couldn't refresh. Showing data saved {relative or formatted time}." with a "Retry" button that calls `initialize({ silent: true })`. Reuse existing classes (`alert`, `btn btn-ghost btn-sm`) and tokens; no new CSS file. It disappears after a successful refresh.

## Constraints
- No change to money logic, PDF code, Supabase queries, RLS, or what any role can see. The snapshot holds only what the store already held for this user.
- The first-ever open (no snapshot) behaves exactly as today, splash included.
- `initializePromise` de-duplication, realtime setup order and the `onAuthStateChange` handling in `App.tsx` stay as they are.
- No new dependencies, no service worker, no IndexedDB.

## Anti-patterns to avoid
- Do not persist with Zustand's `persist` middleware: it would persist on every change and hydrate on its own schedule, which conflicts with item 2 and item 3.
- Do not read Supabase's own auth storage key to find the user id; the snapshot's `userId` is what you check against `getSession`.
- Do not hide the problem by skipping the refresh when a snapshot exists; it must always refresh.
- Do not add a deep schema validator or new types that duplicate `Order`/`Person`/`Roaster`; reuse `src/types`.
- No `any`, no non-null assertions, no comments that narrate code.

## Verification required
1. `startupSnapshot.test.ts`: round trip; wrong version; corrupt JSON; missing fields; older than 30 days; quota error on save leaves nothing behind; clear.
2. In `appStore.test.ts`, using the existing Supabase mock with a `getSession` you resolve manually:
   - With a valid snapshot for user A, after calling `initialize()` and **before** resolving `getSession`, `isInitialized` is true, `isLoading` is false, `isSyncing` is true and `orders`/`people` equal the snapshot's. After resolving, the state holds the fresh data, `isSyncing` is false, and the saved snapshot holds the fresh data.
   - `getSession` returns no user: snapshot cleared, `user` null.
   - `getSession` returns user B: snapshot cleared, B's data loaded.
   - Refresh fails: snapshot data still present, `error` set, `isSyncing` false.
   - `updateOrder` called while the refresh is in flight does not call Supabase until the refresh resolves, and then applies its patch on top of the fresh order, not the snapshot order.
   - `signOut` clears the snapshot.
   - No snapshot: first `initialize()` sets `isLoading: true` as today (existing test must pass unchanged).
3. A component test for the stale-data notice: shown after a failed refresh with snapshot data, Retry calls `initialize({ silent: true })`, hidden after success.
4. Manual check in `npx vite preview` with mocked or dummy env, described honestly: what you could and could not see without a live backend.
5. Gate from a clean state: `npm run typecheck && npm test && npm run build`. Paste real output.

## Stop conditions
Stop and report instead of guessing if: prompt 1 is not merged into your base; an action that writes to Supabase cannot be gated without restructuring it; the existing tests need edits other than adding mock hooks; or anything seems to need SQL, live Supabase, or a dependency.

## Completion report (AGENTS.md format)
1. Files changed. 2. Diff summary per file. 3. Commands run with real output. 4. Each acceptance criterion: met / not met, with evidence. 5. Skipped or uncertain, including real-device timing (not measurable without the live backend).

## Acceptance criteria (Claude reviews against these)
- AC1: with a valid snapshot, the store is initialized with snapshot data before `getSession` resolves (test proves it).
- AC2: the snapshot holds only the listed fields; no tokens; one versioned key; invalid or stale (>30 days) snapshots are discarded.
- AC3: snapshot cleared on sign-out, no session, user mismatch and no access (tests).
- AC4: no Supabase write happens on top of snapshot data; gated writes apply on fresh data (test).
- AC5: snapshot saved after successful init and on page hide only; listeners cleaned up.
- AC6: failed refresh keeps data on screen with a visible notice and working Retry (test).
- AC7: first-ever open unchanged; gate green; test count is the previous total plus only new tests; no files beyond `appStore.ts`, `appStore.test.ts`, `App.tsx`, a test for App's notice, and the new `startupSnapshot` module and test.

## Ground rules (all prompts)
- Read `AGENTS.md` and `docs/PROJECT_BRIEF.md` first; they are binding.
- Work only on your own branch. Do not push to or merge into `main`.
- Never use production Supabase credentials or data. Mocked data only.
- Never apply SQL, change RLS or auth config, print secrets, change deploy settings, add dependencies, or skip/loosen tests.
- Rollback: one coherent commit series on your branch; state the base commit hash.
