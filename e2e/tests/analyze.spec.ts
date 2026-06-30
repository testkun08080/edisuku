import { expect, test } from "@playwright/test";

test.describe("company analyze page", () => {
  test("shows company header and financial tabs", async ({ page }) => {
    await page.goto("/screener/analyze/1302");
    await expect(page.getByText("ライオン", { exact: false }).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("tab", { name: "サマリー" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "指標" })).toBeVisible();
  });
});
