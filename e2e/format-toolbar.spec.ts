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

test("clicking Bold again on already-bold text removes it instead of corrupting the markup", async ({ page }) => {
  await page.goto("/");

  const highlight = page.locator("#preview .highlights li").first();
  await highlight.dblclick();
  await page.locator('#format-toolbar button[data-format="bold"]').click();
  await expect(highlight.locator("strong")).toBeVisible();

  // Re-select the now-bold word and click Bold again — toggles it back off.
  await highlight.dblclick();
  await page.locator('#format-toolbar button[data-format="bold"]').click();

  await expect(highlight.locator("strong")).toHaveCount(0);
  // No stray literal "*" characters leaking into the rendered text from a botched un-bold.
  await expect(highlight).not.toContainText("*");
});

test("Reset removes formatting from a bold selection", async ({ page }) => {
  await page.goto("/");

  const highlight = page.locator("#preview .highlights li").first();
  await highlight.dblclick();
  await page.locator('#format-toolbar button[data-format="bold"]').click();
  await expect(highlight.locator("strong")).toBeVisible();

  await highlight.dblclick();
  await page.locator('#format-toolbar button[data-format="reset"]').click();

  await expect(highlight.locator("strong")).toHaveCount(0);
  await expect(highlight).not.toContainText("*");
});

test("Bold and Italic combine on the same selection", async ({ page }) => {
  await page.goto("/");

  const highlight = page.locator("#preview .highlights li").first();
  await highlight.dblclick();
  await page.locator('#format-toolbar button[data-format="bold"]').click();
  await expect(highlight.locator("strong")).toBeVisible();

  await highlight.dblclick();
  await page.locator('#format-toolbar button[data-format="italic"]').click();

  await expect(highlight.locator("strong em, em strong")).toHaveCount(1);
});
