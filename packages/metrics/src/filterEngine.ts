import type { FilterFieldDefinition, NumericFilterRule } from "@edinet/types";
import { getFilterFieldById } from "./filterFields.js";
import type { CompanyMetricsRow } from "./types.js";

export type MetricRow = CompanyMetricsRow & Record<string, string | number | null | undefined>;

function parseMetricNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return Number.NaN;
  const cleaned = value.replace(/,/g, "").trim();
  if (cleaned === "" || cleaned === "－" || cleaned === "-") return Number.NaN;
  return Number.parseFloat(cleaned);
}

/** 行から指標の内部比較値（正規化済み数値）を取得 */
export function getMetricValue(row: MetricRow, field: FilterFieldDefinition): number | null {
  if (field.computedFrom) {
    if (field.id === "operatingProfitRatio") {
      const sales = parseMetricNumber(row.sales);
      const op = parseMetricNumber(row.operatingProfit);
      if (!Number.isFinite(sales) || !Number.isFinite(op) || sales === 0) return null;
      return (op / sales) * 100;
    }
    if (field.id === "netProfitRatio") {
      const sales = parseMetricNumber(row.sales);
      const ni = parseMetricNumber(row.netIncome);
      if (!Number.isFinite(sales) || !Number.isFinite(ni) || sales === 0) return null;
      return (ni / sales) * 100;
    }
    return null;
  }

  const key = field.metricsKey ?? field.id;
  const raw = row[key];
  const n = parseMetricNumber(raw);
  if (!Number.isFinite(n)) return null;

  switch (field.inputUnit) {
    case "percent":
      return n * 100;
    case "millionYen":
      return n / 1_000_000;
    case "yen":
    case "multiple":
    case "count":
      return n;
    default:
      return n;
  }
}

/** UI 入力値を内部比較値（getMetricValue と同じスケール）に変換 */
export function normalizeInput(value: string, field: FilterFieldDefinition): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number.parseFloat(trimmed);
  if (!Number.isFinite(n)) return null;
  return n;
}

function ruleBounds(
  rule: NumericFilterRule,
  field: FilterFieldDefinition,
): { min: number | null; max: number | null } {
  return {
    min: normalizeInput(rule.min, field),
    max: normalizeInput(rule.max, field),
  };
}

/** 1ルールが行を満たすか。値なしは fail */
export function passesRule(row: MetricRow, rule: NumericFilterRule): boolean {
  const field = getFilterFieldById(rule.fieldId);
  if (!field) return true;

  const hasBound = rule.min.trim() !== "" || rule.max.trim() !== "";
  if (!hasBound) return true;

  const value = getMetricValue(row, field);
  if (value == null) return false;

  const { min, max } = ruleBounds(rule, field);
  if (min != null && value < min) return false;
  if (max != null && value > max) return false;
  return true;
}

/** 全ルール AND 評価 */
export function passesRules(row: MetricRow, rules: NumericFilterRule[]): boolean {
  for (const rule of rules) {
    if (!passesRule(row, rule)) return false;
  }
  return true;
}

export type TextSearchFilters = {
  searchName: string;
  searchCode: string;
};

/** テキスト検索 + 数値ルール + お気に入り */
export function passesFilter(
  row: MetricRow,
  text: TextSearchFilters,
  rules: NumericFilterRule[],
  favorites: Set<string>,
  showOnlyFavorites: boolean,
): boolean {
  if (showOnlyFavorites && !favorites.has(row.secCode)) return false;
  if (
    text.searchName.trim() &&
    !row.filerName.toLowerCase().includes(text.searchName.trim().toLowerCase())
  ) {
    return false;
  }
  if (text.searchCode.trim() && !row.secCode.includes(text.searchCode.trim())) return false;
  return passesRules(row, rules);
}

/** server モード: 同一 serverFilterKey の min/max をマージ */
export type ServerFilterBounds = {
  minRoe?: string;
  maxRoe?: string;
  minSales?: string;
  maxSales?: string;
  minEquityRatio?: string;
  maxEquityRatio?: string;
  minTotalAssets?: string;
  maxTotalAssets?: string;
};

function mergeBound(current: string | undefined, next: string, mode: "min" | "max"): string {
  if (!current) return next;
  const a = Number.parseFloat(current);
  const b = Number.parseFloat(next);
  if (!Number.isFinite(a)) return next;
  if (!Number.isFinite(b)) return current;
  return mode === "min" ? String(Math.max(a, b)) : String(Math.min(a, b));
}

