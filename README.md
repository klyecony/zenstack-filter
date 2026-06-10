# zenstack-filter

[![npm](https://img.shields.io/npm/v/zenstack-filter.svg)](https://www.npmjs.com/package/zenstack-filter)
[![license](https://img.shields.io/npm/l/zenstack-filter.svg)](./LICENSE)
[![types](https://img.shields.io/npm/types/zenstack-filter.svg)](https://www.npmjs.com/package/zenstack-filter)

Headless, type-safe filter system for [ZenStack 3](https://zenstack.dev). Derive
filters from your schema, turn a user's active filters into a Prisma-style
`where` input, and — optionally — persist them per scope with a small set of
React hooks.

> Community package — not affiliated with or endorsed by the ZenStack team.

```ts
const { filterFactory } = createFilterSystem({ schema });

const invoiceFilters = filterFactory.Invoice({
  fields: { status: true, total: true, "customer.name": true },
});

const where = buildWhere(invoiceFilters, activeFilters);
const invoices = await db.invoice.findMany({ where });
```

## Why

- **Schema-driven** — `FilterDef`s are derived from your ZenStack schema, so
  fields, relations, and types stay in sync with the source of truth. Dotted
  paths like `"customer.organization.name"` resolve relations automatically.
- **Type-safe** — the model is bound *before* the config is checked, so every
  `where` value is narrowed to its filter's type. No `any` leaking into your
  query builders.
- **Headless** — the core (`build`, `generate`, `operators`, …) has zero React
  or UI dependency. The React hooks live behind separate entry points, so
  non-React consumers never pull in `react`.
- **Persistence is optional** — use the pure `buildWhere` core on its own, or
  opt into per-scope persistence and saved views via hooks.

## Table of contents

- [Install](#install)
- [Concepts](#concepts)
- [Quick start](#quick-start)
- [Defining a filter set](#defining-a-filter-set)
- [React hooks](#react-hooks)
- [Required schema](#required-schema)
- [Generating the models](#generating-the-models)
- [Operators](#operators)
- [Entry points](#entry-points)

## Install

```bash
npm install zenstack-filter
```

Peer dependencies (install the ones you use):

```bash
npm install @zenstackhq/orm @zenstackhq/schema zod
# only if you use the React hooks:
npm install react
```

| Peer | Range | Required for |
| --- | --- | --- |
| `@zenstackhq/orm` | `^3` | types |
| `@zenstackhq/schema` | `^3` | schema helpers |
| `zod` | `>=3` | validation |
| `react` | `>=18` | hook entry points only (optional) |

## Concepts

A few terms recur throughout the API:

| Term | What it is |
| --- | --- |
| **Filter set** | A named collection of filters bound to one model. Created with `filterFactory.Model(config)`; returned as an opaque handle you pass to `buildWhere` / hooks. |
| **`FilterDef`** | A single available filter (a field or a virtual one), generated from the set: its `type`, `label`, `operators`, and resolved relation `path`. |
| **`ActiveFilter`** | One filter the user has actually applied: `{ identifier, table, operator, value }`. The list of these is what you turn into a `where`. |
| **`where`** | The Prisma-style input `buildWhere` produces — drop it straight into `db.model.findMany({ where })`. |
| **View** | A named, saved snapshot of a filter set (`FilterView`). The working state (`viewId: null`) and each view are separate buckets of persisted filters. |

The flow is always the same: **define a set → collect active filters → build a
`where`**. Persistence and views are an optional layer the React hooks add on
top of that core.

## Quick start

```ts
import { createFilterSystem } from "zenstack-filter";
import { buildWhere } from "zenstack-filter/build";
import { schema } from "./zenstack/schema"; // your generated ZenStack schema

const { filterFactory } = createFilterSystem({ schema });

// Define a filter set for a model. `where` values are typed per filter.
const invoiceFilters = filterFactory.Invoice({
  fields: {
    status: true,
    total: true,
    "customer.name": true, // relation path — resolved automatically
  },
});

// `activeFilters` is whatever the user has applied, e.g. from your UI:
const activeFilters = [
  { identifier: "status", table: "Invoice", operator: "equal", value: "PAID" },
];

// Turn active filters into a Prisma-style where input.
const where = buildWhere(invoiceFilters, activeFilters);
const invoices = await db.invoice.findMany({ where });
```

## Defining a filter set

A set is configured with `fields` (schema-derived) and `virtual` (custom
filters that aren't a single field).

```ts
const invoiceFilters = filterFactory.Invoice({
  // Optional stable key — required if you register two sets on the same model.
  key: "invoices",

  fields: {
    // `true` accepts the schema-inferred type, operators, and label.
    status: true,
    "customer.name": true,

    // …or override per field.
    total: { label: "Amount", type: "number" },
    priority: {
      type: "select",
      options: [
        { value: "low", label: "Low" },
        { value: "high", label: "High" },
      ],
    },
  },

  // Virtual filters: not derived from one field. The `where` callback gets the
  // typed value and returns a fully-typed where input for the model.
  virtual: {
    overdue: {
      label: "Overdue",
      type: "select",
      options: [{ value: "yes", label: "Overdue only" }],
      where: () => ({ dueDate: { lt: new Date().toISOString() }, status: "OPEN" }),
    },
  },
});
```

**Filter types:** `text` · `number` · `select` · `multiselect` · `date` ·
`dateRange` · `choice`. Each has a default operator and a set of valid
operators — see [Operators](#operators).

## React hooks

The hooks add persistence on top of the core. They expect a ZenStack-generated
client for your `Filter` (and `FilterView`) model — see
[Required schema](#required-schema).

### `useFilter` — filter state + persistence

```tsx
"use client";
import { useFilter } from "zenstack-filter/useFilter";

function InvoiceList() {
  const { where, control } = useFilter(invoiceFilters, {
    client,              // ZenStack client for the Filter model (stable reference)
    scope: { userId },   // strongly-typed; persists/loads this user's filters
  });

  const invoices = db.invoice.useFindMany({ where });

  return (
    <>
      {control.availableFilters.map((def) => (
        <FilterChip key={def.identifier} def={def} onApply={control.applyFilter} />
      ))}
      {control.activeFilters.map((f) => (
        <ActivePill key={f.identifier} filter={f} onRemove={control.removeFilter} />
      ))}
      <button onClick={control.clearFilters}>Clear all</button>
      {/* render `invoices.data` */}
    </>
  );
}
```

`useFilter` returns `{ where, control }`:

| Field | What it is |
| --- | --- |
| `where` | Prisma-style where input, ready for `findMany`. |
| `control.availableFilters` | `FilterDef[]` — what can be applied (filterable by `filterAvailable`). |
| `control.activeFilters` | `ActiveFilter[]` — what is currently applied. |
| `control.applyFilter(f)` | Persist (upsert) an active filter. |
| `control.removeFilter(f)` | Remove a single active filter. |
| `control.clearFilters()` | Remove all filters in the current bucket. |
| `control.hasErrors` | `true` if the last persistence mutation failed. |

Options: `client` (required), `scope`, `enabled` (gate persistence on/off),
`viewId` (`null` working state — the default — or a view id to edit that view
live), and `filterAvailable` (visibility predicate for the palette).

### `useFilterViews` — saved views

```tsx
import { useFilterViews } from "zenstack-filter/useFilterViews";

const { views, activeView, saveAsNewView, renameView, deleteView } =
  useFilterViews(invoiceFilters, {
    viewClient,            // ZenStack client for the FilterView model
    filterClient: client,  // same client useFilter uses for the Filter model
    scope: { userId },
    activeViewId,          // the view currently open in your UI
  });
```

Point `useFilter`'s `viewId` at `activeView?.id` to read and edit that view's
rows directly — open views are edited live, not copied into the working state.

### `useFilterOptions` — resolving option lists

`useFilterOptions(def)` resolves a filter's static array or loader options to
`{ options, loading }` for rendering a dropdown. For large datasets, supply a
search-first async source (`useSearch` / `useResolve`) — `zenstack-filter/infiniteSource`
provides `createInfiniteSearch` to wire infinite scroll onto an
`useInfiniteQuery`-style hook.

## Required schema

Persistence (the `useFilter` / `useFilterViews` hooks) reads and writes two
models in **your** ZenStack schema: `Filter` and `FilterView`. The package owns
a fixed set of columns — `id`, `filterSet`, `identifier`, `operator`, `value`,
`viewId`, `createdAt`, `updatedAt` on `Filter`, and `id`, `name`, `filterSet`,
`createdAt`, `updatedAt` on `FilterView`.

> You can scaffold these models with the bundled plugin instead of writing them
> by hand — see [Generating the models](#generating-the-models). If you only use
> the headless core (`buildWhere`, `createFilterSystem`) without the persistence
> hooks, you don't need these models at all.

```zmodel
model Filter {
  id         String      @id @default(cuid())

  filterSet  String
  identifier String
  operator   String
  value      Json
  viewId     String?
  view       FilterView? @relation(fields: [viewId], references: [id], onDelete: Cascade)
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt

}

model FilterView {
  id        String   @id @default(cuid())

  name      String
  filterSet String
  filters   Filter[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## Generating the models

Instead of writing the models by hand, register the bundled plugin in your
`schema.zmodel`. On the next `zen generate` it scaffolds the two models into a
ZModel file you then import:

```zmodel
plugin filter {
  provider    = 'zenstack-filter/plugin'
  output      = './generated/filter.zmodel'   // relative to the schema; default: filter.zmodel
  filterModel = 'Filter'                       // optional, default: Filter
  viewModel   = 'FilterView'                   // optional, default: FilterView
}
```

```bash
npx zen generate
```

Then import the generated file once:

```zmodel
import './generated/filter'
```

The file is written **only once** — regeneration is skipped as soon as the
models exist in your schema (whether scaffolded or hand-written). So after the
first run the file is yours: add scope fields, tighten the `@@allow` policy, add
relations, and re-run `zen generate` freely without losing changes. The scaffold
ships with `@@allow('all', true)` and a `TODO` — restrict it before going to
production.

| Option | Default | Description |
| --- | --- | --- |
| `output` | `filter.zmodel` | Target file, relative to the schema directory |
| `filterModel` | `Filter` | Name of the generated filter model |
| `viewModel` | `FilterView` | Name of the generated filter-view model |

> The plugin needs `@zenstackhq/sdk` and `@zenstackhq/language` — both come with
> a ZenStack 3 install. If you rename `filterModel`, pass the same name to
> `createFilterSystem({ schema, filterModel: 'SavedFilter' })` — it flows through
> `FilterSet` into the hooks so the typed `scope` stays bound to the right model.

## Operators

Each filter type ships with a default operator and a set of valid ones. Override
them per field via `fields.<name>.operators` / `defaultOperator`, or import the
helpers from `zenstack-filter/operators` (`operatorsFor`, `defaultOperatorFor`,
`operatorsByType`, …).

| Type | Default operator |
| --- | --- |
| `text` | `contains` |
| `number` | `equal` |
| `select` | `equal` |
| `multiselect` | `contains` |
| `date` | `onDate` |
| `dateRange` | `equal` |
| `choice` | `equal` |

Available operators: `equal`, `notEqual`, `greater`, `less`, `contains`,
`notContains`, `onDate`.

## Entry points

The core is framework-agnostic; the React pieces are isolated so non-React
consumers never pull in `react`.

| Import | What it is |
| --- | --- |
| `zenstack-filter` | `createFilterSystem`, `filterFactory` |
| `zenstack-filter/build` | `buildWhere` — active filters → `where` input |
| `zenstack-filter/types` | shared types (`FilterDef`, `ActiveFilter`, `FilterMeta`, …) |
| `zenstack-filter/operators` | filter operators + helpers |
| `zenstack-filter/schema` | schema helpers |
| `zenstack-filter/generate` | `FilterDef` generation |
| `zenstack-filter/registry`, `/merge`, `/validate`, `/dates`, `/recentStore` | building blocks |
| `zenstack-filter/useFilter` | React: filter state + persistence |
| `zenstack-filter/useFilterViews` | React: saved filter views |
| `zenstack-filter/useFilterOptions` | React: async option loading |
| `zenstack-filter/infiniteSource` | React: infinite option source |
| `zenstack-filter/plugin` | ZenStack plugin: scaffold the persistence models |

### Extending filter metadata

`FilterMeta` is empty by default. Augment it to attach project-specific keys
(icons, groups, …) to field overrides and virtual filters — the package itself
never reads them:

```ts
declare module "zenstack-filter/types" {
  interface FilterMeta {
    icon?: string;
    group?: string;
  }
}
```

## License

[MIT](./LICENSE) © Cedrik Meis
