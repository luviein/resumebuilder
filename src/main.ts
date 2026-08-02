import "./styles/app.css";
import { templates, getTemplate } from "./templates";
import { validateResumeJson } from "./lib/validate";
import { loadSavedResumeText, saveResumeText, downloadTextFile, readFileAsText } from "./lib/storage";
import { exportToPdf } from "./lib/print";
import { escapeHtml } from "./lib/escapeHtml";
import {
  DEFAULT_STYLE_PREFS,
  FONT_OPTIONS,
  loadStylePrefs,
  saveStylePrefs,
  applyStylePrefs,
  type StylePrefs,
  type SectionStyle,
} from "./lib/stylePrefs";
import sampleResume from "./data/sample-resume.json";

const editor = document.getElementById("json-editor") as HTMLTextAreaElement;
const lineNumbers = document.getElementById("line-numbers") as HTMLDivElement;
const errorLineHighlight = document.getElementById("error-line-highlight") as HTMLDivElement;
const preview = document.getElementById("preview") as HTMLDivElement;
const previewPane = document.getElementById("preview-pane") as HTMLElement;
const errorBanner = document.getElementById("error-banner") as HTMLDivElement;
const infoBanner = document.getElementById("info-banner") as HTMLDivElement;
const loadJsonBtn = document.getElementById("load-json-btn") as HTMLButtonElement;
const loadJsonInput = document.getElementById("load-json-input") as HTMLInputElement;
const downloadJsonBtn = document.getElementById("download-json-btn") as HTMLButtonElement;
const exportPdfBtn = document.getElementById("export-pdf-btn") as HTMLButtonElement;
const tabEdit = document.getElementById("tab-edit") as HTMLButtonElement;
const tabPreview = document.getElementById("tab-preview") as HTMLButtonElement;
const layout = document.querySelector(".layout") as HTMLElement;

const customizeBtn = document.getElementById("customize-btn") as HTMLButtonElement;
const styleDialog = document.getElementById("style-dialog") as HTMLDialogElement;
const styleDialogHeader = document.getElementById("style-dialog-header") as HTMLDivElement;
const styleResetBtn = document.getElementById("style-reset-btn") as HTMLButtonElement;
const styleMarginInput = document.getElementById("style-margin") as HTMLInputElement;
const styleSpacingInput = document.getElementById("style-spacing") as HTMLInputElement;
const styleLineHeightInput = document.getElementById("style-line-height") as HTMLInputElement;
const styleMarginValue = document.getElementById("style-margin-value") as HTMLOutputElement;
const styleSpacingValue = document.getElementById("style-spacing-value") as HTMLOutputElement;
const styleLineHeightValue = document.getElementById("style-line-height-value") as HTMLOutputElement;

interface SectionControls {
  font: HTMLSelectElement;
  size: HTMLInputElement;
  sizeValue: HTMLOutputElement;
  color: HTMLInputElement;
}

const sectionControls: Record<"header" | "heading" | "body", SectionControls> = {
  header: {
    font: document.getElementById("style-header-font") as HTMLSelectElement,
    size: document.getElementById("style-header-size") as HTMLInputElement,
    sizeValue: document.getElementById("style-header-size-value") as HTMLOutputElement,
    color: document.getElementById("style-header-color") as HTMLInputElement,
  },
  heading: {
    font: document.getElementById("style-heading-font") as HTMLSelectElement,
    size: document.getElementById("style-heading-size") as HTMLInputElement,
    sizeValue: document.getElementById("style-heading-size-value") as HTMLOutputElement,
    color: document.getElementById("style-heading-color") as HTMLInputElement,
  },
  body: {
    font: document.getElementById("style-body-font") as HTMLSelectElement,
    size: document.getElementById("style-body-size") as HTMLInputElement,
    sizeValue: document.getElementById("style-body-size-value") as HTMLOutputElement,
    color: document.getElementById("style-body-color") as HTMLInputElement,
  },
};

const fontOptionsHtml = FONT_OPTIONS.map(
  (f) => `<option value="${escapeHtml(f.value)}">${escapeHtml(f.label)}</option>`,
).join("");
for (const controls of Object.values(sectionControls)) {
  controls.font.innerHTML = fontOptionsHtml;
}

let stylePrefs: StylePrefs = loadStylePrefs();

function syncStyleControlsFromPrefs(): void {
  styleMarginInput.value = String(stylePrefs.marginIn);
  styleMarginValue.textContent = `${stylePrefs.marginIn}in`;
  styleSpacingInput.value = String(stylePrefs.spacingScale);
  styleSpacingValue.textContent = `${Math.round(stylePrefs.spacingScale * 100)}%`;
  styleLineHeightInput.value = String(stylePrefs.lineHeight);
  styleLineHeightValue.textContent = String(stylePrefs.lineHeight);

  for (const key of ["header", "heading", "body"] as const) {
    const controls = sectionControls[key];
    const section = stylePrefs[key];
    controls.font.value = section.font;
    controls.size.value = String(section.sizeScale);
    controls.sizeValue.textContent = `${Math.round(section.sizeScale * 100)}%`;
    controls.color.value = section.color;
  }
}

