import { test, expect } from "@playwright/test";

test("selecting preview text and clicking Bold wraps it in markup and re-renders it bold", async ({ page }) => {
  await page.goto("/");

  const highlight = page.locator("#preview .highlights li").first();
  await expect(highlight).toBeVisible();

  // Double-click selects the word under the cursor — a real, if simple, text selection.
  await highlight.dblclick();
  await expect(page.locator("#format-toolbar")).toBeVisible();

  await page.locator('#format-toolbar button[data-format="bold"]').click();

  // The formatted run re-renders as real <strong> immediately (write-through-Source model).
  await expect(highlight.locator("strong")).toBeVisible();

  // And the underlying JSON stores plain **markup**, not a rich-text object.
  await page.locator("#tab-source").click();
  const sourceText = await page.locator("#json-editor").inputValue();
  expect(sourceText).toContain("**");
});
