import type { SchemaDef } from "@zenstackhq/schema";
import { createFilterSystem } from "../src/createFilterSystem.ts";
import type { FilterScope, FilterSet } from "../src/types.ts";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;
type Expect<T extends true> = T;

const schema = {
  provider: { type: "postgresql" },
  plugins: {},
  models: {
    Filter: {
      name: "Filter",
      idFields: ["id"],
      uniqueFields: { id: { type: "String" } },
      fields: {
        id: { name: "id", type: "String", id: true },
        filterSet: { name: "filterSet", type: "String" },
        identifier: { name: "identifier", type: "String" },
        operator: { name: "operator", type: "String" },
        value: { name: "value", type: "Json" },
        viewId: { name: "viewId", type: "String", optional: true },
        createdAt: { name: "createdAt", type: "DateTime" },
        updatedAt: { name: "updatedAt", type: "DateTime" },
        userId: { name: "userId", type: "String" },
        organizationId: { name: "organizationId", type: "String" },
      },
    },
    SavedFilter: {
      name: "SavedFilter",
      idFields: ["id"],
      uniqueFields: { id: { type: "String" } },
      fields: {
        id: { name: "id", type: "String", id: true },
        filterSet: { name: "filterSet", type: "String" },
        identifier: { name: "identifier", type: "String" },
        operator: { name: "operator", type: "String" },
        value: { name: "value", type: "Json" },
        viewId: { name: "viewId", type: "String", optional: true },
        createdAt: { name: "createdAt", type: "DateTime" },
        updatedAt: { name: "updatedAt", type: "DateTime" },
        teamId: { name: "teamId", type: "String" },
      },
    },
  },
} as const satisfies SchemaDef;

type Schema = typeof schema;

// 1) Default → keyed off "Filter" → scope = userId | organizationId
type _ScopeDefault = Expect<Equal<keyof FilterScope<Schema>, "userId" | "organizationId">>;

// 2) Override → keyed off "SavedFilter" → scope = teamId
type _ScopeSaved = Expect<Equal<keyof FilterScope<Schema, "SavedFilter">, "teamId">>;

// 3) `filterModel` threads through createFilterSystem → FilterFactory → FilterSet
const sysSaved = createFilterSystem({ schema, filterModel: "SavedFilter" });
type SavedSet = ReturnType<typeof sysSaved.filterFactory.Filter>;
type SavedModelParam = SavedSet extends FilterSet<Schema, infer _M, infer FM> ? FM : never;
type _Threaded = Expect<Equal<SavedModelParam, "SavedFilter">>;

// 4) Default system still threads "Filter"
const sysDefault = createFilterSystem({ schema });
type DefaultSet = ReturnType<typeof sysDefault.filterFactory.Filter>;
type DefaultModelParam = DefaultSet extends FilterSet<Schema, infer _M, infer FM> ? FM : never;
type _ThreadedDefault = Expect<Equal<DefaultModelParam, "Filter">>;
