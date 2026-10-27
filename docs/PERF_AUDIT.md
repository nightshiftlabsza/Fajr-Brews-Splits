# Performance and cleanup audit (2026-10-27)

Audited `main` at `cf7b216`. Measurements were taken in the cloud container; the live site and the live Supabase project were not reachable from it, so no real-network timings exist yet.

## Baseline

- Stack: React 18 + TypeScript (strict), Vite 5, one Zustand store (`src/store/appStore.ts`, 1,720 lines) holding auth, data, Supabase reads/writes and one realtime channel. No router: `App.tsx` switches tabs by state and mounts all five tab pages at once, hiding the inactive ones with CSS. Hosted on Cloudflare Pages. No linter configured (per `AGENTS.md`).
- Gate: `npm run typecheck` clean; `npm test` 37 files, 424 tests passing; `npm run build` passes.
- Startup JavaScript (gzip): entry 111.5 kB + vendor (React) 45.3 kB + **pdf 118.5 kB preloaded** = 275 kB. html2canvas, purify and canvg are correctly lazy.
- Startup network (owner): `getSession` → members + person link (parallel) → people → orders → roasters → settings. Five sequential round trips after the session check before the loading screen clears.
- Render cost (jsdom, 41 orders x 6 lots x 4 bags, 12 people): `calculate()` for all 41 orders takes 2.7 ms in total, so calculations are not the bottleneck. One unrelated store change (`isSyncing` toggle) re-rendered all four data pages; two toggles cost about 39 ms of React render time, 28 ms of it in HistoryPage. jsdom is slower than a browser; treat as relative, not absolute.

## Why the loading screen keeps appearing

The splash shows only when `isInitialized` is false, i.e. on a full page load. Tab-switch events no longer cause it: earlier fixes (`ada70a7`, `92c4ec8`) skip `TOKEN_REFRESHED`, and the `SIGNED_IN` that supabase-js fires on every return to the tab is ignored for the same user. What remains is that phone browsers routinely throw away background tabs, so returning to the app is a cold start, and a cold start is slow because of findings 1 to 3.

## Findings (ranked)

| ID | Pri | Finding | Evidence | Fix | Confidence |
|---|---|---|---|---|---|
| F1 | P1 | jsPDF (118 kB gzip) downloads on every open | `dist/index.html` modulepreloads `pdf-*.js`; entry imports Vite's preload helper from it. Caused by `manualChunks.pdf` in `vite.config.ts` | Delete that entry. Verified locally: startup JS 275 → 158 kB gzip | High |
| F2 | P1 | Startup queries run one after another | `initialize`, `appStore.ts` ~628-710 | One `Promise.all` after the access check. Saves 3-4 round trips (not measured live) | High |
| F3 | P1 | Every cold open blocks on the network | Splash waits for all queries; nothing is shown from the last visit | Show last-known data instantly from a local snapshot, refresh in the background (needs owner decision: data stays in the browser) | High that it removes the splash on return visits |
| F4 | P1 | Every store change re-renders all five tabs | 15 components call `useAppStore()` with no selector; all tabs stay mounted; measured above | Select only the fields each component uses (`useShallow`). Run after prompts 09/10 merge (same files) | High |
| F5 | P2 | Built assets may not be cached long-term | No `public/_headers`; Cloudflare Pages default revalidates every asset on each load. Not verified on the live site (blocked from the container) | Add `/assets/* Cache-Control: public, max-age=31536000, immutable` to the `_headers` file prompt 08 creates | Medium |
| F6 | P2 | Unused dependency `jspdf-autotable` | No import anywhere in `src/` | Remove (folded into Prompt 1) | High |
| F7 | P3 | `OrderSetup` debounced name/bank save timer restarts on any re-render | `patchOrder` is a new function each render and is an effect dependency (`OrderSetup.tsx` ~85, 177-211) | Mostly disappears with F4; revisit after | Medium |
| F8 | P3 | Dead "force repaint" listener in `App.tsx` ~237-259 | Sets `data-mode` to the value it already has; CSS media queries update on their own | Delete with the next App.tsx change | High |

Checked and not a problem: one realtime channel, created once and torn down on sign-out; no leaked timers or listeners found; money calculation cost is negligible; Google Fonts lists five families but browsers only download the ones the active theme uses. Database indexes: there are none beyond primary keys, but the app reads one small workspace; an index is not justified until order counts grow into the thousands.

## Batches and run order

| Prompt | Content | Files | Run |
|---|---|---|---|
| Prompt 1 | F1, F2, F6 | `vite.config.ts`, `package*.json`, `appStore.ts` (initialize) | Now; no overlap with 08, 09, 10 |
| Prompt 2 | F3 instant reopen from snapshot (owner approved 2026-10-27) | `appStore.ts`, `App.tsx`, new `src/lib/startupSnapshot.ts` | After prompt 1 merges |
| Prompt 3 | F4 selectors, F7, F8 | 15 components, `App.tsx` | After prompt 2 merges (09 and 10 are already merged) |
| 08 addition | F5 cache header | `public/_headers` | Added to security prompt (PR #14) |
