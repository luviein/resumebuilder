import { test, expect } from "@playwright/test";

test("clicking into a preview field switches to Form and scrolls/highlights the matching field", async ({ page }) => {
  await page.goto("/");

  // Start on Source, not Form, so switching is actually observable.
  await page.locator("#tab-source").click();
  await expect(page.locator("#form-editor")).toBeHidden();

  const secondHighlight = page.locator("#preview .highlights li").nth(1);
  await secondHighlight.click();

  await expect(page.locator("#form-editor")).toBeVisible();
  await expect(page.locator("#tab-form")).toHaveClass(/is-active/);

  // The one combined "Highlights" textarea for that entry should be the field that's flashed.
  const highlighted = page.locator("#form-editor .form-just-moved");
  await expect(highlighted).toHaveAttribute("data-form-path", "sections.0.items.0.highlights");
  await expect(highlighted).toBeVisible();
});

test("clicking into the summary field jumps to the Basics Summary field", async ({ page }) => {
  await page.goto("/");
  await page.locator("#tab-source").click();

  await page.locator('#preview [data-path="basics.summary"]').click();

  await expect(page.locator("#form-editor")).toBeVisible();
  const highlighted = page.locator("#form-editor .form-just-moved");
  await expect(highlighted).toHaveAttribute("data-form-path", "basics.summary");
});
