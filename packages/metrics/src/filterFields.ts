import type { FilterFieldDefinition, FilterInputUnit } from "@edinet/types";
import filterFieldsJson from "./filter_fields.json";

type RawFilterField = {
  id: string;
  label: string;
  category: string;
  metricsKey?: string;
  computedFrom?: string[];
  inputUnit: FilterInputUnit;
  serverFilterKey?: "roe" | "sales" | "equityRatio" | "totalAssets";
};

const CATEGORY_LABELS: Record<string, string> = {
  valuation: "バリュエーション",
  performance: "業績",
  balancesheet: "貸借対照表",
  cash: "キャッシュフロー",
  growth: "成長性",
};

let cachedFields: FilterFieldDefinition[] | null = null;
let cachedById: Map<string, FilterFieldDefinition> | null = null;

export function getFilterFields(): FilterFieldDefinition[] {
  if (cachedFields) return cachedFields;
  const raw = filterFieldsJson as { fields: RawFilterField[] };
  cachedFields = raw.fields.map((f) => ({
    id: f.id,
    label: f.label,
    category: f.category,
    categoryLabel: CATEGORY_LABELS[f.category] ?? f.category,
    metricsKey: f.metricsKey,
    computedFrom: f.computedFrom,
    inputUnit: f.inputUnit,
    serverFilterKey: f.serverFilterKey,
  }));
  return cachedFields;
}

export function getFilterFieldById(id: string): FilterFieldDefinition | undefined {
  if (!cachedById) {
    cachedById = new Map(getFilterFields().map((f) => [f.id, f]));
  }
  return cachedById.get(id);
}

export function getFilterFieldsByCategory(): {
  category: string;
  label: string;
  fields: FilterFieldDefinition[];
}[] {
  const groups = new Map<string, FilterFieldDefinition[]>();
  for (const field of getFilterFields()) {
    const list = groups.get(field.category) ?? [];
    list.push(field);
    groups.set(field.category, list);
  }
  return Array.from(groups.entries()).map(([category, fields]) => ({
    category,
    label: CATEGORY_LABELS[category] ?? category,
    fields,
  }));
}
