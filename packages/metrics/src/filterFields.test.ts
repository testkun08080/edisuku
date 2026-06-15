import { describe, expect, it } from "vitest";
import screenerColumnsJson from "./screener_columns.json";
import filterFieldsJson from "./filter_fields.json";
import { getFilterFields } from "./filterFields.js";

describe("filter_fields.json", () => {
  const screenerIds = new Set(
    (screenerColumnsJson as { columns: { id: string }[] }).columns.map((c) => c.id),
  );

  it("has 47 filterable fields", () => {
    expect(getFilterFields()).toHaveLength(47);
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
