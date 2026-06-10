# zenstack-filter

Headless, type-safe filter system for [ZenStack 3](https://zenstack.dev). Define
filters from your schema, build Prisma-style `where` inputs from active filters,
and (optionally) persist filters per scope with a small set of React hooks.

> Community package — not affiliated with or endorsed by the ZenStack team.

- **Schema-driven** — `FilterDef`s are derived from your ZenStack schema, so
  fields, relations and types stay in sync with the source of truth.
- **Type-safe** — the model is bound before the config is checked, so `where`
  values are narrowed per filter type.
- **Headless** — the core (`build`, `generate`, `operators`, …) has no React or
  UI dependency. The React hooks are opt-in via separate entry points.

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

### Generating the models

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

## Quick start

```ts
import { createFilterSystem } from "zenstack-filter";
import { buildWhere } from "zenstack-filter/build";
import { schema } from "./zenstack/schema"; // your generated ZenStack schema

const { filterFactory } = createFilterSystem({ schema });

// Define a filter set for a model. `where` values are typed per filter.
const invoiceFilters = filterFactory.Invoice({
  // …filter config
});

// Turn the user's active filters into a Prisma-style where input.
const where = buildWhere(invoiceFilters, activeFilters);
const invoices = await db.invoice.findMany({ where });
```

### React hooks (optional)

```tsx
"use client";
import { useFilter } from "zenstack-filter/useFilter";

function InvoiceList() {
  const filter = useFilter(invoiceFilters, { client });
  // filter.where, filter.active, filter.add/remove/update, …
}
```

## Entry points

The core is framework-agnostic; the React pieces are isolated so non-React
consumers never pull in `react`.

| Import | What it is |
| --- | --- |
| `zenstack-filter` | `createFilterSystem`, `filterFactory` |
| `zenstack-filter/build` | `buildWhere` — active filters → `where` input |
| `zenstack-filter/types` | shared types (`FilterDef`, `ActiveFilter`, …) |
| `zenstack-filter/operators` | filter operators |
| `zenstack-filter/schema` | schema helpers |
| `zenstack-filter/generate` | `FilterDef` generation |
| `zenstack-filter/registry`, `/merge`, `/validate`, `/dates`, `/recentStore` | building blocks |
| `zenstack-filter/useFilter` | React: filter state + persistence |
| `zenstack-filter/useFilterViews` | React: saved filter views |
| `zenstack-filter/useFilterOptions` | React: async option loading |
| `zenstack-filter/infiniteSource` | React: infinite option source |
| `zenstack-filter/plugin` | ZenStack plugin: scaffold the persistence models |

## License

[MIT](./LICENSE) © Cedrik Meis
