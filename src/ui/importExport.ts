import { validateResumeJson } from "../lib/validate";
import { downloadTextFile, readFileAsText } from "../lib/storage";
import { exportToPdf } from "../lib/print";
import { editor, showError, showInfo } from "./editorCore";
import { loadResumeText } from "./editorTabs";

const loadJsonBtn = document.getElementById("load-json-btn") as HTMLButtonElement;
const loadJsonInput = document.getElementById("load-json-input") as HTMLInputElement;
const downloadJsonBtn = document.getElementById("download-json-btn") as HTMLButtonElement;
const exportPdfBtn = document.getElementById("export-pdf-btn") as HTMLButtonElement;

const IMPORT_BUTTON_LABEL = "Import Resume";

export function initImportExport(): void {
  loadJsonBtn.addEventListener("click", () => loadJsonInput.click());

  loadJsonInput.addEventListener("change", async () => {
    const file = loadJsonInput.files?.[0];
    loadJsonInput.value = "";
    if (!file) return;

    showError(null);
    showInfo(null);

    const extension = file.name.split(".").pop()?.toLowerCase();

    if (extension === "json") {
      loadResumeText(await readFileAsText(file));
      return;
    }

    if (extension !== "pdf" && extension !== "docx") {
      showError(`Unsupported file type ".${extension ?? ""}". Use .json, .pdf, or .docx.`);
      return;
    }

    loadJsonBtn.disabled = true;
    loadJsonBtn.textContent = "Importing…";
    try {
      const text =
        extension === "pdf"
          ? await (await import("../lib/importers/pdf")).extractPdfText(file)
          : await (await import("../lib/importers/docx")).extractDocxText(file);
      // eslint-disable-next-line no-console
      console.log("[Import] Raw extracted text (before heuristic parsing):\n" + text);
      const { parseResumeText } = await import("../lib/importers/heuristics");
      const data = parseResumeText(text);
      loadResumeText(JSON.stringify(data, null, 2));
      showInfo(`Imported from "${file.name}" — review dates and sections below, they may need correcting.`);
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Couldn't read that file. Try Load JSON with a .json file instead.",
      );
    } finally {
      loadJsonBtn.disabled = false;
      loadJsonBtn.textContent = IMPORT_BUTTON_LABEL;
    }
  });

  downloadJsonBtn.addEventListener("click", () => {
    const result = validateResumeJson(editor.value);
    const text = result.ok ? JSON.stringify(result.data, null, 2) : editor.value;
    downloadTextFile("resume.json", text);
  });

  exportPdfBtn.addEventListener("click", () => exportToPdf());
}
