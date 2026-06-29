import { describe, expect, it } from "vitest";
import { formatDecimalAsPercent } from "./metricFormat.js";

describe("formatDecimalAsPercent", () => {
  it("multiplies decimal storage by 100 for display", () => {
    expect(formatDecimalAsPercent(0.016846361185983826)).toBe("1.68%");
    expect(formatDecimalAsPercent(0.026065)).toBe("2.61%");
  });

  it("returns dash for null and non-finite", () => {
    expect(formatDecimalAsPercent(null)).toBe("－");
    expect(formatDecimalAsPercent(Number.NaN)).toBe("－");
  });
});
