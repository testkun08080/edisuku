"use client";

import { Download, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { CSV_EXPORT_ENABLED } from "../lib/features.js";
import { passesFilter } from "../lib/filterEngine.js";
import {
  formatRatioDecimalStringAsPercent,
  formatYenStringAsMillionYen,
} from "../lib/metricFormat.js";
import { loadCompanyMetrics } from "../lib/metricsLoader.js";
import type { CompanyMetric } from "../lib/metricsLoader.js";
import { type ColumnId, useColumnVisibility } from "./ColumnVisibilityContext.js";
import { useFavorites } from "./FavoritesContext.js";
import { useFilters } from "./FilterContext.js";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

const formatSales = formatYenStringAsMillionYen;
const formatRatio = formatRatioDecimalStringAsPercent;

function formatDisplayName(name: string): string {
  return name.replace(/^株式会社\s*|\s*株式会社$/g, "").trim() || name;
}

function ratioOfSalesPct(
  numerator: string | null | undefined,
  sales: string | null | undefined,
): string {
  const s = sales != null ? Number.parseFloat(String(sales).replace(/,/g, "")) : Number.NaN;
  const n = numerator != null ? Number.parseFloat(String(numerator).replace(/,/g, "")) : Number.NaN;
  if (!Number.isFinite(s) || !Number.isFinite(n) || s === 0) return "－";
  return ((n / s) * 100).toFixed(2) + "%";
}

function getCellValueForExport(m: CompanyMetric, colId: ColumnId): string {
  switch (colId) {
    case "filerName":
      return formatDisplayName(m.filerName);
    case "secCode":
      return m.secCode;
    case "edinetCode":
      return m.edinetCode ?? "";
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
    case "operatingProfitRatio":
      return ratioOfSalesPct(m.operatingProfit, m.sales);
    case "netIncome":
      return formatSales(m.netIncome);
    case "netProfitRatio":
      return ratioOfSalesPct(m.netIncome, m.sales);
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
      if (m.sharesOutstanding == null || m.sharesOutstanding === "" || m.sharesOutstanding === "－")
        return "－";
      const n = Number.parseInt(String(m.sharesOutstanding).replace(/,/g, ""), 10);
      return Number.isFinite(n) ? n.toLocaleString() : "－";
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
    default:
      return "－";
  }
}

function escapeCsvCell(s: string): string {
  if (/[,\n"]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function TableDownloadButton() {
  const { filters } = useFilters();
  const { favorites } = useFavorites();
  const { visibility, columnIds, columnLabel } = useColumnVisibility();
  const [loading, setLoading] = useState(false);

  const handleDownload = useCallback(async () => {
    setLoading(true);
    try {
      const metrics = await loadCompanyMetrics();

      const filtered = metrics.filter((m) =>
        passesFilter(
          m,
          { searchName: filters.searchName, searchCode: filters.searchCode },
          filters.rules,
          favorites,
          filters.showOnlyFavorites,
        ),
      );
      const visibleColumns = columnIds.filter((id) => visibility[id]);

      const headers = visibleColumns.map((id) => columnLabel(id));
      const rows = filtered.map((m) =>
        visibleColumns.map((id) => escapeCsvCell(getCellValueForExport(m, id))).join(","),
      );

      const bom = "\uFEFF";
      const csv = bom + [headers.join(","), ...rows].join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `企業一覧_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }, [filters, favorites, visibility, columnIds, columnLabel]);

  const disabled = !CSV_EXPORT_ENABLED || loading;
  const title = !CSV_EXPORT_ENABLED
    ? undefined
    : loading
      ? "ダウンロード中"
      : "現在のフィルター・表示列でCSVをダウンロード";

  const button = (
    <Button
      variant="outline"
      size="sm"
      onClick={disabled ? undefined : handleDownload}
      disabled={disabled}
      title={title}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
    </Button>
  );

  if (!CSV_EXPORT_ENABLED) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{button}</span>
        </TooltipTrigger>
        <TooltipContent>Pro プランで近日公開予定です</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
