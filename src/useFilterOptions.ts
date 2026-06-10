"use client";

import { useEffect, useState } from "react";
import type { FilterDef, FilterOption, FilterOptionsLoader } from "./types.ts";

const noopLoader: FilterOptionsLoader = () => ({ options: [], loading: false });

export interface ResolvedOptions {
  options: FilterOption[];
  loading: boolean;
}

/**
 * Resolves a filter definition's `options` field for the static / loader case.
 * For `FilterOptionsAsyncSource`, the caller must dispatch to the source's
 * `useSearch` / `useResolve` hooks directly — this hook does NOT support that
 * shape (Rules of Hooks: a single hook can't conditionally call user-provided
 * hooks of unknown shape).
 *
 *   - static array → returned as-is, `loading: false`
 *   - undefined → empty, `loading: false`
 *   - loader hook → invoked unconditionally to keep hook order stable
 *   - async source → empty (caller must dispatch separately)
 */
export function useFilterOptions(def: FilterDef): ResolvedOptions {
  const isLoader = typeof def.options === "function";
  const loader = isLoader ? (def.options as FilterOptionsLoader) : noopLoader;
  const loaderResult = loader();

  if (Array.isArray(def.options)) {
    return { options: def.options, loading: false };
  }
  if (isLoader) {
    return {
      options: loaderResult.options,
      loading: Boolean(loaderResult.loading),
    };
  }
  return { options: [], loading: false };
}

/** Synchronous label lookup against an already-resolved option list. */
export function findOptionLabel(options: FilterOption[], raw: unknown): string | undefined {
  return options.find(o => String(o.value) === String(raw))?.label;
}

/** Standard debounced state — useful for typeahead queries on async sources. */
export function useDebouncedValue<T>(value: T, delayMs = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}
