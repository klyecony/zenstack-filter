import { dateOnlyToIso } from "./dates.ts";
import type { DateRange, FilterOperator, FilterOperatorDef, FilterType } from "./types.ts";

type RawValue = unknown;

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equal: "is",
  notEqual: "is not",
  greater: "greater than",
  less: "less than",
  contains: "contains",
  notContains: "does not contain",
  onDate: "on",
};

export function operatorLabel(op: FilterOperator): string {
  return OPERATOR_LABELS[op];
}

function toDate(v: RawValue): Date {
  if (v instanceof Date) return v;
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  return new Date(Number.NaN);
}

function startOfDayIso(v: RawValue): string {
  const d = toDate(v);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function nextDayIso(v: RawValue): string {
  const d = toDate(v);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
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

const date: FilterOperatorDef[] = [
  {
    value: "onDate",
    apply: (_input, v, f) => ({
      AND: [{ [f]: { gte: startOfDayIso(v) } }, { [f]: { lt: nextDayIso(v) } }],
    }),
  },
  { value: "greater", apply: (_input, v, f) => ({ [f]: { gte: toDate(v).toISOString() } }) },
  { value: "less", apply: (_input, v, f) => ({ [f]: { lte: toDate(v).toISOString() } }) },
];

const dateRange: FilterOperatorDef[] = [
  {
    value: "equal",
    apply: (_input, v, f) => {
      const r = asDateRange(v);
      if (!r) return {};
      // Expand date-only strings to full ISO datetimes (start-of-day for gte,
      // end-of-day for lte) so Prisma/ZenStack DateTime validation accepts the
      // values and the `lte` bound includes the entire end day.
      return { [f]: { gte: dateOnlyToIso(r.gte, "start"), lte: dateOnlyToIso(r.lte, "end") } };
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
  date: "onDate",
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
