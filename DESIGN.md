# Design Doc — OT Asset Inventory

> **Note on this revision:** this is the original design doc, unedited, with
> `> **Since implementation:**` notes inserted inline wherever the actual
> codebase ended up differing from the plan, and why. Nothing original was
> rewritten or deleted — the plan as written is still fully visible.

## Architecture approach

Single-screen React SPA. One page composes three pieces: a filter/search bar, a
server-columned but client-paginated `DataGrid`, and an edit drawer. All "shareable
state" (filters, sort, page, search) lives in the URL, not in Redux — the URL is the
single source of truth, read/written through a custom hook, and the grid/filter bar
derive their view from it. Redux Toolkit is scoped to what it's actually needed for
here: RTK Query as the server-cache layer. UI-only state that isn't shareable (drawer
open/selected asset, theme) stays in local React state/context — it's one level of
composition, not deep prop-drilling, and Redux state has to stay serializable, which
rules out holding things like a focus-restore ref anyway.

> **Since implementation:** the page ended up with a fourth piece not listed
> here — an `AppBar` (title + the light/dark theme toggle), added when the
> theme-toggle task was built. It's a thin header, not a new architectural
> layer, so the state-ownership reasoning below is unaffected.

## Stack & library decisions

| Concern | Choice | Why |
|---|---|---|
| Build tool | Vite | Native TS, fast HMR, zero-config pairing with Vitest — no separate transform setup |
| Test runner | Vitest + RTL (`jest-dom`, `user-event`) | Shares Vite's config/transform pipeline; Jest-compatible API so no learning-curve cost |
| Test DOM env | jsdom, explicit `environment: 'jsdom'` + setup file | Not automatic — Vitest defaults to Node. `jsdom` is installed and configured by hand; setup file wires up `jest-dom` matchers and the MSW node server lifecycle |
| Data table | MUI X DataGrid (Community) | Required by brief; handles ~300 rows client-side without strain |
| Server cache | RTK Query | Required by brief; single `getAssets` query + `updateAsset` mutation is all that's needed |
| Forms | React Hook Form + Zod (`@hookform/resolvers`) | Required by brief; Zod gives a typed schema RHF can bind to directly, minimal boilerplate |
| Routing | None — custom `useUrlState` hook over `URLSearchParams`/`history.pushState` | Single-screen app; adding react-router would be a dependency with no page to route to. **Locked**: not to be added later "for convenience" |
| Mock API | MSW | Required-recommended; intercepts fetch, simulates latency, has a magic-string error trigger (`force-error` in search) |

> **Since implementation:** the "single `getAssets` query + `updateAsset`
> mutation" line undersold it slightly — a third endpoint, `triggerError`, was
> added for the `force-error` demo (see the API/data flow notes below). The
> router lock held for the whole project; no router was ever added.

## Data model

```ts
type AssetType =
  | "PLC" | "RTU" | "HMI" | "Engineering Workstation"
  | "Historian" | "Switch" | "Firewall" | "Sensor" | "Controller";

type Zone =
  | "Level 0 – Process" | "Level 1 – Control" | "Level 2 – Supervisory"
  | "Level 3 – Operations" | "Level 4 – Enterprise" | "DMZ";

type Criticality = "Low" | "Medium" | "High" | "Critical";

interface Asset {
  id: string;
  name: string;
  type: AssetType;
  ipAddress: string;
  zone: Zone;
  criticality: Criticality;
  lastSeen: string; // ISO 8601
}
```

~300 seeded/generated records, held entirely by the mock server (resets on reload —
no persistence, by design).

> **Since implementation:** matches the shipped `Asset` type exactly. One
> addition: `types.ts` also exports a `CRITICALITY_ORDER` lookup (`Low` → `0`
> … `Critical` → `3`), added to support the severity-order sort comparator
> mentioned in the tradeoffs section below.

## State ownership

