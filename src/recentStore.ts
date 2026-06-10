import type { FilterValue } from "./types.ts";

const MAX_RECENTS = 5;

const store = new Map<string, FilterValue[]>();

function isEmpty(v: FilterValue): boolean {
  if (v === null || v === undefined || v === "") return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

export function getRecents(identifier: string): FilterValue[] {
  return store.get(identifier) ?? [];
}

export function pushRecent(identifier: string, value: FilterValue): void {
  if (isEmpty(value)) return;
  const current = store.get(identifier) ?? [];
  const key = JSON.stringify(value);
  const filtered = current.filter(v => JSON.stringify(v) !== key);
  store.set(identifier, [value, ...filtered].slice(0, MAX_RECENTS));
}

export function clearRecents(identifier: string): void {
  store.delete(identifier);
}
