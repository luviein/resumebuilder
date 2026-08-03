import { test, expect } from "@playwright/test";

test("loads with the sample resume and shows a live preview", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#preview h1")).toBeVisible();
  await expect(page.locator("#preview h1")).not.toBeEmpty();
  // Form is the default active tab.
  await expect(page.locator("#form-editor")).toBeVisible();
  await expect(page.locator(".editor-wrap")).toBeHidden();
});