function applyAndSaveStylePrefs(): void {
  applyStylePrefs(previewPane, stylePrefs);
  saveStylePrefs(stylePrefs);
}

applyStylePrefs(previewPane, stylePrefs);

customizeBtn.addEventListener("click", () => {
  syncStyleControlsFromPrefs();
  // Non-modal (.show(), not .showModal()): no dimming backdrop, so the live preview stays fully
  // visible and interactive while the panel is open.
  styleDialog.show();
});

// .showModal() closes on Escape natively; .show() doesn't, so wire it up manually.
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && styleDialog.open) styleDialog.close();
});

let dragOffsetX = 0;
let dragOffsetY = 0;

function onDialogDragMove(e: PointerEvent): void {
  const x = Math.min(Math.max(e.clientX - dragOffsetX, 0), window.innerWidth - styleDialog.offsetWidth);
  const y = Math.min(Math.max(e.clientY - dragOffsetY, 0), window.innerHeight - styleDialog.offsetHeight);
  styleDialog.style.left = `${x}px`;
  styleDialog.style.top = `${y}px`;
}

function onDialogDragEnd(): void {
  styleDialogHeader.classList.remove("is-dragging");
  window.removeEventListener("pointermove", onDialogDragMove);
  window.removeEventListener("pointerup", onDialogDragEnd);
}

styleDialogHeader.addEventListener("pointerdown", (e) => {
  const rect = styleDialog.getBoundingClientRect();
  dragOffsetX = e.clientX - rect.left;
  dragOffsetY = e.clientY - rect.top;
  styleDialogHeader.classList.add("is-dragging");
  window.addEventListener("pointermove", onDialogDragMove);
  window.addEventListener("pointerup", onDialogDragEnd);
});

styleMarginInput.addEventListener("input", () => {
  stylePrefs.marginIn = Number(styleMarginInput.value);
  styleMarginValue.textContent = `${stylePrefs.marginIn}in`;
  applyAndSaveStylePrefs();
});

styleSpacingInput.addEventListener("input", () => {
  stylePrefs.spacingScale = Number(styleSpacingInput.value);
  styleSpacingValue.textContent = `${Math.round(stylePrefs.spacingScale * 100)}%`;
  applyAndSaveStylePrefs();
});

styleLineHeightInput.addEventListener("input", () => {
  stylePrefs.lineHeight = Number(styleLineHeightInput.value);
  styleLineHeightValue.textContent = String(stylePrefs.lineHeight);
  applyAndSaveStylePrefs();
});

for (const key of ["header", "heading", "body"] as const) {
  const controls = sectionControls[key];

  controls.font.addEventListener("change", () => {
    stylePrefs[key].font = controls.font.value;
    applyAndSaveStylePrefs();
  });

  controls.size.addEventListener("input", () => {
    const section: SectionStyle = stylePrefs[key];
    section.sizeScale = Number(controls.size.value);
    controls.sizeValue.textContent = `${Math.round(section.sizeScale * 100)}%`;
    applyAndSaveStylePrefs();
  });

  controls.color.addEventListener("input", () => {
    stylePrefs[key].color = controls.color.value;
    applyAndSaveStylePrefs();
  });
}

styleResetBtn.addEventListener("click", () => {
  stylePrefs = structuredClone(DEFAULT_STYLE_PREFS);
  syncStyleControlsFromPrefs();
  applyAndSaveStylePrefs();
});

const currentTemplateId = templates[0].id;

editor.value = loadSavedResumeText() ?? JSON.stringify(sampleResume, null, 2);

let currentErrorLine: number | null = null;
let previousErrorLine: number | null = null;

function showError(message: string | null): void {
  if (message) {
    errorBanner.textContent = message;
    errorBanner.hidden = false;
  } else {
    errorBanner.hidden = true;
  }
}

function showInfo(message: string | null): void {
  if (message) {
    infoBanner.textContent = message;
    infoBanner.hidden = false;
  } else {
    infoBanner.hidden = true;
  }
}

/**
 * V8's JSON.parse error messages include "line N column M" — pull the line number out for the
 * gutter. For "Expected ',' or '}'/']' after ..." errors specifically, a comma is missing — V8
 * reports the position of the *next* token (where it noticed the problem), not where the fix
 * belongs. Usually that's the end of the *previous* line, but only when the reported line has
 * nothing but whitespace before the reported column — if something else precedes it on the same
 * line (e.g. a hand-edited "] "institution": ..." merged onto one line), the fix belongs on the
 * reported line itself, right before that column, not a line earlier.
 */
function extractErrorLine(message: string, text: string): number | null {
  const match = /line (\d+) column (\d+)/i.exec(message);
  if (!match) return null;
  let line = Number(match[1]);
  const column = Number(match[2]);

  if (/Expected ',' or '[}\]]' after/i.test(message) && line > 1) {
    const lineText = text.split("\n")[line - 1] ?? "";
    const beforeColumn = lineText.slice(0, column - 1);
    if (beforeColumn.trim() === "") {
      line -= 1;
    }
  }

  return line;
}

