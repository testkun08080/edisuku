import { expect, test } from "@playwright/test";

test.describe("landing page", () => {
  test("shows site branding", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("エディスク", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("EDINET", { exact: false }).first()).toBeVisible();
  });
});
