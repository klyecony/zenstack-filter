/**
 * Convert a `YYYY-MM-DD` (date-only) string to a full ISO datetime string.
 * `start` anchors to `00:00:00.000Z`; `end` to `23:59:59.999Z` — so an `lte`
 * comparison includes the entire selected end day rather than cutting it off
 * at midnight.
 *
 * Useful for translating between date-only UI pickers and DateTime-typed
 * database columns / Prisma validation.
 */
export function dateOnlyToIso(yyyyMmDd: string, anchor: "start" | "end"): string {
  const day = yyyyMmDd.slice(0, 10);
  return `${day}T${anchor === "start" ? "00:00:00.000" : "23:59:59.999"}Z`;
}
