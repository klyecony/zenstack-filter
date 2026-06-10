import { defaultOperatorFor, operatorLabel, operatorsFor, withLabels } from "./operators.ts";
import type { FieldOverride, FilterRegistry } from "./registry.ts";
import { humanize } from "./schema.ts";
import type {
  AnySchema,
  FieldDef,
  FilterDef,
  FilterOperator,
  FilterOperatorDef,
  FilterOption,
  FilterOptions,
  FilterSet,
  FilterValue,
  ModelName,
  SchemaHelpers,
  VirtualFilterConfig,
} from "./types.ts";

/** Top-level: every available FilterDef for a registered set. */
export function generateFilterDefs<TSchema extends AnySchema, M extends ModelName<TSchema>>(
  set: FilterSet<TSchema, M>,
): FilterDef[] {
  return set.__system.generator.generateFilterDefsForSet(set.name);
}

/** Top-level: lookup a single FilterDef by identifier. */
export function findFilterDef<TSchema extends AnySchema, M extends ModelName<TSchema>>(
  set: FilterSet<TSchema, M>,
  identifier: string,
): FilterDef | undefined {
  return set.__system.generator.findFilterDefForSet(set.name, identifier);
}

interface GenerateContext {
  helpers: SchemaHelpers;
  registry: FilterRegistry;
}

interface ResolvedPath {
  field: FieldDef;
  fieldName: string;
  path: string[];
}

function resolveDotted(
  helpers: SchemaHelpers,
  rootModel: string,
  dotted: string,
): ResolvedPath | null {
  if (!dotted.includes(".")) {
    const f = helpers.getField(rootModel, dotted);
    return f ? { field: f, fieldName: dotted, path: [] } : null;
  }
  const segments = dotted.split(".");
  const fieldName = segments.at(-1);
  if (!fieldName) return null;
  const path = segments.slice(0, -1);

  let current = rootModel;
  for (const seg of path) {
    const next = helpers.getRelationModel(current, seg);
    if (!next || !helpers.hasModel(next)) return null;
    current = next;
  }

  const f = helpers.getField(current, fieldName);
  return f ? { field: f, fieldName, path } : null;
}

function resolveOptions(
  helpers: SchemaHelpers,
  fieldType: string,
  override: FieldOverride | undefined,
): FilterOptions | undefined {
  if (override?.options) return override.options;
  if (helpers.isEnum(fieldType)) {
    const values = helpers.getEnumValues(fieldType);
    return values.map<FilterOption>(v => ({ value: v, label: v }));
  }
  return undefined;
}

function virtualFilterToDef(identifier: string, raw: unknown): FilterDef {
  // biome-ignore lint/suspicious/noExplicitAny: storage erases generics; runtime shape matches VirtualFilterConfig
  const vf = raw as VirtualFilterConfig<any, any>;
  const operatorEntries: FilterOperatorDef[] = [];

  if (vf.operators) {
    for (const [op, fn] of Object.entries(vf.operators) as [
      FilterOperator,
      ((value: FilterValue) => Record<string, unknown>) | undefined,
    ][]) {
      if (!fn) continue;
      operatorEntries.push({
        value: op,
        label: operatorLabel(op),
        apply: (_in, v) => fn(v),
      });
    }
  }

  if (vf.where) {
    const op = vf.defaultOperator ?? defaultOperatorFor(vf.type);
    const where = vf.where as (value: FilterValue) => Record<string, unknown>;
    operatorEntries.push({
      value: op,
      label: operatorLabel(op),
      apply: (_in, v) => where(v),
    });
  }

  const operators =
    operatorEntries.length > 0 ? operatorEntries : withLabels(operatorsFor(vf.type));

  const defaultOperator =
    vf.defaultOperator ?? operatorEntries[0]?.value ?? defaultOperatorFor(vf.type);

  // Spread vf so any FilterMeta keys (icon, group, …) flow through.
  return {
    ...vf,
    identifier,
    table: "",
    field: "",
    type: vf.type,
    label: vf.label,
    options: vf.options,
    operators,
    defaultOperator,
  } as FilterDef;
}

export function createGenerator<TSchema extends AnySchema>(ctx: GenerateContext) {
  const { helpers, registry } = ctx;

  function generateFilterDefsForSet(setName: string): FilterDef[] {
    const entry = registry.get(setName);
    if (!entry) return [];
    const { table, config } = entry;

    if (!helpers.hasModel(table)) return [];

    const fromFields: FilterDef[] = [];

    const fieldsCfg = config.fields ?? {};
    for (const dottedKey of Object.keys(fieldsCfg)) {
      const raw = fieldsCfg[dottedKey];
      if (raw === undefined) continue;
      const override: FieldOverride | undefined = raw === true ? undefined : raw;

      const resolved = resolveDotted(helpers, table, dottedKey);
      if (!resolved) continue;

      const type = override?.type ?? helpers.defaultTypeFor(resolved.field);
      const operators = override?.operators ?? operatorsFor(type);
      const defaultOperator = override?.defaultOperator ?? defaultOperatorFor(type);

      // Spread override first so FilterMeta keys flow through; then known props.
      const def: FilterDef = {
        ...(override ?? {}),
        identifier: dottedKey,
        table,
        field: resolved.fieldName,
        path: override?.path ?? (resolved.path.length > 0 ? resolved.path : undefined),
        type,
        label: override?.label ?? humanize(resolved.fieldName),
        options: resolveOptions(helpers, resolved.field.type, override),
        operators: withLabels(operators),
        defaultOperator,
      };
      fromFields.push(def);
    }

    const virtual: FilterDef[] = [];
    const virtualCfg = config.virtual ?? {};
    for (const [identifier, vf] of Object.entries(virtualCfg)) {
      virtual.push({ ...virtualFilterToDef(identifier, vf), table });
    }

    return [...fromFields, ...virtual];
  }

  function findFilterDefForSet(setName: string, identifier: string): FilterDef | undefined {
    return generateFilterDefsForSet(setName).find(d => d.identifier === identifier);
  }

  return { generateFilterDefsForSet, findFilterDefForSet };
}
