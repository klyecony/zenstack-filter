import { z } from "zod";
import type { ActiveFilter, FilterType, FilterValue } from "./types.ts";

const dateRangeSchema = z
  .object({
    gte: z.string().refine(s => !Number.isNaN(Date.parse(s)), { message: "gte: ungültiges Datum" }),
    lte: z.string().refine(s => !Number.isNaN(Date.parse(s)), { message: "lte: ungültiges Datum" }),
  })
  .refine(r => Date.parse(r.gte) <= Date.parse(r.lte), { message: "gte muss <= lte sein" });

const isoDateSchema = z
  .string()
  .refine(s => !Number.isNaN(Date.parse(s)), { message: "ungültiges Datum" });

const valueSchemaByType: Record<FilterType, z.ZodTypeAny> = {
  text: z.string().min(1),
  number: z.coerce.number().refine(n => !Number.isNaN(n), { message: "keine Zahl" }),
  select: z.union([z.string(), z.number(), z.boolean()]),
  multiselect: z.array(z.string()).min(1),
  date: isoDateSchema,
  dateRange: dateRangeSchema,
  choice: z.object({ key: z.string().min(1), value: z.unknown().optional() }),
};

export function validateValue(
  type: FilterType,
  value: FilterValue,
): { ok: true; value: FilterValue } | { ok: false; error: string } {
  const schema = valueSchemaByType[type];
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map(i => i.message).join(", ") };
  }
  return { ok: true, value: parsed.data as FilterValue };
}

export function isValueComplete(type: FilterType, value: FilterValue): boolean {
  return validateValue(type, value).ok;
}

export function validateActiveFilter(
  filter: ActiveFilter,
  type: FilterType,
): { ok: true; filter: ActiveFilter } | { ok: false; error: string } {
  const valueResult = validateValue(type, filter.value);
  if (!valueResult.ok) return { ok: false, error: valueResult.error };
  return { ok: true, filter: { ...filter, value: valueResult.value } };
}