| State | Owner | Why |
|---|---|---|
| Filters, sort, page, committed search (`q`) | URL (`useUrlState`) | Must be shareable by definition; avoids a second copy drifting from the URL |
| Pending (uncommitted) filter/search values, debounce timer | Local component state | Ephemeral, exists only to show "pending vs applied"; committing writes it into the URL |
| Asset list + fetch status | RTK Query cache | Single query, cached, refetch-on-mutation-success handles staleness |
| Currently-open asset id, drawer open/closed, focus-restore target | Local state/`useRef` in the page component | One level of composition, not deep prop-drilling — doesn't need Redux. The focus-restore target is a DOM ref (`document.activeElement` captured on open), which can't live in Redux state at all since store state must stay serializable |
| Theme mode | React Context + `localStorage` | Same reasoning as drawer state — no cross-cutting need Redux specifically solves; keeps Redux scoped to RTK Query, its actual job here |
| Form values / dirty / validation state | React Hook Form (local to drawer) | Scoped to the edit session, no reason to lift it |

> **Since implementation:** this table held up as written for every row. The
> edit-drawer row is worth a pointer to the accessibility section below,
> where the "drawer" turned out to be two components, not one.

## API / data flow

1. `GET /assets` — MSW returns the full mock list once; RTK Query caches it.
   Filtering/sorting/pagination are applied **client-side** via a memoized selector
   reading current URL state, then handed to `DataGrid` in client pagination mode.
2. Search input debounces (300ms) locally before being written to the URL as `q` —
   this is the "pending → applied" transition surfaced in the UI.
3. Edit drawer: `PATCH /assets/:id` via an RTK Query mutation; on success, the cache
   entry updates and the drawer closes. On failure, the drawer stays open and shows
   an inline error — no data is lost.
4. Error-state demo path: typing `force-error` into the search box is checked in the
   MSW handler and returns a 500, since this is otherwise unreachable from the UI
   (documented in the README).

> **Since implementation, point 1:** only *filtering* is actually done by a
> memoized selector (`filterAssets`). Sorting is done by `DataGrid` itself in
> client mode, driven by a `sortModel` synced with the URL plus two custom
> `sortComparator`s (severity order for criticality, numeric octet order for
> IP address — see the tradeoffs section). Pagination is `DataGrid` slicing
> the already-filtered array. "Client-side, not server-side" held; the
> selector doing all three did not.
>
> **Since implementation, point 1 (addition):** a piece of logic not
> anticipated here at all — if a URL names a page beyond what the current
> (possibly filtered) row count supports, `DataGrid` clamps its own *display*
> to the last valid page but has no way to tell the app, so the URL itself
> would stay wrong. `AssetTable` now corrects the URL's `page` param itself
> once the real row count is known, found and fixed during a later review
> pass, not designed in up front.
>
> **Since implementation, point 3 (addition):** this bullet only covers the
> mutation's *own* failure. A separate failure mode was found later: the
> mutation can succeed (and the drawer closes) while the background refetch
> that `invalidatesTags` triggers afterward fails on its own. Originally this
> replaced the whole grid with a full-page error, discarding perfectly good
> cached data over what was really just a refresh hiccup. Fixed so the grid
> keeps showing the stale data with a small warning banner, and only takes
> over the whole view when there's truly no data left to fall back on.
>
> **Since implementation, point 4:** two things changed here. First, the
> mechanism: `getAssets` was kept a single parameterless, cached-once fetch
> as designed — the `force-error` check was *not* added to it. Instead there's
> a dedicated `triggerError` query, skipped unless the committed search term
> is exactly `force-error`, so real search never touches it. Second — "(documented
> in the README)" was aspirational when this was written. The README was
> actually left as the unmodified Vite template for a large stretch of the
> project and only got written for real during a later review pass. Between
> those two points, this line was true in intent but not in fact.

**Base URL:** `fetchBaseQuery` uses one absolute constant (`http://localhost/api`),
shared verbatim by the API slice and the MSW handlers — not a relative `/api` path.
Node's fetch (what Vitest actually runs under, even with `environment: 'jsdom'`) can't
resolve a relative URL against a page location the way a browser does, so a relative
base works in dev and throws in tests. One shared absolute constant sidesteps the
whole issue with no environment branching; there's no real backend to make this
"wrong" for, since the API is mocked by design.

