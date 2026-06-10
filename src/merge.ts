import type { ActiveFilter, FilterDef, SchemaHelpers } from "./types.ts";

interface MergeContext {
  helpers: SchemaHelpers;
  findFilterDef: (identifier: string) => FilterDef | undefined;
}

export function createMerger(ctx: MergeContext) {
  const { helpers, findFilterDef } = ctx;

  function findDef(filter: ActiveFilter, available?: FilterDef[]): FilterDef | null {
    if (!helpers.hasModel(filter.table)) return null;
    const def =
      available?.find(d => d.identifier === filter.identifier && d.table === filter.table) ??
      findFilterDef(filter.identifier);
    return def ?? null;
  }

  return { findDef };
}
