import { createGenerator } from "./generate.ts";
import { createRegistry, type ModelFilterConfig } from "./registry.ts";
import { createSchemaHelpers } from "./schema.ts";
import type {
  AnySchema,
  FilterModelName,
  FilterSet,
  FilterSystemInternals,
  ModelName,
} from "./types.ts";

export interface CreateFilterSystemConfig<
  TSchema extends AnySchema,
  TFilterModel extends ModelName<TSchema> = FilterModelName & ModelName<TSchema>,
> {
  schema: TSchema;
  /**
   * Name of the persistence model that `useFilter`/`useFilterViews` read and
   * write. Defaults to `Filter`. Set this to type `scope` against a renamed
   * model (e.g. one scaffolded by `zenstack-filter/plugin` with a custom
   * `filterModel`).
   */
  filterModel?: TFilterModel;
}

/**
 * Model-keyed filter-set factory: `filterFactory.Invoice(config)`.
 *
 * Keying on the model (instead of `filterFactory(model, config)`) binds the
 * concrete `M` *before* the config is checked. That matters for `virtual` filters:
 * their values are the `AnyVirtualFilterConfig` union discriminated on `type`, and
 * TS only narrows an object literal to a single member (so each `where`'s value is
 * typed by that entry's `type`) when the target is concrete. In a single
 * `(model, config)` call `M` is still being inferred while the config is checked,
 * so the union stays generic and `where`'s parameter collapses to every
 * `ValueForType`. With `M` fixed by the property access, the config is checked
 * against a concrete union and every `where` is typed precisely.
 */
export type FilterFactory<
  TSchema extends AnySchema,
  TFilterModel extends ModelName<TSchema> = FilterModelName & ModelName<TSchema>,
> = {
  [M in ModelName<TSchema>]: (
    config: ModelFilterConfig<TSchema, M>,
  ) => FilterSet<TSchema, M, TFilterModel>;
};

export interface FilterSystem<
  TSchema extends AnySchema,
  TFilterModel extends ModelName<TSchema> = FilterModelName & ModelName<TSchema>,
> {
  filterFactory: FilterFactory<TSchema, TFilterModel>;
}

export function createFilterSystem<
  TSchema extends AnySchema,
  TFilterModel extends ModelName<TSchema> = FilterModelName & ModelName<TSchema>,
>(config: CreateFilterSystemConfig<TSchema, TFilterModel>): FilterSystem<TSchema, TFilterModel> {
  const { schema } = config;

  const helpers = createSchemaHelpers(schema);
  const registry = createRegistry();
  const { generateFilterDefsForSet, findFilterDefForSet } = createGenerator<TSchema>({
    helpers,
    registry,
  });

  const internals: FilterSystemInternals = {
    helpers,
    generator: { generateFilterDefsForSet, findFilterDefForSet },
    hasSet: key => registry.has(key),
  };

  function defineSet<M extends ModelName<TSchema>>(
    model: M,
    cfg: ModelFilterConfig<TSchema, M>,
  ): FilterSet<TSchema, M, TFilterModel> {
    // Stable key: explicit `key`, else the model name. It is persisted as the
    // `filterSet` column, so it must be unique across sets — two sets on the
    // same model (e.g. an archive view and a timeline) must each pass a `key`.
    const setName = cfg.key ?? model;
    if (registry.has(setName)) {
      throw new Error(
        `Filter set key "${setName}" is already registered (model "${model}"). ` +
          `Pass a unique \`key\` to filterFactory.${model}({ key: "…", … }).`,
      );
    }
    registry.register(model, setName, cfg);
    return { __filterSet: true, table: model, name: setName, __system: internals };
  }

  const filterFactory = new Proxy({} as FilterFactory<TSchema, TFilterModel>, {
    get(_target, model) {
      if (typeof model !== "string") return undefined;
      return (cfg: ModelFilterConfig<TSchema, ModelName<TSchema>>) =>
        defineSet(model as ModelName<TSchema>, cfg);
    },
  });

  return { filterFactory };
}
