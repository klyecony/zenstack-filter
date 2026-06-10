"use client";

import { useCallback, useMemo } from "react";
import type { FilterOption, FilterOptionsAsyncSource, ScalarValue } from "./types.ts";

/**
 * Subset of a TanStack-Query infinite-query result that this adapter consumes.
 * Structurally compatible with `useInfiniteQuery` and ZenStack's
 * `useInfiniteFindMany` return shape.
 *
 * `fetchNextPage` is typed loosely (returns `unknown`) because callers wire
 * this from libraries with diverse return shapes (TanStack returns a Promise);
 * the adapter never reads the return value.
 */
export interface InfiniteQueryResult<TItem> {
  data: { pages: TItem[][] } | undefined;
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  fetchNextPage: () => unknown;
}

interface CreateInfiniteSearchArgs<TItem> {
  /** Hook driving the infinite query for a given search term. */
  useInfiniteQuery: (query: string) => InfiniteQueryResult<TItem>;
  /** Maps one raw page item to a FilterOption. Keep the reference stable. */
  mapItem: (item: TItem) => FilterOption;
}

/**
 * Adapter: turns an infinite-query hook into the `useSearch` function expected
 * by `FilterOptionsAsyncSource`. Caller owns the query (where clause, cursor
 * strategy, page size); this flattens pages and wires `hasMore` / `fetchNext`
 * so the dropdown can drive infinite scroll.
 */
export function createInfiniteSearch<TItem>({
  useInfiniteQuery,
  mapItem,
}: CreateInfiniteSearchArgs<TItem>): FilterOptionsAsyncSource["useSearch"] {
  return (query: string) => {
    const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
      useInfiniteQuery(query);

    const options = useMemo(() => data?.pages.flat().map(mapItem) ?? [], [data, mapItem]);

    const fetchNext = useCallback(() => {
      if (hasNextPage && !isFetchingNextPage) fetchNextPage();
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    return {
      options,
      loading: isLoading,
      loadingMore: isFetchingNextPage,
      hasMore: hasNextPage,
      fetchNext,
    };
  };
}

/**
 * `useResolve` implementation for sources where the picked value is its own
 * label (e.g. distinct string lookups). No round-trip needed — values map
 * straight to `{ value, label }` pairs.
 */
export function useIdentityResolve(values: ScalarValue[]): {
  resolved: FilterOption[];
  loading: boolean;
} {
  const resolved = useMemo(
    () =>
      values.filter((v): v is string => typeof v === "string").map(v => ({ value: v, label: v })),
    [values],
  );
  return { resolved, loading: false };
}
