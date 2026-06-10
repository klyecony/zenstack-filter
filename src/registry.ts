import type {
  AnySchema,
  AnyVirtualFilterConfig,
  DottedPath,
  FilterMeta,
  FilterOperator,
  FilterOperatorDef,
  FilterOptions,
  FilterType,
  ModelName,
} from "./types.ts";

export type FieldOverride = {
  label?: string;
  type?: FilterType;
  operators?: FilterOperatorDef[];
  defaultOperator?: FilterOperator;
  options?: FilterOptions;
  path?: string[];
} & FilterMeta;

export type ModelFilterFields<TSchema extends AnySchema, M extends ModelName<TSchema>> = {
  [K in DottedPath<TSchema, M>]?: FieldOverride | true;
};

export interface ModelFilterConfig<TSchema extends AnySchema, M extends ModelName<TSchema>> {
  /**
   * Stable identity of this filter set. Persisted as the `filterSet` column and
   * used as the registry key. Defaults to the model name — give an explicit key
   * when you register more than one set on the same model (the factory throws on
   * a duplicate). Must stay stable: changing it orphans saved filters/views.
   */
  key?: string;
  fields?: ModelFilterFields<TSchema, M>;
  /** Map of identifier → virtual filter config. The Record key becomes the filter's identifier. */
  virtual?: Record<string, AnyVirtualFilterConfig<TSchema, M>>;
}

interface AnyModelFilterConfig {
  key?: string;
  fields?: Record<string, FieldOverride | true | undefined>;
  virtual?: Record<string, unknown>;
}

export interface FilterRegistry {
  /** Registers a config under a unique key. */
  register: (table: string, name: string, config: AnyModelFilterConfig) => void;
  get: (name: string) => { table: string; config: AnyModelFilterConfig } | undefined;
  /** True when a set is already registered under `name`. */
  has: (name: string) => boolean;
}

export function createRegistry(): FilterRegistry {
  const store = new Map<string, { table: string; config: AnyModelFilterConfig }>();
  return {
    register: (table, name, config) => {
      store.set(name, { table, config });
    },
    get: name => store.get(name),
    has: name => store.has(name),
  };
}