function renderLineNumbers(errorLine: number | null): void {
  const lineCount = editor.value.split("\n").length;
  lineNumbers.innerHTML = Array.from({ length: lineCount }, (_, i) => {
    const n = i + 1;
    return n === errorLine ? `<span class="error-line">${n}</span>` : `<span>${n}</span>`;
  }).join("");
  lineNumbers.scrollTop = editor.scrollTop;
}

function scrollToLine(lineNum: number): void {
  const lineHeight = parseFloat(getComputedStyle(editor).lineHeight);
  const paddingTop = parseFloat(getComputedStyle(editor).paddingTop);
  const targetTop = paddingTop + (lineNum - 1) * lineHeight - editor.clientHeight / 2 + lineHeight / 2;
  editor.scrollTop = Math.max(0, targetTop);
  lineNumbers.scrollTop = editor.scrollTop;
  editor.focus();
}

/** Positions the full-width red band over the current error line, tracking textarea scroll. */
function updateErrorLineHighlight(): void {
  if (currentErrorLine == null) {
    errorLineHighlight.style.display = "none";
    return;
  }
  const lineHeight = parseFloat(getComputedStyle(editor).lineHeight);
  const paddingTop = parseFloat(getComputedStyle(editor).paddingTop);
  const top = paddingTop + (currentErrorLine - 1) * lineHeight - editor.scrollTop;
  errorLineHighlight.style.top = `${top}px`;
  errorLineHighlight.style.height = `${lineHeight}px`;
  errorLineHighlight.style.display = "block";
}

function render(): void {
  const result = validateResumeJson(editor.value);
  if (!result.ok) {
    showError(result.error);
    currentErrorLine = extractErrorLine(result.error, editor.value);
    renderLineNumbers(currentErrorLine);
    // Jump to it automatically only when this is a newly-found error line, not on every keystroke
    // while the same error persists — otherwise it would fight the cursor while actively typing.
    if (currentErrorLine != null && currentErrorLine !== previousErrorLine) {
      scrollToLine(currentErrorLine);
    }
    // Runs after scrollToLine (which may change editor.scrollTop) so the highlight's position
    // reflects the current scroll offset, not a stale one from before the jump.
    updateErrorLineHighlight();
    previousErrorLine = currentErrorLine;
    return;
  }
  showError(null);
  currentErrorLine = null;
  previousErrorLine = null;
  renderLineNumbers(null);
  updateErrorLineHighlight();
  saveResumeText(editor.value);
  preview.className = `template-${currentTemplateId}`;
  preview.innerHTML = getTemplate(currentTemplateId).render(result.data);
  applyStylePrefs(previewPane, stylePrefs);
}

let debounceHandle: number | undefined;
editor.addEventListener("input", () => {
  showInfo(null);
  renderLineNumbers(currentErrorLine);
  updateErrorLineHighlight();
  window.clearTimeout(debounceHandle);
  debounceHandle = window.setTimeout(render, 300);
});

editor.addEventListener("scroll", () => {
  lineNumbers.scrollTop = editor.scrollTop;
  updateErrorLineHighlight();
});

errorBanner.addEventListener("click", () => {
  if (currentErrorLine != null) scrollToLine(currentErrorLine);
});

loadJsonBtn.addEventListener("click", () => loadJsonInput.click());

const IMPORT_BUTTON_LABEL = "Import Resume";

loadJsonInput.addEventListener("change", async () => {
  const file = loadJsonInput.files?.[0];
  loadJsonInput.value = "";
  if (!file) return;

  showError(null);
  showInfo(null);

  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "json") {
    editor.value = await readFileAsText(file);
    render();
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
        ? await (await import("./lib/importers/pdf")).extractPdfText(file)
        : await (await import("./lib/importers/docx")).extractDocxText(file);
    // eslint-disable-next-line no-console
    console.log("[Import] Raw extracted text (before heuristic parsing):\n" + text);
    const { parseResumeText } = await import("./lib/importers/heuristics");
    const data = parseResumeText(text);
    editor.value = JSON.stringify(data, null, 2);
    render();
    showInfo(`Imported from "${file.name}" — review dates and sections below, they may need correcting.`);
  } catch (err) {
    showError(err instanceof Error ? err.message : "Couldn't read that file. Try Load JSON with a .json file instead.");
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

function setActiveTab(tab: "edit" | "preview"): void {
  const isEdit = tab === "edit";
  tabEdit.classList.toggle("is-active", isEdit);
  tabEdit.setAttribute("aria-selected", String(isEdit));
  tabPreview.classList.toggle("is-active", !isEdit);
  tabPreview.setAttribute("aria-selected", String(!isEdit));
  layout.classList.toggle("show-edit", isEdit);
  layout.classList.toggle("show-preview", !isEdit);
}

tabEdit.addEventListener("click", () => setActiveTab("edit"));
tabPreview.addEventListener("click", () => setActiveTab("preview"));

setActiveTab("edit");
render();

if ("serviceWorker" in navigator) {
  import("virtual:pwa-register").then(({ registerSW }) => registerSW({ immediate: true }));
}
