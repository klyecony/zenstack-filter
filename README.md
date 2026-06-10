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

## License

[MIT](./LICENSE) © Cedrik Meis
