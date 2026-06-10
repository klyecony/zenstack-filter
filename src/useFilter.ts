"use client";

import { useCallback, useMemo, useState } from "react";
import { buildWhereInternal } from "./build.ts";
import type {
  ActiveFilter,
  AnySchema,
  FilterDef,
  FilterModelName,
  FilterPersistenceClient,
  FilterScope,
  FilterSet,
  ModelName,
  UseFilterControl,
  UseFilterReturn,
  WhereInput,
} from "./types.ts";

export interface UseFilterOptions<
  TSchema extends AnySchema,
  TFilterModel extends ModelName<TSchema> = FilterModelName & ModelName<TSchema>,
> {
  /** Required ZenStack persistence client for the Filter model. Reference must be stable. */
  client: FilterPersistenceClient;

  /** Gates DB persistence. When false: queries are disabled, mutations no-op. Default: true. */
  enabled?: boolean;

  /** Strongly-typed scope for the persisted Filter records — derived from the persistence model. */
  scope?: FilterScope<TSchema, TFilterModel>;

  /**
   * Which filter bucket this hook reads/writes. `null` (default) is the editable
   * working state; a `FilterView` id targets that view's rows directly, so an
   * open view is shown and edited live — no copying into the working state.
   */
  viewId?: string | null;

  /** Optional visibility predicate for the create-filter palette. */
  filterAvailable?: (def: FilterDef) => boolean;
}

/**
 * Top-level hook — accepts a `FilterSet` handle (returned by
 * `filterFactory`) and an options object. Reads the system internals from
 * the set, so no filter-system reference is passed.
 */
export function useFilter<
  TSchema extends AnySchema,
  M extends ModelName<TSchema>,
  TFilterModel extends ModelName<TSchema> = FilterModelName & ModelName<TSchema>,
>(
  set: FilterSet<TSchema, M, TFilterModel>,
  opts: UseFilterOptions<TSchema, TFilterModel>,
): UseFilterReturn {
  const { helpers, generator, hasSet } = set.__system;
  const { generateFilterDefsForSet, findFilterDefForSet } = generator;

  const { client, enabled = true, scope = {}, viewId = null, filterAvailable } = opts;

  // `table` is the MODEL (relation resolution); `setKey` is the stable set key
  // persisted in the `filterSet` column. `viewId` selects the bucket: null =
  // working state, a view id = that view's live rows.
  const table = set.table as string;
  const setKey = set.name;

  const [hasErrors, setHasErrors] = useState(false);

  const availableFilters = useMemo<FilterDef[]>(() => {
    let defs = generateFilterDefsForSet(setKey);
    if (filterAvailable) defs = defs.filter(filterAvailable);
    return defs;
  }, [setKey, filterAvailable, generateFilterDefsForSet]);

  const findManyResult = client.useFindMany(
    { where: { ...scope, filterSet: setKey, viewId } },
    { enabled },
  );

  const create = client.useCreate();
  const update = client.useUpdate();
  const remove = client.useDelete();
  const removeMany = client.useDeleteMany();

  const dbFilters = useMemo<ActiveFilter[]>(() => {
    const rows = findManyResult.data ?? [];
    const out: ActiveFilter[] = [];
    for (const r of rows) {
      if (!hasSet(r.filterSet)) continue;
      out.push({
        identifier: r.identifier,
        // ActiveFilter.table is the MODEL (for relation paths), from the set —
        // the persisted row only carries the `filterSet` key.
        table,
        operator: r.operator as ActiveFilter["operator"],
        value: r.value as ActiveFilter["value"],
      });
    }
    return out;
  }, [findManyResult.data, hasSet, table]);

  const activeFilters = useMemo<ActiveFilter[]>(() => {
    const merged: ActiveFilter[] = [];
    for (const f of dbFilters) {
      const def = findFilterDefForSet(setKey, f.identifier);
      if (!def) continue;
      merged.push(f);
    }
    return merged;
  }, [dbFilters, setKey, findFilterDefForSet]);

  const where = useMemo<WhereInput>(
    () => buildWhereInternal(activeFilters, table, id => findFilterDefForSet(setKey, id), helpers),
    [activeFilters, table, setKey, helpers, findFilterDefForSet],
  );

  const findExistingId = useCallback(
    (filter: ActiveFilter): string | undefined => {
      // Query is already scoped to (filterSet, viewId), so the identifier alone
      // uniquely identifies the row in this bucket.
      const rows = findManyResult.data ?? [];
      return rows.find(r => r.identifier === filter.identifier)?.id;
    },
    [findManyResult.data],
  );

  const applyFilter = useCallback<UseFilterControl["applyFilter"]>(
    async filter => {
      try {
        if (filter.disabled) return;
        if (!enabled) return;

        const existingId = findExistingId(filter);
        if (existingId) {
          await update.mutateAsync({
            where: { id: existingId },
            data: { operator: filter.operator, value: filter.value },
          });
        } else {
          await create.mutateAsync({
            data: {
              ...scope,
              filterSet: setKey,
              viewId,
              identifier: filter.identifier,
              operator: filter.operator,
              value: filter.value,
            },
          });
        }
        setHasErrors(false);
      } catch (_err) {
        setHasErrors(true);
      }
    },
    [enabled, create, update, findExistingId, scope, setKey, viewId],
  );

  const removeFilter = useCallback<UseFilterControl["removeFilter"]>(
    async filter => {
      try {
        if (filter.disabled || filter.disabledToRemove) return;
        if (!enabled) return;

        const existingId = findExistingId(filter);
        if (!existingId) return;
        await remove.mutateAsync({ where: { id: existingId } });
        setHasErrors(false);
      } catch (_err) {
        setHasErrors(true);
      }
    },
    [enabled, remove, findExistingId],
  );

  const clearFilters = useCallback<UseFilterControl["clearFilters"]>(async () => {
    try {
      if (!enabled) return;
      await removeMany.mutateAsync({ where: { ...scope, filterSet: setKey, viewId } });
      setHasErrors(false);
    } catch (_err) {
      setHasErrors(true);
    }
  }, [enabled, removeMany, scope, setKey, viewId]);

  return {
    where,
    control: {
      availableFilters,
      activeFilters,
      applyFilter,
      removeFilter,
      clearFilters,
      hasErrors,
      table,
    },
  };
}
