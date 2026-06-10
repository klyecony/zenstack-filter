import { findOperator } from "./operators.ts";
import type {
  ActiveFilter,
  AnySchema,
  FilterDef,
  FilterSet,
  ModelName,
  SchemaHelpers,
  WhereInput,
} from "./types.ts";

function resolveModelAt(
  helpers: SchemaHelpers,
  rootModel: string,
  segments: string[],
): string | undefined {
  let model: string | undefined = rootModel;
  for (const segment of segments) {
    if (!model) return undefined;
    const next = helpers.getRelationModel(model, segment);
    if (!next || !helpers.hasModel(next)) return undefined;
    model = next;
  }
  return model;
}

function wrapPath(
  helpers: SchemaHelpers,
  condition: WhereInput,
  path: string[],
  rootModel: string,
): WhereInput {
  if (path.length === 0) return condition;

  let wrapped: WhereInput = condition;

  for (let i = path.length - 1; i >= 0; i--) {
    const segment = path[i];
    if (segment === undefined) continue;
    const parentSegments = path.slice(0, i);
    const parentModel = resolveModelAt(helpers, rootModel, parentSegments);
    const kind = parentModel ? helpers.relationKind(parentModel, segment) : undefined;
    const isMany = kind === "many";
    wrapped = { [segment]: isMany ? { some: wrapped } : { is: wrapped } };
  }

  return wrapped;
}

/**
 * Top-level builder — takes a `FilterSet` handle and the active filters and
 * produces a Prisma-style where input. Reads the system internals off the set,
 * so no filter-system reference is needed.
 */
export function buildWhere<TSchema extends AnySchema, M extends ModelName<TSchema>>(
  set: FilterSet<TSchema, M>,
  active: ActiveFilter[],
): WhereInput {
  const { helpers, generator } = set.__system;
  return buildWhereInternal(
    active,
    set.table as string,
    id => generator.findFilterDefForSet(set.name, id),
    helpers,
  );
}

/**
 * Internal: pure builder used by both the top-level `buildWhere(set, active)`
 * and the `useFilter` hook (which already holds `helpers`).
 */
export function buildWhereInternal(
  active: ActiveFilter[],
  _table: string,
  findDef: (identifier: string) => FilterDef | undefined,
  helpers: SchemaHelpers,
): WhereInput {
  const conditions: WhereInput[] = [];

  for (const filter of active) {
    if (!helpers.hasModel(filter.table)) continue;
    const def = findDef(filter.identifier);
    if (!def) continue;

    const op = findOperator(def.operators, filter.operator) ?? def.operators[0];
    if (!op) continue;

    let condition = op.apply({}, filter.value, def.field);
    if (def.path && def.path.length > 0) {
      condition = wrapPath(helpers, condition, def.path, def.table);
    }
    conditions.push(condition);
  }

  if (conditions.length === 0) return {};
  const [first] = conditions;
  if (conditions.length === 1 && first) return first;
  return { AND: conditions };
}
