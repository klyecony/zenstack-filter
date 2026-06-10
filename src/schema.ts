import type { AnySchema, FieldDef, FilterType, SchemaHelpers } from "./types.ts";

const PRIMITIVE_TYPES = new Set([
  "String",
  "Int",
  "BigInt",
  "Float",
  "Decimal",
  "Boolean",
  "DateTime",
  "Json",
  "Bytes",
]);

interface SchemaModel {
  fields: Record<string, FieldDef>;
}

interface SchemaShape {
  models: Record<string, SchemaModel>;
  enums?: Record<string, { values: Record<string, string> }>;
}

export function createSchemaHelpers<TSchema extends AnySchema>(schema: TSchema): SchemaHelpers {
  const s = schema as unknown as SchemaShape;

  function getModel(model: string): SchemaModel | undefined {
    return s.models[model];
  }

  function hasModel(model: string): boolean {
    return getModel(model) !== undefined;
  }

  function getField(model: string, field: string): FieldDef | undefined {
    return getModel(model)?.fields[field];
  }

  function getFields(model: string): FieldDef[] {
    const m = getModel(model);
    return m ? Object.values(m.fields) : [];
  }

  function isRelation(field: FieldDef): boolean {
    return field.relation !== undefined;
  }

  function isEnum(typeName: string): boolean {
    return s.enums !== undefined && Object.hasOwn(s.enums, typeName);
  }

  function isPrimitive(typeName: string): boolean {
    return PRIMITIVE_TYPES.has(typeName);
  }

  function getEnumValues(typeName: string): string[] {
    const e = s.enums?.[typeName];
    return e ? Object.values(e.values) : [];
  }

  function relationKind(model: string, field: string): "one" | "many" | undefined {
    const f = getField(model, field);
    if (!f || !isRelation(f)) return undefined;
    return f.array ? "many" : "one";
  }

  function getRelationModel(model: string, field: string): string | undefined {
    const f = getField(model, field);
    if (!f || !isRelation(f)) return undefined;
    return f.type;
  }

  function defaultTypeFor(field: FieldDef): FilterType {
    if (isEnum(field.type)) {
      return field.array ? "multiselect" : "select";
    }
    switch (field.type) {
      case "String":
        return "text";
      case "Int":
      case "Float":
      case "Decimal":
      case "BigInt":
        return "number";
      case "DateTime":
        return "date";
      default:
        return "text";
    }
  }

  return {
    hasModel,
    getField,
    getFields,
    isRelation,
    isEnum,
    isPrimitive,
    getEnumValues,
    relationKind,
    getRelationModel,
    defaultTypeFor,
  };
}

export function humanize(name: string): string {
  const spaced = name
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
