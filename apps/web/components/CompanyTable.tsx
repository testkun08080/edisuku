"use client";

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { passesFilter } from "../lib/filterEngine.js";
import {
  formatRatioDecimalStringAsPercent,
  formatYenStringAsMillionYen,
} from "../lib/metricFormat.js";
import {
  type CompanyMetric,
  buildMetricsQueryParams,
  getScreenerMode,
  loadCompanyMetrics,
  queryCompanyMetricsPage,
} from "../lib/metricsLoader";
import { analyzePath } from "../lib/routes";
import { type ColumnId, useColumnVisibility } from "./ColumnVisibilityContext.js";
import { useFavorites } from "./FavoritesContext.js";
import { useFilters } from "./FilterContext.js";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

export type { CompanyMetric };

const formatSales = formatYenStringAsMillionYen;
const formatRatio = formatRatioDecimalStringAsPercent;
const ROW_LIMIT_OPTIONS = ["50", "100", "200", "500"] as const;
const SERVER_MODE = getScreenerMode() === "server";
const SERVER_SORT_COLUMNS = new Set<ColumnId>([
  "filerName",
  "calcDate",
  "sales",
  "ROE",
  "totalAssets",
  "equityRatio",
]);

function parseMetricNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return Number.NaN;
  return Number(value.replace(/,/g, "").trim());
}

function sortNum(value: string | number | null | undefined): number {
  const n = parseMetricNumber(value);
  return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
}

function formatDisplayName(name: string): string {
  return name.replace(/^株式会社\s*|\s*株式会社$/g, "").trim() || name;
}

function applyFilters(
  m: CompanyMetric,
  filters: ReturnType<typeof useFilters>["filters"],
  favorites: Set<string>,
): boolean {
  return passesFilter(
    m,
    { searchName: filters.searchName, searchCode: filters.searchCode },
    filters.rules,
    favorites,
    filters.showOnlyFavorites,
  );
}

