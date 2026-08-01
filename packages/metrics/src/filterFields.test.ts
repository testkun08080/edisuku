import { describe, expect, it } from "vitest";
import { getFilterFields } from "./filterFields.js";
import filterFieldsJson from "./filter_fields.json";
import screenerColumnsJson from "./screener_columns.json";

describe("filter_fields.json", () => {
  const screenerIds = new Set(
    (screenerColumnsJson as { columns: { id: string }[] }).columns.map((c) => c.id),
  );

  // roic / netCash / netCashRatio / PBR は EDINET のデータでは正しく算出できないため
  // UI から除外した（値は metrics_json に保持）
  it("has 43 filterable fields", () => {
    expect(getFilterFields()).toHaveLength(43);
  });

  it("does not expose metrics that cannot be derived from EDINET data", () => {
    const ids = new Set(getFilterFields().map((f) => f.id));
    for (const removed of ["roic", "netCash", "netCashRatio", "PBR"]) {
      expect(ids.has(removed), `${removed} should not be filterable`).toBe(false);
      expect(screenerIds.has(removed), `${removed} should not be a column`).toBe(false);
    }
  });

  it("every filter field id exists in screener_columns", () => {
    for (const field of getFilterFields()) {
      expect(screenerIds.has(field.id), `missing screener column: ${field.id}`).toBe(true);
    }
  });

  it("each field has metricsKey or computedFrom", () => {
    for (const field of getFilterFields()) {
      const hasSource = field.metricsKey != null || (field.computedFrom?.length ?? 0) > 0;
      expect(hasSource, field.id).toBe(true);
    }
  });

  it("computed fields match screener_columns computedFrom", () => {
    const screenerById = new Map(
      (screenerColumnsJson as { columns: { id: string; computedFrom?: string[] }[] }).columns.map(
        (c) => [c.id, c],
      ),
    );
    for (const field of getFilterFields()) {
      if (!field.computedFrom) continue;
      const col = screenerById.get(field.id);
      expect(col?.computedFrom, field.id).toEqual(field.computedFrom);
    }
  });

  it("has no duplicate ids", () => {
    const ids = (filterFieldsJson as { fields: { id: string }[] }).fields.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
