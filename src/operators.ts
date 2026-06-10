import type { DateRange, FilterOperator, FilterOperatorDef, FilterType } from "./types.ts";

type RawValue = unknown;

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equal: "is",
  notEqual: "is not",
  greater: "greater than",
  less: "less than",
  contains: "contains",
  notContains: "does not contain",
};

export function operatorLabel(op: FilterOperator): string {
  return OPERATOR_LABELS[op];
}

function asDateRange(v: RawValue): DateRange | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const r = v as Partial<DateRange>;
  if (typeof r.gte !== "string" || typeof r.lte !== "string") return null;
  return { gte: r.gte, lte: r.lte };
}

function asStringArray(v: RawValue): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    if (typeof item === "string") out.push(item);
  }
  return out;
}

const text: FilterOperatorDef[] = [
  {
    value: "equal",
    apply: (_input, v, f) => ({ [f]: { equals: String(v ?? ""), mode: "insensitive" } }),
  },
  {
    value: "notEqual",
    apply: (_input, v, f) => ({
      NOT: { [f]: { equals: String(v ?? ""), mode: "insensitive" } },
    }),
  },
  {
    value: "contains",
    apply: (_input, v, f) => ({ [f]: { contains: String(v ?? ""), mode: "insensitive" } }),
  },
  {
    value: "notContains",
    apply: (_input, v, f) => ({
      NOT: { [f]: { contains: String(v ?? ""), mode: "insensitive" } },
    }),
  },
];

const number: FilterOperatorDef[] = [
  { value: "equal", apply: (_input, v, f) => ({ [f]: { equals: Number(v) } }) },
  { value: "notEqual", apply: (_input, v, f) => ({ NOT: { [f]: { equals: Number(v) } } }) },
  { value: "greater", apply: (_input, v, f) => ({ [f]: { gt: Number(v) } }) },
  { value: "less", apply: (_input, v, f) => ({ [f]: { lt: Number(v) } }) },
];

// Date values are passed through to Prisma untouched — the caller decides the
// format (full ISO `…Z`, a date-only `YYYY-MM-DD`, a zoned offset, …). Note a
// date-only `less`/`lte` bound compares against midnight and so excludes the
// rest of that day; pass an end-of-day or exclusive next-day bound if you want
// the whole day included.
const date: FilterOperatorDef[] = [
  { value: "equal", apply: (_input, v, f) => ({ [f]: { equals: v as RawValue } }) },
  { value: "greater", apply: (_input, v, f) => ({ [f]: { gt: v as RawValue } }) },
  { value: "less", apply: (_input, v, f) => ({ [f]: { lt: v as RawValue } }) },
];

// Range bounds are passed through as-is — same formatting contract as `date`.
const dateRange: FilterOperatorDef[] = [
  {
    value: "equal",
    apply: (_input, v, f) => {
      const r = asDateRange(v);
      if (!r) return {};
      return { [f]: { gte: r.gte, lte: r.lte } };
    },
  },
];

const select: FilterOperatorDef[] = [
  { value: "equal", apply: (_input, v, f) => ({ [f]: { equals: v as RawValue } }) },
  { value: "notEqual", apply: (_input, v, f) => ({ NOT: { [f]: { equals: v as RawValue } } }) },
];

const multiselect: FilterOperatorDef[] = [
  {
    value: "contains",
    apply: (_input, v, f) => ({ [f]: { in: asStringArray(v) } }),
  },
  {
    value: "notContains",
    apply: (_input, v, f) => ({ NOT: { [f]: { in: asStringArray(v) } } }),
  },
];

// `choice` filters are virtual — their real query comes from the config's
// `where`. This fallback only matches the picked key against a field and exists
// so the type→operator lookups resolve instead of returning undefined.
const choice: FilterOperatorDef[] = [
  {
    value: "equal",
    apply: (_input, v, f) => {
      const key = (v as { key?: unknown } | null)?.key;
      return typeof key === "string" ? { [f]: { equals: key } } : {};
    },
  },
];

export const operatorsByType: Record<FilterType, FilterOperatorDef[]> = {
  text,
  number,
  date,
  dateRange,
  select,
  multiselect,
  choice,
};

export const defaultOperatorByType: Record<FilterType, FilterOperator> = {
  text: "contains",
  number: "equal",
  date: "equal",
  dateRange: "equal",
  select: "equal",
  multiselect: "contains",
  choice: "equal",
};

export function operatorsFor(type: FilterType): FilterOperatorDef[] {
  return operatorsByType[type];
}

export function defaultOperatorFor(type: FilterType): FilterOperator {
  return defaultOperatorByType[type];
}

export function findOperator(
  ops: FilterOperatorDef[],
  op: FilterOperator,
): FilterOperatorDef | undefined {
  return ops.find(o => o.value === op);
}

export function withLabels(ops: FilterOperatorDef[]): FilterOperatorDef[] {
  return ops.map(o => ({ ...o, label: o.label ?? operatorLabel(o.value) }));
}
