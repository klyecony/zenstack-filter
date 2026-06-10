"use client";

import { useCallback, useMemo } from "react";
import type {
  AnySchema,
  FilterPersistenceClient,
  FilterScope,
  FilterSet,
  FilterViewPersistenceClient,
  ModelName,
  PersistedFilterViewRow,
} from "./types.ts";

export interface UseFilterViewsOptions<TSchema extends AnySchema> {
  /** ZenStack persistence client for the `FilterView` model. Reference must be stable. */
  viewClient: FilterViewPersistenceClient;
  /** ZenStack persistence client for the `Filter` model — same instance `useFilter` uses, so the caches align. */
  filterClient: FilterPersistenceClient;
  /** Owner scope (userId/organizationId). Same value passed to `useFilter`. */
  scope?: FilterScope<TSchema>;
  /** The currently-open view id (e.g. from the route), or null for the working state. */
  activeViewId?: string | null;
  /** Gates DB access. When false queries are disabled and mutations no-op. Default: true. */
  enabled?: boolean;
}

export interface UseFilterViewsReturn {
  /** Saved views for this set, for a picker. */
  views: PersistedFilterViewRow[];
  /** The currently-open view, or null. */
  activeView: PersistedFilterViewRow | null;
  /** Snapshot the currently-shown bucket's filters into a new view; returns it. */
  saveAsNewView: (name: string) => Promise<PersistedFilterViewRow | undefined>;
  /** Rename a view (metadata only — its filter rows are untouched). */
  renameView: (view: PersistedFilterViewRow, name: string) => Promise<void>;
  /** Delete a view (its filter rows cascade; the working state is untouched). */
  deleteView: (view: PersistedFilterViewRow) => Promise<void>;
}

/**
 * Saved-view layer alongside `useFilter`. Views are normalized: a view's filters
 * are `Filter` rows carrying its `viewId`; the working state is the rows with
 * `viewId = null`. An open view is read/written live by `useFilter` (scoped to
 * its `viewId`) — there is no copy into the working state. This hook only lists
 * views and snapshots/renames/deletes them.
 */
export function useFilterViews<TSchema extends AnySchema, M extends ModelName<TSchema>>(
  set: FilterSet<TSchema, M>,
  opts: UseFilterViewsOptions<TSchema>,
): UseFilterViewsReturn {
  const { viewClient, filterClient, scope = {}, activeViewId = null, enabled = true } = opts;
  const filterSet = set.name;

  const viewsResult = viewClient.useFindMany({ where: { ...scope, filterSet } }, { enabled });
  // Rows of the currently-shown bucket — used to snapshot on "save as new view".
  const activeRowsResult = filterClient.useFindMany(
    { where: { ...scope, filterSet, viewId: activeViewId } },
    { enabled },
  );

  const views = useMemo(() => viewsResult.data ?? [], [viewsResult.data]);
  const activeRows = useMemo(() => activeRowsResult.data ?? [], [activeRowsResult.data]);
  const activeView = useMemo(
    () => views.find(v => v.id === activeViewId) ?? null,
    [views, activeViewId],
  );

  const filterCreate = filterClient.useCreate();
  const viewCreate = viewClient.useCreate();
  const viewUpdate = viewClient.useUpdate();
  const viewDelete = viewClient.useDelete();

  const saveAsNewView = useCallback(
    async (name: string) => {
      if (!enabled) return undefined;
      // Library boundary: the generated create returns a projection union; we
      // only consume the new row's id.
      const created = (await viewCreate.mutateAsync({
        data: { ...scope, filterSet, name },
      })) as { id: string };
      await Promise.all(
        activeRows.map(r =>
          filterCreate.mutateAsync({
            data: {
              ...scope,
              filterSet,
              viewId: created.id,
              identifier: r.identifier,
              operator: r.operator,
              value: r.value,
            },
          }),
        ),
      );
      return { id: created.id, name, filterSet };
    },
    [enabled, viewCreate, filterCreate, activeRows, scope, filterSet],
  );

  const renameView = useCallback(
    async (view: PersistedFilterViewRow, name: string) => {
      if (!enabled) return;
      await viewUpdate.mutateAsync({ where: { id: view.id }, data: { name } });
    },
    [enabled, viewUpdate],
  );

  const deleteView = useCallback(
    async (view: PersistedFilterViewRow) => {
      if (!enabled) return;
      await viewDelete.mutateAsync({ where: { id: view.id } });
    },
    [enabled, viewDelete],
  );

  return { views, activeView, saveAsNewView, renameView, deleteView };
}
