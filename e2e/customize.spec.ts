import { test, expect } from "@playwright/test";

test("a Customize change is reflected in the preview and survives a reload", async ({ page }) => {
  await page.goto("/");

  await page.locator("#customize-btn").click();
  await expect(page.locator("#style-dialog")).toBeVisible();

  const marginInput = page.locator("#style-margin");
  await marginInput.fill("1.25");
  await marginInput.dispatchEvent("input");

  await expect(page.locator("#page")).toHaveCSS("padding-left", "120px"); // 1.25in at 96dpi

  await page.reload();
  await expect(page.locator("#page")).toHaveCSS("padding-left", "120px");
});
