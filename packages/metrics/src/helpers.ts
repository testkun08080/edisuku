import type { CompanySummary } from "./types.js";

export function compareSubmitDateTime(a: string, b: string): number {
  return a.localeCompare(b, "en");
}

export function parseYen(raw: string | null | undefined): number | null {
  if (raw == null || raw === "" || raw === "－") return null;
  const n = Number.parseFloat(String(raw).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function parseDecimal(raw: string | null | undefined): number | null {
  if (raw == null || raw === "" || raw === "－") return null;
  const n = Number.parseFloat(String(raw).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function growthRatio(current: number | null, previous: number | null): string | null {
  if (current == null || previous == null || previous === 0) return null;
  return String((current - previous) / Math.abs(previous));
}

export function cagrRatio(
  current: number | null,
  past: number | null,
  years: number,
): string | null {
  if (current == null || past == null || past <= 0 || years <= 0) return null;
  return String((current / past) ** (1 / years) - 1);
}

export function pickFromPeriod(
  period: CompanySummary["periods"][0],
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const v = period.summary[key] ?? period.pl[key] ?? period.bs[key] ?? period.cf[key];
    if (v != null && v !== "" && v !== "－") return v;
  }
  return null;
}

export function isAnnualPeriod(period: CompanySummary["periods"][0]): boolean {
  return reportKindKey(period.docDescription) === "annual";
}

/**
 * EDINET docDescription から開示種別キー（分析ページの四半期/半期/通期と対応）
 *
 * 実データの docDescription は「有価証券報告書－第78期(2025/04/01－2026/03/31)」の
 * ような形式なので、前方一致ではなく includes で判定する。
 * 四半期/半期を有価証券報告書より先に判定する順序は変更しないこと。
 */
export function reportKindKey(
  docDescription: string | undefined,
): "quarter" | "semiAnnual" | "annual" | "other" {
  const d = docDescription ?? "";
  // 訂正報告書は同一期の重複となり CAGR の遡及を壊すため通期扱いしない
  if (d.includes("訂正")) return "other";
  if (d.includes("四半期報告書")) return "quarter";
  if (d.includes("半期報告書")) return "semiAnnual";
  if (d.includes("有価証券報告書")) return "annual";
  return "other";
}

export function annualPeriodsSortedDesc(
  periods: CompanySummary["periods"],
): CompanySummary["periods"] {
  return periods.filter(isAnnualPeriod).sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
}
