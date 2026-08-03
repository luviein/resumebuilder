import { test, expect } from "@playwright/test";

test("Save creates a version, and Restore updates both the Form and Source views", async ({ page }) => {
  await page.goto("/");

  const nameField = page.getByLabel("Name", { exact: true });

  // First save.
  await nameField.fill("Version A");
  await nameField.blur();
  await page.locator("#save-version-btn").click();
  await expect(page.locator("#info-banner-text")).toHaveText("Version saved.");

  // Second save — a real change since the last save, so a second entry is created.
  await nameField.fill("Version B");
  await nameField.blur();
  await page.locator("#save-version-btn").click();
  await expect(page.locator("#info-banner-text")).toHaveText("Version saved.");

  // Pick the oldest entry (Version A) from the dropdown — opens the diff dialog. The list is
  // newest-first (index 0 is the placeholder, index 1 is "Version B", index 2 is "Version A").
  await page.locator("#version-select").selectOption({ index: 2 });
  await expect(page.locator("#history-dialog")).toBeVisible();
  await expect(page.locator("#history-diff")).toContainText("Version A");

  await page.locator("#history-restore-btn").click();
  await expect(page.locator("#history-dialog")).toBeHidden();

  // Regression check: the Form (currently active) must reflect the restored data, not the
  // pre-restore "Version B" state — render() alone doesn't rebuild the Form pane.
  await expect(nameField).toHaveValue("Version A");
  await expect(page.locator("#preview h1")).toHaveText("Version A");

  // Same check switching to Source.
  await page.locator("#tab-source").click();
  const sourceText = await page.locator("#json-editor").inputValue();
  expect(JSON.parse(sourceText).basics.name).toBe("Version A");
});

test("saving again with no changes does not create a duplicate entry", async ({ page }) => {
  await page.goto("/");
  await page.locator("#save-version-btn").click();
  await expect(page.locator("#info-banner-text")).toHaveText("Version saved.");

  await page.locator("#save-version-btn").click();
  await expect(page.locator("#info-banner-text")).toHaveText("Nothing's changed since your last save.");

  const optionCount = await page.locator("#version-select option").count();
  expect(optionCount).toBe(2); // placeholder + the one real save
});