function getCellValue(
  m: CompanyMetric,
  colId: ColumnId,
  favHelpers?: { isFavorite: (sec: string) => boolean; toggleFavorite: (sec: string) => void },
): ReactNode {
  switch (colId) {
    case "filerName":
      return (
        <span className="inline-flex items-center gap-1.5">
          {favHelpers && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                favHelpers.toggleFavorite(m.secCode);
              }}
              aria-label={
                favHelpers.isFavorite(m.secCode) ? "お気に入りから外す" : "お気に入りに追加"
              }
              title={favHelpers.isFavorite(m.secCode) ? "お気に入りから外す" : "お気に入りに追加"}
              className="h-5 w-5"
            >
              <Star
                className={`size-3.5 ${
                  favHelpers.isFavorite(m.secCode)
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted-foreground"
                }`}
              />
            </Button>
          )}
          <a
            href={analyzePath(m.secCode)}
            className="font-medium text-foreground hover:text-primary hover:underline underline-offset-4"
          >
            {formatDisplayName(m.filerName)}
          </a>
        </span>
      );
    case "secCode":
      return <Badge variant="outline">{m.secCode}</Badge>;
    case "edinetCode":
      return m.edinetCode;
    case "calcDate":
      return m.calcDate ?? "－";
    case "fiscalMonth":
      return m.fiscalMonth ?? "－";
    case "PER":
      return m.PER != null ? m.PER.toFixed(1) : "－";
    case "PBR":
      return m.PBR != null ? m.PBR.toFixed(2) : "－";
    case "dividendYield":
      return m.dividendYield != null ? m.dividendYield.toFixed(2) + "%" : "－";
    case "marketCap":
      return m.marketCap != null ? formatSales(String(m.marketCap)) : "－";
    case "netCash":
      return m.netCash != null ? formatSales(String(m.netCash)) : "－";
    case "netCashRatio":
      return m.netCashRatio != null ? (m.netCashRatio * 100).toFixed(2) + "%" : "－";
    case "equityRatio":
      return formatRatio(m.equityRatio);
    case "ROE":
      return formatRatio(m.ROE);
    case "EPS":
      return m.EPS ?? "－";
    case "dilutedEPS":
      return m.dilutedEPS ?? "－";
    case "roeCalculated":
      return formatRatio(m.roeCalculated ?? null);
    case "roa":
      return formatRatio(m.roa ?? null);
    case "equityRatioCalculated":
      return formatRatio(m.equityRatioCalculated ?? null);
    case "BPS":
      return m.BPS ?? "－";
    case "payoutRatio":
      return formatRatio(m.payoutRatio);
    case "payoutRatioComputed":
      return formatRatio(m.payoutRatioComputed ?? null);
    case "sales":
      return formatSales(m.sales);
    case "operatingProfit":
      return formatSales(m.operatingProfit);
    case "operatingProfitRatio": {
      const s = parseMetricNumber(m.sales);
      const op = parseMetricNumber(m.operatingProfit);
      if (isNaN(s) || isNaN(op) || s === 0) return "－";
      return ((op / s) * 100).toFixed(2) + "%";
    }
    case "netIncome":
      return formatSales(m.netIncome);
    case "netProfitRatio": {
      const s = parseMetricNumber(m.sales);
      const ni = parseMetricNumber(m.netIncome);
      if (isNaN(s) || isNaN(ni) || s === 0) return "－";
      return ((ni / s) * 100).toFixed(2) + "%";
    }
    case "liabilities":
      return formatSales(m.liabilities);
    case "currentLiabilities":
      return formatSales(m.currentLiabilities);
    case "currentAssets":
      return formatSales(m.currentAssets);
    case "investmentSecurities":
      return formatSales(m.investmentSecurities);
    case "cashBalance":
      return formatSales(m.cashBalance);
    case "dividendPerShare":
      return m.dividendPerShare ?? "－";
    case "sharesOutstanding": {
      const shares = sortNum(m.sharesOutstanding);
      return Number.isFinite(shares) ? Math.round(shares).toLocaleString("ja-JP") : "－";
    }
    case "recurringProfit":
      return formatSales(m.recurringProfit);
    case "comprehensiveIncome":
      return formatSales(m.comprehensiveIncome);
    case "netAssets":
      return formatSales(m.netAssets);
    case "totalAssets":
      return formatSales(m.totalAssets);
    case "operatingCF":
      return formatSales(m.operatingCF);
    case "investingCF":
      return formatSales(m.investingCF);
    case "fcf":
      return formatSales(m.fcf ?? null);
    case "financingCF":
      return formatSales(m.financingCF);
    case "salesGrowthYoY":
      return formatRatio(m.salesGrowthYoY ?? null);
    case "opGrowthYoY":
      return formatRatio(m.opGrowthYoY ?? null);
    case "epsGrowthYoY":
      return formatRatio(m.epsGrowthYoY ?? null);
    case "dividendGrowthYoY":
      return formatRatio(m.dividendGrowthYoY ?? null);
    case "salesCagr3y":
      return formatRatio(m.salesCagr3y ?? null);
    case "salesCagr5y":
      return formatRatio(m.salesCagr5y ?? null);
    case "consecutiveDivIncreases":
      return m.consecutiveDivIncreases != null ? String(m.consecutiveDivIncreases) : "－";
    case "currentRatio":
      return m.currentRatio != null ? m.currentRatio.toFixed(2) : "－";
    case "deRatio":
      return m.deRatio != null ? m.deRatio.toFixed(2) : "－";
    case "roic":
      return m.roic != null ? (m.roic * 100).toFixed(2) + "%" : "－";
    case "piotroskiFScore":
      return m.piotroskiFScore != null ? String(m.piotroskiFScore) : "－";
    default:
      return "－";
  }
}

