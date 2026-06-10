import type { ModelResult, WhereInput as ZenstackWhereInput } from "@zenstackhq/orm";
import type {
  GetModels,
  RelationFields,
  RelationFieldType,
  ScalarFields,
  SchemaDef,
} from "@zenstackhq/schema";

export type AnySchema = SchemaDef;

export type ModelName<TSchema extends AnySchema> = Extract<keyof TSchema["models"], string>;

/**
 * Default name of the persistence model. Consumers add a model with this name
 * (the reserved fields — id, filterSet, viewId, identifier, operator, value,
 * createdAt, updatedAt — plus any scope columns) to their ZenStack schema.
 *
 * To use a different name, pass `filterModel` to `createFilterSystem` — the
 * name then flows through `FilterSet` into `useFilter`/`useFilterViews` so
 * `scope` stays typed against the right model. This `FilterModelName` is only
 * the fallback when no override is given.
 */
export type FilterModelName = "Filter";

/**
 * Project-specific metadata merged into every filter (FieldOverride /
 * VirtualFilterConfig / FilterDef). Empty by default — augment via
 * `declare module "zenstack-filter/types"` to add `icon`, `group`, etc.
 */
// biome-ignore lint/suspicious/noEmptyInterface: intentionally empty so consumers can augment via declaration merging
export interface FilterMeta {}

/**
 * Field names the package owns on the persistence model. They MUST exist on the
 * user's Filter prisma model and are excluded from the typed `scope`.
 */
export type ReservedFilterFields =
  | "id"
  | "filterSet"
  | "viewId"
  | "identifier"
  | "operator"
  | "value"
  | "createdAt"
  | "updatedAt";

/**
 * Strongly-typed scope for `useFilter` — derived from the persistence model
 * (`Filter` by default, or whatever `createFilterSystem({ filterModel })` was
 * given). Includes every column except the reserved ones (id, filterSet, …).
 */
export type FilterScope<
  TSchema extends AnySchema,
  TFilterModel extends ModelName<TSchema> = FilterModelName & ModelName<TSchema>,
> = [TFilterModel] extends [never]
  ? never
  : Omit<ModelResult<TSchema, TFilterModel>, ReservedFilterFields>;

export type FieldName<
  TSchema extends AnySchema,
  M extends ModelName<TSchema>,
> = keyof TSchema["models"][M]["fields"] & string;

type Decrement = [never, 0, 1, 2, 3, 4];

export type DottedPath<
  TSchema extends AnySchema,
  M extends GetModels<TSchema>,
  Depth extends number = 3,
> = Depth extends 0
  ? Extract<ScalarFields<TSchema, M>, string>
  :
      | Extract<ScalarFields<TSchema, M>, string>
      | {
          [R in Extract<RelationFields<TSchema, M>, string>]: RelationFieldType<
            TSchema,
            M,
            R
          > extends GetModels<TSchema>
            ? `${R}.${DottedPath<
                TSchema,
                RelationFieldType<TSchema, M, R>,
                Decrement[Depth] & number
              >}`
            : never;
        }[Extract<RelationFields<TSchema, M>, string>];

export type ModelWhereInput<
  TSchema extends AnySchema,
  M extends ModelName<TSchema>,
> = ZenstackWhereInput<TSchema, M>;

export type FilterType =
  | "text"
  | "number"
  | "select"
  | "multiselect"
  | "date"
  | "dateRange"
  | "choice";

export type FilterOperator =
  | "equal"
  | "notEqual"
  | "greater"
  | "less"
  | "contains"
  | "notContains";

export interface DateRange {
  gte: string;
  lte: string;
}

export type ScalarValue = string | number | boolean;

/**
 * Value of a `choice` filter: which option was picked (`key`), plus the
 * sub-editor's value when that option opened one (e.g. a date range).
 */
export interface ChoiceValue {
  key: string;
  value?: FilterValue;
}

export type FilterValue =
  | string
  | number
  | boolean
  | string[]
  | DateRange
  | ChoiceValue
  | null
  | undefined;

export interface FilterOption {
  value: ScalarValue;
  label: string;
}

/** A sub-editor opened by a choice option — any leaf editor type (not `choice`). */
export interface ChoiceEditor {
  type: Exclude<FilterType, "choice">;
  options?: FilterOptions;
  format?: "currency";
}

/**
 * One entry of a `choice` filter. Without `editor` it's a leaf (picking it
 * applies `{ key }`); with `editor` it opens that sub-editor and applies
 * `{ key, value }`.
 */
export interface ChoiceOption {
  key: string;
  label: string;
  editor?: ChoiceEditor;
}

/**
 * Hook-shaped options loader. Called from inside `useFilterOptions(def)` and
 * thus subject to Rules of Hooks — define it at module scope, not inline.
 *
 * Loads ALL options upfront — only suitable for small/medium sets. Use
 * `FilterOptionsAsyncSource` for large datasets that require server-side
 * search.
 */
