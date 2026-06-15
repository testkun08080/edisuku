import { describe, expect, it } from "vitest";
import type { CompanyMetricsRow } from "./types.js";
import {
  getMetricValue,
  passesRules,
  legacyParamsToRules,
  rulesToServerFilterBounds,
  serializeRules,
  deserializeRules,
} from "./filterEngine.js";
import { getFilterFieldById } from "./filterFields.js";

const sampleRow: CompanyMetricsRow = {
  edinetCode: "E00000",
  secCode: "9999",
  filerName: "サンプル株式会社",
  calcDate: "2025-03-31",
  fiscalMonth: "03",
  equityRatio: "0.4800",
  EPS: "185.50",
  sales: "1000000000000",
  recurringProfit: "115000000000",
  netIncome: "80000000000",
  netAssets: "1200000000000",
  totalAssets: "2500000000000",
  comprehensiveIncome: "82000000000",
  BPS: "2180.00",
  ROE: "0.0667",
  operatingProfit: "120000000000",
  operatingCF: "150000000000",
  investingCF: "-60000000000",
  financingCF: "-40000000000",
  cashBalance: "200000000000",
  payoutRatio: "0.3375",
  dividendPerShare: "50.00",
  sharesOutstanding: "430000000",
  currentAssets: "900000000000",
  currentLiabilities: "500000000000",
  liabilities: "1300000000000",
  investmentSecurities: "45000000000",
  PER: 16,
  PBR: 1.18,
  dividendYield: 0.016846361185983826,
};

describe("filterEngine", () => {
  it("converts percent storage to percent display scale", () => {
    const field = getFilterFieldById("ROE")!;
    expect(getMetricValue(sampleRow, field)).toBeCloseTo(6.67, 1);
  });

  it("converts yen storage to million yen display scale", () => {
    const field = getFilterFieldById("sales")!;
    expect(getMetricValue(sampleRow, field)).toBe(1_000_000);
  });

  it("computes operating profit ratio", () => {
    const field = getFilterFieldById("operatingProfitRatio")!;
    expect(getMetricValue(sampleRow, field)).toBeCloseTo(12, 0);
  });

  it("passesRules with multiple AND conditions", () => {
    const rules = [
      { id: "1", fieldId: "ROE", min: "5", max: "" },
      { id: "2", fieldId: "sales", min: "500", max: "" },
    ];
    expect(passesRules(sampleRow, rules)).toBe(true);
    expect(passesRules(sampleRow, [{ id: "1", fieldId: "ROE", min: "10", max: "" }])).toBe(false);
  });

  it("rulesToServerFilterBounds converts percent and million yen", () => {
    const bounds = rulesToServerFilterBounds([
      { id: "1", fieldId: "ROE", min: "10", max: "" },
      { id: "2", fieldId: "sales", min: "500", max: "" },
    ]);
    expect(bounds.minRoe).toBe("0.1");
    expect(bounds.minSales).toBe("500000000");
  });

  it("legacyParamsToRules migrates old URL params", () => {
    const params = new URLSearchParams("minRoe=15&minEquityRatio=0.4&minSales=50000");
    const rules = legacyParamsToRules(params);
    expect(rules.find((r) => r.fieldId === "ROE")?.min).toBe("15");
    expect(rules.find((r) => r.fieldId === "equityRatio")?.min).toBe("40");
  });

  it("serialize/deserialize rules roundtrip", () => {
    const rules = [{ id: "1", fieldId: "PER", min: "10", max: "20" }];
    const raw = serializeRules(rules);
    const restored = deserializeRules(raw);
    expect(restored[0]?.fieldId).toBe("PER");
    expect(restored[0]?.min).toBe("10");
  });
});