function getSortValue(m: CompanyMetric, colId: ColumnId): number | string {
  switch (colId) {
    case "filerName":
      return m.filerName ?? "";
    case "secCode":
      return m.secCode ?? "";
    case "edinetCode":
      return m.edinetCode ?? "";
    case "calcDate":
      return m.calcDate ?? "";
    case "fiscalMonth":
      return m.fiscalMonth ?? "";
    case "PER":
      return m.PER ?? Number.NEGATIVE_INFINITY;
    case "PBR":
      return m.PBR ?? Number.NEGATIVE_INFINITY;
    case "dividendYield":
      return m.dividendYield ?? Number.NEGATIVE_INFINITY;
    case "marketCap":
      return m.marketCap ?? Number.NEGATIVE_INFINITY;
    case "netCash":
      return m.netCash ?? Number.NEGATIVE_INFINITY;
    case "netCashRatio":
      return m.netCashRatio ?? Number.NEGATIVE_INFINITY;
    case "equityRatio":
      return sortNum(m.equityRatio);
    case "ROE":
      return sortNum(m.ROE);
    case "EPS":
      return sortNum(m.EPS);
    case "dilutedEPS":
      return sortNum(m.dilutedEPS);
    case "roeCalculated":
      return sortNum(m.roeCalculated);
    case "roa":
      return sortNum(m.roa);
    case "equityRatioCalculated":
      return sortNum(m.equityRatioCalculated);
    case "BPS":
      return sortNum(m.BPS);
    case "payoutRatio":
      return sortNum(m.payoutRatio);
    case "payoutRatioComputed":
      return sortNum(m.payoutRatioComputed);
    case "sales":
      return sortNum(m.sales);
    case "operatingProfit":
      return sortNum(m.operatingProfit);
    case "operatingProfitRatio": {
      const s = parseMetricNumber(m.sales);
      const op = parseMetricNumber(m.operatingProfit);
      if (isNaN(s) || s === 0) return Number.NEGATIVE_INFINITY;
      return isNaN(op) ? Number.NEGATIVE_INFINITY : op / s;
    }
    case "netIncome":
      return sortNum(m.netIncome);
    case "netProfitRatio": {
      const s = parseMetricNumber(m.sales);
      const ni = parseMetricNumber(m.netIncome);
      if (isNaN(s) || s === 0) return Number.NEGATIVE_INFINITY;
      return isNaN(ni) ? Number.NEGATIVE_INFINITY : ni / s;
    }
    case "liabilities":
      return sortNum(m.liabilities);
    case "currentLiabilities":
      return sortNum(m.currentLiabilities);
    case "currentAssets":
      return sortNum(m.currentAssets);
    case "investmentSecurities":
      return sortNum(m.investmentSecurities);
    case "cashBalance":
      return sortNum(m.cashBalance);
    case "dividendPerShare":
      return sortNum(m.dividendPerShare);
    case "sharesOutstanding":
      return sortNum(m.sharesOutstanding);
    case "recurringProfit":
      return sortNum(m.recurringProfit);
    case "comprehensiveIncome":
      return sortNum(m.comprehensiveIncome);
    case "netAssets":
      return sortNum(m.netAssets);
    case "totalAssets":
      return sortNum(m.totalAssets);
    case "operatingCF":
      return sortNum(m.operatingCF);
    case "investingCF":
      return sortNum(m.investingCF);
    case "fcf":
      return sortNum(m.fcf);
    case "financingCF":
      return sortNum(m.financingCF);
    case "salesGrowthYoY":
      return sortNum(m.salesGrowthYoY);
    case "opGrowthYoY":
      return sortNum(m.opGrowthYoY);
    case "epsGrowthYoY":
      return sortNum(m.epsGrowthYoY);
    case "dividendGrowthYoY":
      return sortNum(m.dividendGrowthYoY);
    case "salesCagr3y":
      return sortNum(m.salesCagr3y);
    case "salesCagr5y":
      return sortNum(m.salesCagr5y);
    case "consecutiveDivIncreases":
      return m.consecutiveDivIncreases ?? Number.NEGATIVE_INFINITY;
    case "currentRatio":
      return m.currentRatio ?? Number.NEGATIVE_INFINITY;
    case "deRatio":
      return m.deRatio ?? Number.NEGATIVE_INFINITY;
    case "roic":
      return m.roic ?? Number.NEGATIVE_INFINITY;
    case "piotroskiFScore":
      return m.piotroskiFScore ?? Number.NEGATIVE_INFINITY;
    default:
      return "";
  }
}

function getHeadAlign(colId: ColumnId): string {
  if (colId === "filerName") return "text-left";
  return "text-right";
}

function getCellAlign(colId: ColumnId): string {
  if (colId === "filerName") return "";
  if (
    colId === "secCode" ||
    colId === "edinetCode" ||
    colId === "calcDate" ||
    colId === "fiscalMonth"
  )
    return "tabular-nums";
  return "text-right tabular-nums";
}