/** percent UI 入力 → API 用 decimal 文字列 */
function percentInputToDecimal(value: string): string {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return value;
  return String(n / 100);
}

/** millionYen UI 入力 → API 用 yen 文字列 */
function millionYenInputToYen(value: string): string {
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n)) return value;
  return String(n * 1_000_000);
}

export function rulesToServerFilterBounds(rules: NumericFilterRule[]): ServerFilterBounds {
  const bounds: ServerFilterBounds = {};

  for (const rule of rules) {
    const field = getFilterFieldById(rule.fieldId);
    if (!field?.serverFilterKey) continue;

    const key = field.serverFilterKey;
    if (key === "roe" || key === "equityRatio") {
      if (rule.min.trim()) {
        bounds[`min${key === "roe" ? "Roe" : "EquityRatio"}` as keyof ServerFilterBounds] =
          mergeBound(
            bounds[`min${key === "roe" ? "Roe" : "EquityRatio"}` as keyof ServerFilterBounds],
            percentInputToDecimal(rule.min),
            "min",
          );
      }
      if (rule.max.trim()) {
        bounds[`max${key === "roe" ? "Roe" : "EquityRatio"}` as keyof ServerFilterBounds] =
          mergeBound(
            bounds[`max${key === "roe" ? "Roe" : "EquityRatio"}` as keyof ServerFilterBounds],
            percentInputToDecimal(rule.max),
            "max",
          );
      }
    } else if (key === "sales" || key === "totalAssets") {
      const minKey = key === "sales" ? "minSales" : "minTotalAssets";
      const maxKey = key === "sales" ? "maxSales" : "maxTotalAssets";
      if (rule.min.trim()) {
        bounds[minKey] = mergeBound(bounds[minKey], millionYenInputToYen(rule.min), "min");
      }
      if (rule.max.trim()) {
        bounds[maxKey] = mergeBound(bounds[maxKey], millionYenInputToYen(rule.max), "max");
      }
    }
  }

  return bounds;
}

/** 旧 URL パラメータから rules へ変換 */
export function legacyParamsToRules(params: URLSearchParams): NumericFilterRule[] {
  const rules: NumericFilterRule[] = [];
  const add = (fieldId: string, min?: string, max?: string) => {
    if (!min && !max) return;
    rules.push({
      id: `legacy-${fieldId}`,
      fieldId,
      min: min ?? "",
      max: max ?? "",
    });
  };

  const legacyPercent = (raw: string | null): string | undefined => {
    if (!raw) return undefined;
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n)) return raw;
    // 旧 UI は decimal (0.3) と percent (15) が混在していたため、>1 なら percent、<=1 なら decimal*100
    return n > 1 ? String(n) : String(n * 100);
  };

  add(
    "equityRatio",
    legacyPercent(params.get("minEquityRatio")),
    legacyPercent(params.get("maxEquityRatio")),
  );
  add("EPS", params.get("minEps") ?? undefined, params.get("maxEps") ?? undefined);
  add("sales", params.get("minSales") ?? undefined, params.get("maxSales") ?? undefined);
  add("ROE", legacyPercent(params.get("minRoe")), legacyPercent(params.get("maxRoe")));
  add(
    "totalAssets",
    params.get("minTotalAssets") ?? undefined,
    params.get("maxTotalAssets") ?? undefined,
  );

  return rules;
}

/** rules を URL 用コンパクト JSON に */
export function serializeRules(rules: NumericFilterRule[]): string {
  const compact = rules
    .filter((r) => r.min.trim() || r.max.trim())
    .map((r) => {
      const item: { f: string; min?: string; max?: string } = { f: r.fieldId };
      if (r.min.trim()) item.min = r.min.trim();
      if (r.max.trim()) item.max = r.max.trim();
      return item;
    });
  return JSON.stringify(compact);
}

export function deserializeRules(raw: string): NumericFilterRule[] {
  try {
    const parsed = JSON.parse(raw) as Array<{ f: string; min?: string; max?: string }>;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item, i) => ({
      id: `url-${item.f}-${i}`,
      fieldId: item.f,
      min: item.min ?? "",
      max: item.max ?? "",
    }));
  } catch {
    return [];
  }
}

export function createEmptyRule(fieldId = "ROE"): NumericFilterRule {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `rule-${Date.now()}`,
    fieldId,
    min: "",
    max: "",
  };
}
