import type { CompanyMetricsRow } from "@edinet/metrics";
import type { MetricsQueryResponse } from "@edinet/types";
import type { ColumnId } from "../components/ColumnVisibilityContext.js";
import type { FilterState } from "../components/FilterContext.js";
import { rulesToServerFilterBounds } from "./filterEngine.js";
import { api } from "./api";

export type CompanyMetric = CompanyMetricsRow;

export type ScreenerMode = "all" | "server";

const CHUNK_SIZE = 500;

export function getScreenerMode(): ScreenerMode {
  const mode = import.meta.env.VITE_SCREENER_MODE;
  return mode === "server" ? "server" : "all";
}

export type MetricsQueryParams = {
  q?: string;
  minRoe?: string;
  maxRoe?: string;
  minSales?: string;
  maxSales?: string;
  minEquityRatio?: string;
  maxEquityRatio?: string;
  minTotalAssets?: string;
  maxTotalAssets?: string;
  sort?: string;
  order?: "asc" | "desc";
  page?: string;
  pageSize?: string;
};

const SERVER_SORT_MAP: Partial<Record<ColumnId, MetricsQueryParams["sort"]>> = {
  filerName: "filer_name",
  calcDate: "calc_date",
  sales: "sales",
  ROE: "roe",
  totalAssets: "total_assets",
  equityRatio: "equity_ratio",
};

export function buildMetricsQueryParams(
  filters: FilterState,
  sortColumn: ColumnId | null,
  sortAsc: boolean,
  pageIndex: number,
  pageSize: number,
): MetricsQueryParams {
  const q = filters.searchName.trim() || filters.searchCode.trim() || undefined;
  const params: MetricsQueryParams = {
    page: String(pageIndex + 1),
    pageSize: String(pageSize),
  };

  if (q) params.q = q;

  const bounds = rulesToServerFilterBounds(filters.rules);
  if (bounds.minRoe) params.minRoe = bounds.minRoe;
  if (bounds.maxRoe) params.maxRoe = bounds.maxRoe;
  if (bounds.minSales) params.minSales = bounds.minSales;
  if (bounds.maxSales) params.maxSales = bounds.maxSales;
  if (bounds.minEquityRatio) params.minEquityRatio = bounds.minEquityRatio;
  if (bounds.maxEquityRatio) params.maxEquityRatio = bounds.maxEquityRatio;
  if (bounds.minTotalAssets) params.minTotalAssets = bounds.minTotalAssets;
  if (bounds.maxTotalAssets) params.maxTotalAssets = bounds.maxTotalAssets;

  const sortField = sortColumn ? SERVER_SORT_MAP[sortColumn] : undefined;
  if (sortField) {
    params.sort = sortField;
    params.order = sortAsc ? "asc" : "desc";
  }

  return params;
}

export async function loadCompanyMetrics(): Promise<CompanyMetric[]> {
  const all: CompanyMetric[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (offset < total) {
    const res = await api.api.metrics.$get({
      query: { limit: String(CHUNK_SIZE), offset: String(offset) },
    });
    if (!res.ok) break;
    const body = (await res.json()) as unknown as { rows: CompanyMetric[]; total?: number };
    const rows = body.rows ?? [];
    if (rows.length === 0) break;
    all.push(...rows);
    total = body.total ?? all.length;
    offset += rows.length;
    if (rows.length < CHUNK_SIZE) break;
  }

  return all;
}

export async function queryCompanyMetricsPage(
  params: MetricsQueryParams,
): Promise<MetricsQueryResponse | null> {
  const res = await api.api.metrics.query.$get({ query: params });
  if (!res.ok) return null;
  return (await res.json()) as MetricsQueryResponse;
}
