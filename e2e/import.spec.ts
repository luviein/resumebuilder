import { test, expect } from "@playwright/test";

test("importing a .json file populates the editor and preview", async ({ page }) => {
  await page.goto("/");

  await page.locator("#load-json-input").setInputFiles({
    name: "test-resume.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ basics: { name: "Imported Person" }, sections: [] }, null, 2)),
  });

  await expect(page.locator("#preview h1")).toHaveText("Imported Person");
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Imported Person");
});