> **Since implementation:** held exactly as designed — `src/apiConfig.ts`
> exports `API_BASE_URL`, imported verbatim by both the API slice and the
> mock handlers. That file isn't listed anywhere in the folder structure
> below; it should be.

## Folder structure

```
src/
  app/            store.ts, ThemeContext.tsx
  features/
    assets/
      api.ts          # RTK Query endpoints
      types.ts
      selectors.ts    # client-side filter/sort/paginate
      components/
        AssetTable.tsx
        FilterBar.tsx
        EditDrawer.tsx
        UnsavedChangesDialog.tsx
  hooks/
    useUrlState.ts
    useDebouncedValue.ts
  mocks/
    handlers.ts, browser.ts, server.ts, data.ts
  test/
    setup.ts   # jest-dom matchers, MSW node server start/reset/close
```

> **Since implementation:** the actual tree grew in several places this
> diagram didn't anticipate:
> - `src/apiConfig.ts` — the shared `API_BASE_URL` constant (see above);
>   sits at `src/` root, not under any of the folders shown here.
> - `app/theme.ts` — a `createAppTheme(mode)` factory (palette + typography),
>   split out once the brand color and fonts were added.
> - `app/useThemeMode.ts` — the context object and `useThemeMode()` hook were
>   split out of `ThemeContext.tsx` after `oxlint` flagged that file for
>   mixing a hook and components in one module (a Fast Refresh reliability
>   warning). `ThemeContext.tsx` now holds only the provider and the toggle
>   button component.
> - `features/assets/assetFormSchema.ts` — the Zod schema for the edit form;
>   not anticipated as its own file here.
> - `features/assets/sortComparators.ts` — holds *two* comparators, not
>   flagged at all in this tree (`compareCriticality` and `compareIpAddress`
>   — the IP one wasn't anticipated until implementation, see tradeoffs
>   below).
> - `features/assets/components/CriticalityChip.tsx` — not listed here.
> - `test/setup.ts` grew well beyond "jest-dom matchers, MSW node server
>   lifecycle" — it also carries polyfills for three real jsdom gaps found
>   during implementation: no `ResizeObserver`, `offsetHeight`/`offsetWidth`
>   always `0` (both needed for `DataGrid`'s row virtualization to render
>   anything at all under jsdom), and no callable `window.matchMedia` (needed
>   for the theme toggle's system-preference default).

## Key tradeoffs & alternatives considered

- **Client- vs server-side pagination/filter (MSW):** chose client-side. Server-mode
  DataGrid would require syncing controlled `paginationModel`/`sortModel`/`filterModel`
  against both the URL and RTK Query cache args — real complexity bought for realism
  a 300-row mock can't actually demonstrate. Documented as a deliberate cut.
- **Filter state in a Redux slice vs the URL:** chose URL-only, to avoid two sources
  of truth. Redux is reserved for state that has no URL meaning (drawer, theme).
- **react-router vs a custom URL hook:** custom hook — one screen doesn't need a router,
  and the URL-sync logic is a handful of lines either way.
- **Zod+RHF vs manual validation:** Zod schema, for typed inference and because RHF's
  resolver API makes it nearly free.
- **Theme: system-only vs manual toggle:** manual toggle (defaulting to system, persisted).
  System-only technically satisfies "support," but a reviewer can't see both themes
  without changing OS settings mid-review — the toggle removes that friction.
- **Drawer/theme state: Redux `ui` slice vs local state+context:** local — Redux state
  must stay serializable (a focus-restore DOM ref can't live there), and this state
  isn't cross-cutting enough to need a global store; keeps Redux scoped to RTK Query.
- **DataGrid pagination/sort/filter modes:** explicit `paginationMode="client"` and
  `sortingMode="client"` (not left implicit — MUI's own docs default examples to
  server mode, which would silently stop paginating a pre-fetched array). Criticality
  gets a custom `sortComparator` (severity order, not alphabetical). The grid's own
  column-filter UI and quick-filter toolbar are disabled so filtering only ever
  happens through the URL-synced FilterBar — otherwise a user could filter through
  the grid directly and silently break shareability.

> **Since implementation, last bullet:** IP address needed the same
> treatment, not anticipated when this was written — a default string sort
> ranks `"10.10.100.5"` before `"10.10.20.5"` (lexicographic, not numeric
> octet comparison), the same category of bug as criticality. It got its own
> `compareIpAddress` comparator alongside `compareCriticality`.

Every other bullet in this list held exactly as written — client-side
pagination, URL-only filter state, no router, Zod+RHF, the manual theme
toggle, and Redux scoped to RTK Query all shipped as designed, with no
changes discovered along the way.

## Intentional non-goals

Create/delete assets, bulk actions, auth/roles, real persistence, column
show/hide/reorder/resize persistence, saved filter presets beyond URL sharing,
real-time/websocket updates, audit history, CSV export, deep mobile-specific layout,
i18n, a full WCAG audit (baseline semantic/ARIA correctness only).

> **Since implementation:** "deep mobile-specific layout" mostly held — no
> bespoke mobile IA was built — but it wasn't absolute: `FilterBar` later got
> basic responsive behavior (stacking vertically, full-width controls below
> the `sm` breakpoint) after a direct request to fix it. That's a shallow CSS
> fix, not the "deep" layout work this line was ruling out, so the spirit of
> the cut held even though the letter of it moved slightly. Every other item
> in this list was never built.

## Accessibility considerations affecting architecture

- **Drawer** needs `role="dialog"` + `aria-modal`, a focus trap, focus moved to the
  first field on open, and focus restored to the triggering row/button on close —
  this means the row action needs to hold a ref to return focus to, not just an id.
- **Unsaved-changes confirmation** is itself a focus-trapped, keyboard-operable
  dialog that sits *in front of* the drawer's own close/Escape/backdrop handlers —
  those handlers route through a single `attemptClose()` guard rather than closing
  directly.
- **Pending vs applied search/filter state** is conveyed via text/icon, not color
  alone, with an `aria-live="polite"` region announcing "searching…" / result counts.
- **Criticality** renders as a labeled chip (text + color), never a color swatch alone.
- **Loading/error states** use `aria-busy` and `role="alert"` respectively, so screen
  readers pick them up without relying on visual scanning.

> **Since implementation, drawer bullet:** a real MUI quirk turned up here —
> passing `role`/`aria-modal` directly to `<Drawer>` gets forwarded onto
> *both* the Modal root and the Paper, producing two `role="dialog"`
> elements (ambiguous for both queries and assistive tech). Fixed by scoping
> those props to `slotProps.paper` instead — the actual content panel, not
> the backdrop wrapper. Focus-on-open and focus-restore-on-close both shipped
> as designed.
>
> **Since implementation, unsaved-changes bullet:** the "drawer" split into
> two components, not anticipated as a single unit here: `EditDrawer` owns
> `attemptClose()`, the dirty flag, and the confirmation dialog; a separate
> `EditAssetForm` owns the actual React Hook Form state and reports dirty
> state up via an `onDirtyChange` callback. This split exists specifically so
> the form only mounts once per editing session — reactively resetting it on
> every render could otherwise wipe in-progress edits if the list refetches
> in the background while the drawer is open. The `attemptClose()` guard
> itself shipped exactly as described.
>
> **Since implementation, pending/applied bullet:** implemented as
> `role="status"` rather than a literal `aria-live="polite"` attribute —
> `role="status"` carries an implicit `aria-live="polite"`, so this is the
> same behavior via ARIA's built-in role semantics rather than a raw
> attribute. Functionally what was designed; different DOM shape.

The criticality and loading/error bullets shipped exactly as written, with
no changes.
