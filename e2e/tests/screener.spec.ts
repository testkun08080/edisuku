import { expect, test } from "@playwright/test";

test.describe("screener page", () => {
  test("loads sample companies from API via BFF", async ({ page }) => {
    await page.goto("/screener");
    await expect(
      page.getByRole("link", { name: /ライオンロジスティクス|サンプル/ }).first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("navigates to company analyze page from table link", async ({ page }) => {
    await page.goto("/screener");
    const companyLink = page.getByRole("link", { name: /ライオンロジスティクス/ }).first();
    await expect(companyLink).toBeVisible({ timeout: 30_000 });
    await companyLink.click();
    await expect(page).toHaveURL(/\/screener\/analyze\/1302/);
  });
});
