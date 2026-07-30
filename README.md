# OT Asset Inventory

A small, filterable inventory of OT (operational technology) network assets: a
paginated/sortable table, a filter + search bar with shareable URLs, and an edit
drawer with validation and an unsaved-changes guard. Built for the Dragos
take-home exercise.

See [DESIGN.md](./DESIGN.md) for the design doc — approach, data model, key
tradeoffs, and what was deliberately cut and why.

## Stack

React 18 + TypeScript, Redux Toolkit + RTK Query, React Hook Form + Zod, MUI v7 +
MUI X DataGrid, MSW (mock API), Vitest + React Testing Library.

## Setup

```bash
npm install
```

There is no real backend and nothing to configure — the API is entirely mocked
via MSW, in-memory, and resets on every reload.

## Run

```bash
npm run dev
```

Opens the app at the URL Vite prints (typically http://localhost:5173).

## Test

```bash
npx vitest run     # full suite, once
npx vitest         # watch mode
```

## Build

```bash
npm run build      # typecheck + production build
npm run preview    # serve the production build locally
```

## Lint

```bash
npm run lint
```

## Demoing the error state

The mock API has no organic way to fail on its own, so there's a dedicated,
deliberate trigger for it: type `force-error` into the search box. It doesn't
filter the list — it fires a separate query that always returns a 500, so you
can see the app's error state without needing to actually break anything. Clear
the search box to return to normal.
