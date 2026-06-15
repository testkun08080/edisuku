/**
 * Shared API response / domain types.
 * Used by both `apps/api` (returns) and `apps/web` (consumes).
 */

export interface Company {
  edinetCode: string;
  secCode: string | null;
  filerName: string;
  listedCategory: string | null;
  industry: string | null;
  updatedAt: string;
}

export interface CompanyListResponse {
  companies: Company[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FinancialBlock {
  [key: string]: number | string | null;
}

export interface PeriodFinancialView {
  edinetCode: string;
  secCode: string | null;
  docId: string;
  docType: string;
  docDescription: string | null;
  periodStart: string | null;
  periodEnd: string;
  submitDateTime: string | null;
  filerName: string;
  summary: FinancialBlock;
  pl: FinancialBlock;
  bs: FinancialBlock;
  cf: FinancialBlock;
}

export interface SummaryResponse {
  secCode: string;
  periods: PeriodFinancialView[];
}

export interface MetricsRow {
  secCode: string;
  edinetCode: string;
  filerName: string;
  latestPeriodEnd: string;
  latestSubmitDateTime: string | null;
  industry: string | null;
  listedCategory: string | null;
  /** ROE / ROA / PER / PBR / FCF / 売上成長率など、UI 一覧テーブル列に対応 */
  [metric: string]: number | string | null;
}

export interface MetricsResponse {
  rows: MetricsRow[];
  columns: ColumnDefinition[];
  generatedAt: string;
  total: number;
  schemaVersion: string;
}

export interface MetricsQueryResponse {
  rows: MetricsRow[];
  total: number;
  page: number;
  pageSize: number;
  generatedAt: string;
  schemaVersion: string;
}

export interface ColumnDefinition {
  key: string;
  label: string;
  group?: string;
  format?: "number" | "percent" | "currency" | "date" | "text";
  decimals?: number;
  defaultVisible?: boolean;
}

export interface SearchResult {
  type: "company";
  secCode: string | null;
  edinetCode: string;
  filerName: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
}

export interface ShareholderEntry {
  name: string;
  shares: number;
  ratio: number | null;
}

export interface ShareholderSnapshot {
  periodEnd: string;
  entries: ShareholderEntry[];
}

export interface ShareholdersResponse {
  secCode: string;
  snapshots: ShareholderSnapshot[];
}

export interface ManifestResponse {
  columns: ColumnDefinition[];
  generatedAt: string;
  schemaVersion: string;
}

export interface HealthResponse {
  ok: true;
  service: "edisuku-api";
  version: string;
  timestamp: string;
}

/** フィルター入力の単位種別 */
export type FilterInputUnit = "percent" | "millionYen" | "yen" | "multiple" | "count";

/** 数値フィルター可能な指標の定義 */
export interface FilterFieldDefinition {
  id: string;
  label: string;
  category: string;
  categoryLabel: string;
  metricsKey?: string;
  computedFrom?: string[];
  inputUnit: FilterInputUnit;
  /** server モードで /api/metrics/query に渡せる DB 列 */
  serverFilterKey?: "roe" | "sales" | "equityRatio" | "totalAssets";
}

/** 動的数値フィルターの1行 */
export interface NumericFilterRule {
  id: string;
  fieldId: string;
  min: string;
  max: string;
}

/** URL 共有用のコンパクトなルール表現 */
export interface CompactFilterRule {
  f: string;
  min?: string;
  max?: string;
}

/** localStorage に保存するユーザープリセット */
export interface SavedFilterPreset {
  id: string;
  name: string;
  createdAt: string;
  searchName: string;
  searchCode: string;
  rules: NumericFilterRule[];
  showOnlyFavorites: boolean;
}
