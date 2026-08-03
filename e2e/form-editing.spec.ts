import { test, expect } from "@playwright/test";

test("editing the Form updates the JSON (Source view) and the preview", async ({ page }) => {
  await page.goto("/");

  const nameField = page.getByLabel("Name", { exact: true });
  await nameField.fill("Alex Example");
  await nameField.blur();

  await expect(page.locator("#preview h1")).toHaveText("Alex Example");

  await page.locator("#tab-source").click();
  const sourceText = await page.locator("#json-editor").inputValue();
  expect(JSON.parse(sourceText).basics.name).toBe("Alex Example");
});