export function CompanyTable() {
  const { filters, setFilter } = useFilters();
  const { favorites, isFavorite, toggleFavorite } = useFavorites();
  const { visibility, columnIds, columnLabel } = useColumnVisibility();
  const [metrics, setMetrics] = useState<CompanyMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverTotal, setServerTotal] = useState(0);
  const [sortColumn, setSortColumn] = useState<ColumnId | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);

  const parsedLimit = Number.parseInt(filters.itemCount, 10);
  const pageSize = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 50;
  const itemCountSelectValue = ROW_LIMIT_OPTIONS.includes(
    filters.itemCount as (typeof ROW_LIMIT_OPTIONS)[number],
  )
    ? filters.itemCount
    : "50";

  const filterSignature = useMemo(
    () =>
      JSON.stringify({
        searchName: filters.searchName,
        searchCode: filters.searchCode,
        rules: filters.rules,
        showOnlyFavorites: filters.showOnlyFavorites,
        itemCount: filters.itemCount,
      }),
    [
      filters.searchName,
      filters.searchCode,
      filters.rules,
      filters.showOnlyFavorites,
      filters.itemCount,
    ],
  );

  const serverQuerySignature = useMemo(
    () =>
      JSON.stringify({
        filterSignature,
        sortColumn,
        sortAsc,
        pageIndex,
        pageSize,
      }),
    [filterSignature, sortColumn, sortAsc, pageIndex, pageSize],
  );

  useEffect(() => {
    if (SERVER_MODE) return;
    let cancelled = false;
    loadCompanyMetrics()
      .then((list) => {
        if (cancelled) return;
        setMetrics(list as CompanyMetric[]);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setMetrics([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!SERVER_MODE) return;
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      const params = buildMetricsQueryParams(filters, sortColumn, sortAsc, pageIndex, pageSize);
      queryCompanyMetricsPage(params)
        .then((body) => {
          if (cancelled) return;
          setMetrics((body?.rows ?? []) as unknown as CompanyMetric[]);
          setServerTotal(body?.total ?? 0);
          setLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          setMetrics([]);
          setServerTotal(0);
          setLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [serverQuerySignature, filters, sortColumn, sortAsc, pageIndex, pageSize]);

  const filtered = metrics.filter((m) => applyFilters(m, filters, favorites));
  const visibleColumns = columnIds.filter((id) => visibility[id]);
  const hasColumns = visibleColumns.length > 0;

  const handleSort = (colId: ColumnId) => {
    if (sortColumn === colId) {
      setSortAsc((prev) => !prev);
    } else {
      setSortColumn(colId);
      setSortAsc(true);
    }
  };

  const sorted =
    sortColumn == null || (SERVER_MODE && SERVER_SORT_COLUMNS.has(sortColumn))
      ? filtered
      : [...filtered].sort((a, b) => {
          const va = getSortValue(a, sortColumn);
          const vb = getSortValue(b, sortColumn);
          const isNumA = typeof va === "number";
          const isNumB = typeof vb === "number";
          if (isNumA && isNumB) {
            const diff = (va as number) - (vb as number);
            return sortAsc ? diff : -diff;
          }
          const sa = String(va);
          const sb = String(vb);
          const cmp = sa.localeCompare(sb, "ja");
          return sortAsc ? cmp : -cmp;
        });
  const totalRows = SERVER_MODE ? serverTotal : sorted.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));

  useEffect(() => {
    setPageIndex(0);
  }, [filterSignature]);

  useEffect(() => {
    setPageIndex((p) => Math.min(p, pageCount - 1));
  }, [pageCount]);

  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const rangeStart = totalRows === 0 ? 0 : safePageIndex * pageSize + 1;
  const rangeEnd = Math.min((safePageIndex + 1) * pageSize, totalRows);
  const displayed = SERVER_MODE
    ? sorted
    : sorted.slice(safePageIndex * pageSize, safePageIndex * pageSize + pageSize);

  if (loading) {
    return (
      <div className="space-y-3 p-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (filtered.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <p className="text-muted-foreground text-sm">
          該当する企業がありません。フィルターを緩めてください。
        </p>
      </div>
    );
  }

  if (!hasColumns) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <p className="text-muted-foreground text-sm">
          右上の「表示列」で表示する列を選択してください。
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-3 py-2">
        <span className="text-xs text-muted-foreground">
          {totalRows.toLocaleString()}件中{" "}
          {totalRows === 0 ? "0" : `${rangeStart.toLocaleString()}〜${rangeEnd.toLocaleString()}`}
          件を表示
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2"
              disabled={safePageIndex <= 0}
              onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              aria-label="前のページ"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-[5rem] text-center text-xs tabular-nums text-muted-foreground">
              {safePageIndex + 1} / {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2"
              disabled={safePageIndex >= pageCount - 1}
              onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
              aria-label="次のページ"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            1ページあたり
            <select
              className="h-8 rounded-md border bg-background px-2 text-sm text-foreground"
              value={itemCountSelectValue}
              onChange={(e) => setFilter("itemCount", e.target.value)}
              aria-label="1ページあたりの件数"
            >
              {ROW_LIMIT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}件
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {visibleColumns.map((id) => (
              <TableHead
                key={id}
                className={`${getHeadAlign(id)} cursor-pointer select-none hover:bg-muted/50 transition-colors ${
                  id === "filerName" ? "md:sticky md:left-0 md:z-10 bg-background" : ""
                }`}
                onClick={() => handleSort(id)}
              >
                <span className="inline-flex items-center gap-1">
                  {columnLabel(id)}
                  {sortColumn === id &&
                    (sortAsc ? (
                      <ArrowUp className="size-3.5 text-primary" />
                    ) : (
                      <ArrowDown className="size-3.5 text-primary" />
                    ))}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayed.map((m) => (
            <TableRow key={m.edinetCode}>
              {visibleColumns.map((id) => (
                <TableCell
                  key={id}
                  className={`${getCellAlign(id)} ${
                    id === "filerName"
                      ? "md:sticky md:left-0 md:z-10 bg-background font-medium"
                      : ""
                  }`}
                >
                  {getCellValue(m, id, { isFavorite, toggleFavorite })}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