export type FilterOptionsLoader = () => {
  options: FilterOption[];
  loading?: boolean;
};

/**
 * Search-first options source for large datasets. Two hooks:
 *   - `useSearch(query)` — fetch matches for the dropdown's search term.
 *   - `useResolve(values)` — fetch the option records for the currently
 *      selected values, so the active pill can show labels (and the dropdown
 *      can keep them visible even if they don't match the search).
 *
 * `useSearch` may opt into pagination by returning `hasMore` + `fetchNext`.
 * When present, the dropdown wires an IntersectionObserver on a sentinel at
 * the list's end and calls `fetchNext` to append more options. Sources that
 * load everything in one shot can omit both fields.
 *
 * Both are hooks — define at module scope and keep the `useSearch` /
 * `useResolve` references stable.
 */
export interface FilterOptionsAsyncSource {
  useSearch: (query: string) => {
    options: FilterOption[];
    /** True only during the initial fetch (no pages yet). */
    loading: boolean;
    /** True while a follow-up page is being appended. Optional. */
    loadingMore?: boolean;
    hasMore?: boolean;
    fetchNext?: () => void;
  };
  useResolve: (values: ScalarValue[]) => { resolved: FilterOption[]; loading: boolean };
}

export type FilterOptions = FilterOption[] | FilterOptionsLoader | FilterOptionsAsyncSource;

/** True when the options field is a search-first async source. */
export function isAsyncOptionsSource(
  options: FilterOptions | undefined,
): options is FilterOptionsAsyncSource {
  return (
    typeof options === "object" &&
    options !== null &&
    !Array.isArray(options) &&
    typeof (options as FilterOptionsAsyncSource).useSearch === "function" &&
    typeof (options as FilterOptionsAsyncSource).useResolve === "function"
  );
}

export type ValueForType<T extends FilterType> = T extends "text"
  ? string
  : T extends "number"
    ? number
    : T extends "date"
      ? string
      : T extends "dateRange"
        ? DateRange
        : T extends "select"
          ? ScalarValue
          : T extends "multiselect"
            ? string[]
            : T extends "choice"
              ? ChoiceValue
              : never;

export type WhereInput = Record<string, unknown>;

export interface FilterOperatorDef {
  value: FilterOperator;
  label?: string;
  apply: (input: WhereInput, value: FilterValue, field: string) => WhereInput;
}

/**
 * High-level config for a virtual filter — a filter not derived from a single
 * schema field. The `where` function receives the typed value and returns a
 * fully-typed WhereInput for the registered model.
 *
 * Project-specific keys (icon, group, …) live in the augmentable `FilterMeta`
 * interface and are intersected here so the user can write them flat. The
 * package itself never reads `FilterMeta` keys.
 */
export type VirtualFilterConfig<
  TSchema extends AnySchema,
  M extends ModelName<TSchema>,
  T extends FilterType = FilterType,
> = {
  label: string;
  type: T;
  defaultOperator?: FilterOperator;
  options?: FilterOptions;
  /** For `type: "choice"`: the option tree (leaves + sub-editor options). */
  choices?: T extends "choice" ? ChoiceOption[] : undefined;
  where?: (value: ValueForType<T>) => ModelWhereInput<TSchema, M>;
  operators?: Partial<
    Record<FilterOperator, (value: ValueForType<T>) => ModelWhereInput<TSchema, M>>
  >;
} & FilterMeta;

/** Discriminated union over all FilterTypes — used as the Record value so the user can put any-typed virtualFilter in one map. */
export type AnyVirtualFilterConfig<TSchema extends AnySchema, M extends ModelName<TSchema>> = {
  [T in FilterType]: VirtualFilterConfig<TSchema, M, T>;
}[FilterType];

/**
 * Internal representation produced by the generator. Carries the fully resolved
 * operators (apply functions) and any project-specific meta the user attached.
 */
export type FilterDef = {
  identifier: string;
  table: string;
  field: string;
  path?: string[];
  type: FilterType;
  label: string;
  options?: FilterOptions;
  /** Present for `type: "choice"` — the option tree for the editor/display. */
  choices?: ChoiceOption[];
  operators: FilterOperatorDef[];
  defaultOperator: FilterOperator;
} & FilterMeta;

export interface ActiveFilter {
  identifier: string;
  /** The MODEL this filter targets (for relation-path resolution) — NOT the persisted `filterSet` key. */
  table: string;
  operator: FilterOperator;
  value: FilterValue;
  disabled?: boolean;
  disabledToRemove?: boolean;
}

