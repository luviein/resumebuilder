import { test, expect } from "@playwright/test";

test("switching templates changes the rendered markup", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("#preview")).toHaveClass(/template-minimal/);
  await page.locator("#template-select").selectOption("modern");
  await expect(page.locator("#preview")).toHaveClass(/template-modern/);

  // The two templates render visibly different section-heading styling (left-border vs.
  // underline) — confirm the modern stylesheet actually took effect, not just the class name.
  const borderLeft = await page.locator("#preview h2").first().evaluate((el) => getComputedStyle(el).borderLeftWidth);
  expect(parseFloat(borderLeft)).toBeGreaterThan(0);
});
