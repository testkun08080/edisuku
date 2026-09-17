import { describe, expect, it } from "vitest";
import { isAnnualPeriod, reportKindKey } from "./helpers.js";
import type { CompanySummary } from "./types.js";

function period(docDescription: string): CompanySummary["periods"][0] {
  return {
    periodStart: "2025-04-01",
    periodEnd: "2026-03-31",
    docID: "X",
    docDescription,
    submitDateTime: "2026-06-25T10:00:00Z",
    summary: {},
    pl: {},
    bs: {},
    cf: {},
  };
}

describe("reportKindKey", () => {
  // 実データの docDescription は「有価証券報告書－第78期(2025/04/01－2026/03/31)」形式
  it("classifies real-world EDINET descriptions", () => {
    expect(reportKindKey("有価証券報告書－第78期(2025/04/01－2026/03/31)")).toBe("annual");
    expect(reportKindKey("半期報告書－第78期(2025/04/01－2026/03/31)")).toBe("semiAnnual");
    expect(reportKindKey("四半期報告書－第78期第3四半期(2025/10/01－2025/12/31)")).toBe("quarter");
  });

  it("classifies bare descriptions (backfill synthesizes these when empty)", () => {
    expect(reportKindKey("有価証券報告書")).toBe("annual");
    expect(reportKindKey("半期報告書")).toBe("semiAnnual");
    expect(reportKindKey("四半期報告書")).toBe("quarter");
  });

  // 四半期/半期は「有価証券報告書」を含まないが、判定順が崩れると
  // 訂正有価証券報告書などが通期に落ちるため順序を固定しておく
  it("does not classify amended reports as annual", () => {
    expect(reportKindKey("訂正有価証券報告書－第78期")).toBe("other");
    expect(reportKindKey("四半期報告書の訂正報告書")).toBe("other");
  });

  it("returns other for unknown or missing descriptions", () => {
    expect(reportKindKey(undefined)).toBe("other");
    expect(reportKindKey("")).toBe("other");
    expect(reportKindKey("臨時報告書")).toBe("other");
  });
});

describe("isAnnualPeriod", () => {
  // 修正前は厳密一致だったため、実データ形式では常に false を返していた
  it("accepts real-world annual descriptions, not just the bare string", () => {
    expect(isAnnualPeriod(period("有価証券報告書－第78期(2025/04/01－2026/03/31)"))).toBe(true);
    expect(isAnnualPeriod(period("有価証券報告書"))).toBe(true);
  });

  it("rejects interim and amended reports", () => {
    expect(isAnnualPeriod(period("半期報告書－第78期(2025/04/01－2026/03/31)"))).toBe(false);
    expect(isAnnualPeriod(period("四半期報告書－第78期第3四半期"))).toBe(false);
    expect(isAnnualPeriod(period("訂正有価証券報告書－第78期"))).toBe(false);
  });
});