export interface FilterPersistenceClient {
  // biome-ignore lint/suspicious/noExplicitAny: library boundary
  useFindMany: (args: any, opts?: { enabled?: boolean }) => { data?: PersistedFilterRow[] };
  // biome-ignore lint/suspicious/noExplicitAny: library boundary
  useCreate: () => { mutateAsync: (args: any) => Promise<unknown> };
  // biome-ignore lint/suspicious/noExplicitAny: library boundary
  useUpdate: () => { mutateAsync: (args: any) => Promise<unknown> };
  // biome-ignore lint/suspicious/noExplicitAny: library boundary
  useDelete: () => { mutateAsync: (args: any) => Promise<unknown> };
  // biome-ignore lint/suspicious/noExplicitAny: library boundary
  useDeleteMany: () => { mutateAsync: (args: any) => Promise<unknown> };
}

export interface PersistedFilterRow {
  id: string;
  filterSet: string;
  /** null = editable working state; a FilterView id = a frozen snapshot row. */
  viewId: string | null;
  identifier: string;
  operator: string;
  value: unknown;
}

/**
 * Persistence client for the `FilterView` catalog model. Same hook shape as
 * `FilterPersistenceClient` — the app injects the ZenStack-generated
 * `client.filterView`.
 */
export interface FilterViewPersistenceClient {
  // biome-ignore lint/suspicious/noExplicitAny: library boundary
  useFindMany: (args: any, opts?: { enabled?: boolean }) => { data?: PersistedFilterViewRow[] };
  // biome-ignore lint/suspicious/noExplicitAny: library boundary
  useCreate: () => { mutateAsync: (args: any) => Promise<unknown> };
  // biome-ignore lint/suspicious/noExplicitAny: library boundary
  useUpdate: () => { mutateAsync: (args: any) => Promise<unknown> };
  // biome-ignore lint/suspicious/noExplicitAny: library boundary
  useDelete: () => { mutateAsync: (args: any) => Promise<unknown> };
  // biome-ignore lint/suspicious/noExplicitAny: library boundary
  useDeleteMany: () => { mutateAsync: (args: any) => Promise<unknown> };
}

export interface PersistedFilterViewRow {
  id: string;
  name: string;
  filterSet: string;
}

export interface UseFilterControl {
  availableFilters: FilterDef[];
  activeFilters: ActiveFilter[];
  applyFilter: (filter: ActiveFilter) => Promise<void>;
  removeFilter: (filter: ActiveFilter) => Promise<void>;
  clearFilters: () => Promise<void>;
  hasErrors: boolean;
  table: string;
}

export interface UseFilterReturn {
  where: WhereInput;
  control: UseFilterControl;
}

/**
 * Schema field descriptor — mirrors the shape produced by ZenStack's schema
 * generator. Lives here (not in schema.ts) so it can be referenced from
 * `FilterSystemInternals` without an import cycle.
 */
export interface FieldDef {
  name: string;
  type: string;
  optional?: boolean;
  array?: boolean;
  id?: boolean;
  unique?: boolean;
  updatedAt?: boolean;
  foreignKeyFor?: readonly string[];
  relation?: {
    opposite?: string;
    fields?: readonly string[];
    references?: readonly string[];
    name?: string;
    onDelete?: string;
  };
  default?: unknown;
  attributes?: readonly unknown[];
}

export interface SchemaHelpers {
  hasModel: (model: string) => boolean;
  getField: (model: string, field: string) => FieldDef | undefined;
  getFields: (model: string) => FieldDef[];
  isRelation: (field: FieldDef) => boolean;
  isEnum: (typeName: string) => boolean;
  isPrimitive: (typeName: string) => boolean;
  getEnumValues: (typeName: string) => string[];
  relationKind: (model: string, field: string) => "one" | "many" | undefined;
  getRelationModel: (model: string, field: string) => string | undefined;
  defaultTypeFor: (field: FieldDef) => FilterType;
}

/**
 * Internal shape attached to every `FilterSet` so top-level functions
 * (`useFilter`, `buildWhere`, `generateFilterDefs`, …) can operate on a set
 * without going through a system object. Treat as opaque from the outside.
 */
export interface FilterSystemInternals {
  helpers: SchemaHelpers;
  generator: {
    generateFilterDefsForSet: (setName: string) => FilterDef[];
    findFilterDefForSet: (setName: string, identifier: string) => FilterDef | undefined;
  };
  /** True when `key` is a registered set key — validates persisted `filterSet` values. */
  hasSet: (key: string) => boolean;
}

/**
 * Opaque handle returned by `filterFactory`. Carries enough info for
 * top-level filter functions to look up the registered config and produce
 * typed FilterDefs without going through a system object.
 */
export interface FilterSet<
  TSchema extends AnySchema,
  M extends ModelName<TSchema>,
  TFilterModel extends ModelName<TSchema> = FilterModelName & ModelName<TSchema>,
> {
  readonly __filterSet: true;
  readonly table: M;
  readonly name: string;
  readonly _schema?: TSchema;
  /** Phantom: carries the persistence model name so `useFilter` can type `scope`. */
  readonly _filterModel?: TFilterModel;
  readonly __system: FilterSystemInternals;
}
