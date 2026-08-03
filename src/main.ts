import "./styles/app.css";
import { templates, getTemplate } from "./templates";
import { validateResumeJson } from "./lib/validate";
import {
  loadSavedResumeText,
  saveResumeText,
  downloadTextFile,
  readFileAsText,
  loadSavedTemplateId,
  saveTemplateId,
} from "./lib/storage";
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
import { renderFormEditor } from "./lib/formEditor";
import { htmlToMarkup } from "./lib/inlineMarkup";
import { setAtPath } from "./lib/jsonPath";
import { checkpoint, loadHistory, type HistoryEntry } from "./lib/history";
import { diffLines } from "./lib/diffLines";
import sampleResume from "./data/sample-resume.json";

const editor = document.getElementById("json-editor") as HTMLTextAreaElement;
const lineNumbers = document.getElementById("line-numbers") as HTMLDivElement;
const errorLineHighlight = document.getElementById("error-line-highlight") as HTMLDivElement;
const preview = document.getElementById("preview") as HTMLDivElement;
const previewPane = document.getElementById("preview-pane") as HTMLElement;
const page = document.getElementById("page") as HTMLDivElement;
const pageScaleWrapper = document.getElementById("page-scale-wrapper") as HTMLDivElement;
const errorBanner = document.getElementById("error-banner") as HTMLDivElement;
const infoBanner = document.getElementById("info-banner") as HTMLDivElement;
const infoBannerText = document.getElementById("info-banner-text") as HTMLSpanElement;
const infoBannerClose = document.getElementById("info-banner-close") as HTMLButtonElement;
const loadJsonBtn = document.getElementById("load-json-btn") as HTMLButtonElement;
const loadJsonInput = document.getElementById("load-json-input") as HTMLInputElement;
const downloadJsonBtn = document.getElementById("download-json-btn") as HTMLButtonElement;
const exportPdfBtn = document.getElementById("export-pdf-btn") as HTMLButtonElement;
const tabEdit = document.getElementById("tab-edit") as HTMLButtonElement;
const tabPreview = document.getElementById("tab-preview") as HTMLButtonElement;
const layout = document.querySelector(".layout") as HTMLElement;

const editorWrap = document.querySelector(".editor-wrap") as HTMLElement;
const formEditorPane = document.getElementById("form-editor") as HTMLDivElement;
const tabSource = document.getElementById("tab-source") as HTMLButtonElement;
const tabForm = document.getElementById("tab-form") as HTMLButtonElement;

const formatToolbar = document.getElementById("format-toolbar") as HTMLDivElement;

const templateSelect = document.getElementById("template-select") as HTMLSelectElement;
const customizeBtn = document.getElementById("customize-btn") as HTMLButtonElement;
const styleDialog = document.getElementById("style-dialog") as HTMLDialogElement;
const styleDialogHeader = document.getElementById("style-dialog-header") as HTMLDivElement;

const versionSelect = document.getElementById("version-select") as HTMLSelectElement;
const saveVersionBtn = document.getElementById("save-version-btn") as HTMLButtonElement;
const historyDialog = document.getElementById("history-dialog") as HTMLDialogElement;
const historyDialogHeader = document.getElementById("history-dialog-header") as HTMLDivElement;
const historyDiff = document.getElementById("history-diff") as HTMLDivElement;
const historyRestoreBtn = document.getElementById("history-restore-btn") as HTMLButtonElement;
const styleResetBtn = document.getElementById("style-reset-btn") as HTMLButtonElement;
const styleAutofitBtn = document.getElementById("style-autofit-btn") as HTMLButtonElement;
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
  if (e.key !== "Escape") return;
  if (styleDialog.open) styleDialog.close();
  if (historyDialog.open) historyDialog.close();
});

/** Makes a non-modal `.show()` dialog draggable by its header — shared by every floating panel. */
function makeDialogDraggable(dialog: HTMLDialogElement, header: HTMLElement): void {
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  function onDragMove(e: PointerEvent): void {
    const x = Math.min(Math.max(e.clientX - dragOffsetX, 0), window.innerWidth - dialog.offsetWidth);
    const y = Math.min(Math.max(e.clientY - dragOffsetY, 0), window.innerHeight - dialog.offsetHeight);
    dialog.style.left = `${x}px`;
    dialog.style.top = `${y}px`;
  }

  function onDragEnd(): void {
    header.classList.remove("is-dragging");
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", onDragEnd);
  }

  header.addEventListener("pointerdown", (e) => {
    const rect = dialog.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    header.classList.add("is-dragging");
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragEnd);
  });
}

makeDialogDraggable(styleDialog, styleDialogHeader);
makeDialogDraggable(historyDialog, historyDialogHeader);

function formatHistoryLabel(entry: HistoryEntry): string {
  return new Date(entry.savedAt).toLocaleString();
}

/** Rebuilds the topbar version dropdown from saved history — newest first, indices into the
 * underlying (oldest-first) array so diff/restore can look an entry up directly. Always keeps
 * the placeholder option so re-selecting the same version later still fires a "change" event. */
function refreshVersionSelect(): void {
  const history = loadHistory();
  const options = ['<option value="" selected disabled hidden>Versions</option>'];
  for (let i = history.length - 1; i >= 0; i--) {
    options.push(`<option value="${i}">${escapeHtml(formatHistoryLabel(history[i]))}</option>`);
  }
  versionSelect.innerHTML = options.join("");
}

/** Renders a diff of the selected past version against the current editor content and opens
 * the comparison dialog. */
function showVersionDiff(index: number): void {
  const entry = loadHistory()[index];
  if (!entry) return;

  historyDiff.innerHTML = "";
  for (const op of diffLines(entry.text, editor.value)) {
    const lineEl = document.createElement("div");
    lineEl.className = `diff-line diff-${op.type}`;
    const prefix = op.type === "add" ? "+ " : op.type === "remove" ? "- " : "  ";
    lineEl.textContent = prefix + op.line;
    historyDiff.appendChild(lineEl);
  }
  historyDialog.show();
}

versionSelect.addEventListener("change", () => {
  if (versionSelect.value === "") return;
  showVersionDiff(Number(versionSelect.value));
});

// Reset to the placeholder whenever the dialog closes (Escape, Done, or after Restore) so
// picking the same version again later still triggers "change".
historyDialog.addEventListener("close", () => {
  versionSelect.value = "";
});

historyRestoreBtn.addEventListener("click", () => {
  const entry = loadHistory()[Number(versionSelect.value)];
  if (!entry) return;
  editor.value = entry.text;
  render();
  historyDialog.close();
  // Explicit, not just relying on the "close" listener above — the reset needs to be reliable
  // right after a restore, since re-selecting the same (now-current) version should be a no-op
  // rather than silently doing nothing because the <select> never changed value.
  versionSelect.value = "";
});

saveVersionBtn.addEventListener("click", () => {
  const saved = checkpoint(editor.value);
  refreshVersionSelect();
  showInfo(saved ? "Version saved." : "Nothing's changed since your last save.");
});

refreshVersionSelect();

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

const MM_PER_IN = 25.4;
const PX_PER_MM = 96 / MM_PER_IN;
const AUTO_FIT_FLOOR = { spacingScale: 0.5, lineHeight: 1, sizeScale: 0.7 };

/** Scales spacing/line-height/font-size together by `factor`, never below each control's own slider minimum. */
function scaledStylePrefs(base: StylePrefs, factor: number): StylePrefs {
  const candidate = structuredClone(base);
  candidate.spacingScale = Math.max(AUTO_FIT_FLOOR.spacingScale, base.spacingScale * factor);
  candidate.lineHeight = Math.max(AUTO_FIT_FLOOR.lineHeight, base.lineHeight * factor);
  for (const key of ["header", "heading", "body"] as const) {
    candidate[key].sizeScale = Math.max(AUTO_FIT_FLOOR.sizeScale, base[key].sizeScale * factor);
  }
  return candidate;
}

styleAutofitBtn.addEventListener("click", () => {
  const original = structuredClone(stylePrefs);
  const targetHeightPx = (297 - 2 * original.marginIn * MM_PER_IN) * PX_PER_MM;

  let bestFit = original;
  let fitted = false;
  let firstTryFits = false;
  for (let factor = 1; factor >= 0.6 - 1e-9; factor -= 0.05) {
    const candidate = scaledStylePrefs(original, factor);
    applyStylePrefs(previewPane, candidate);
    bestFit = candidate;
    const fits = preview.scrollHeight <= targetHeightPx;
    if (factor === 1) firstTryFits = fits;
    if (fits) {
      fitted = true;
      break;
    }
  }

  stylePrefs = bestFit;
  syncStyleControlsFromPrefs();
  applyAndSaveStylePrefs();
  updatePageScale();

  if (firstTryFits) {
    showInfo("Already fits on one page.");
  } else if (!fitted) {
    showInfo("Shrunk as much as readable, but it still doesn't fully fit one page — consider trimming content.");
  } else {
    showInfo("Resized to fit one page.");
  }
});

templateSelect.innerHTML = templates
  .map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`)
  .join("");

let currentTemplateId = getTemplate(loadSavedTemplateId() ?? "").id;
templateSelect.value = currentTemplateId;

templateSelect.addEventListener("change", () => {
  currentTemplateId = getTemplate(templateSelect.value).id;
  saveTemplateId(currentTemplateId);
  render();
});

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
    infoBannerText.textContent = message;
    infoBanner.hidden = false;
  } else {
    infoBanner.hidden = true;
  }
}

infoBannerClose.addEventListener("click", () => showInfo(null));

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

/**
 * Keeps .page at true A4 proportions regardless of the pane's width, shrinking it (never
 * enlarging past 100%) to fit narrower panes via a CSS transform. .page-scale-wrapper is sized
 * in JS to match the *scaled* footprint so the scrollable pane doesn't reserve dead space below
 * a page that's been shrunk — transforms don't affect layout flow on their own.
 */
function updatePageScale(): void {
  page.style.transform = "";
  const naturalWidth = page.offsetWidth;
  const naturalHeight = page.offsetHeight;
  const availableWidth = previewPane.clientWidth - 24;
  const scale = Math.min(1, availableWidth / naturalWidth);
  page.style.transform = scale < 1 ? `scale(${scale})` : "";
  pageScaleWrapper.style.width = `${naturalWidth * scale}px`;
  pageScaleWrapper.style.height = `${naturalHeight * scale}px`;
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
  updatePageScale();
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

/**
 * Switches the left panel between the raw JSON textarea and a generated form. The form is just
 * another way to produce the same JSON text — switching TO Form re-parses the current editor
 * text fresh (so manual edits are always picked up), and every form edit writes straight back
 * into `editor.value` and calls `render()`, the same as typing would. No separate state.
 */
function setActiveEditorTab(tab: "source" | "form"): void {
  const isSource = tab === "source";
  tabSource.classList.toggle("is-active", isSource);
  tabSource.setAttribute("aria-selected", String(isSource));
  tabForm.classList.toggle("is-active", !isSource);
  tabForm.setAttribute("aria-selected", String(!isSource));
  editorWrap.hidden = !isSource;
  formEditorPane.hidden = isSource;

  if (isSource) return;

  const result = validateResumeJson(editor.value);
  if (!result.ok) {
    formEditorPane.innerHTML = "";
    const message = document.createElement("p");
    message.className = "form-editor-error";
    message.textContent = "Fix the JSON error in the JSON view first, then switch back to Form.";
    formEditorPane.appendChild(message);
    return;
  }

  renderFormEditor(
    formEditorPane,
    result.data,
    (updated) => {
      editor.value = JSON.stringify(updated, null, 2);
      render();
    },
    showInfo,
  );
}

tabSource.addEventListener("click", () => setActiveEditorTab("source"));
tabForm.addEventListener("click", () => setActiveEditorTab("form"));

/** Walks up from `node` to find the nearest ancestor (within #preview) carrying a `data-path` —
 * the leaf prose elements the template tags as editable (summary, highlight bullets, text
 * sections). Returns null for selections outside any editable field (headings, dates, chrome). */
function getEditablePathElement(node: Node | null): HTMLElement | null {
  let el = node instanceof HTMLElement ? node : node?.parentElement ?? null;
  while (el && el !== preview) {
    if (el.hasAttribute("data-path")) return el;
    el = el.parentElement;
  }
  return null;
}

/** Writes an edited field's current markup back into the resume JSON and re-renders — same
 * write-through-Source model as the Form editor, so this never becomes a second source of truth. */
function commitEditableChange(target: HTMLElement): void {
  const path = target.getAttribute("data-path");
  if (!path) return;
  const result = validateResumeJson(editor.value);
  if (!result.ok) return;
  setAtPath(result.data, path, htmlToMarkup(target));
  editor.value = JSON.stringify(result.data, null, 2);
  render();
  formatToolbar.hidden = true;
}

function updateFormatToolbar(): void {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    formatToolbar.hidden = true;
    return;
  }
  const range = selection.getRangeAt(0);
  const target = getEditablePathElement(range.commonAncestorContainer);
  if (!target || !range.toString()) {
    formatToolbar.hidden = true;
    return;
  }
  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    formatToolbar.hidden = true;
    return;
  }
  formatToolbar.hidden = false;
  const left = Math.min(
    Math.max(8, rect.left + rect.width / 2 - formatToolbar.offsetWidth / 2),
    window.innerWidth - formatToolbar.offsetWidth - 8,
  );
  const top = Math.max(8, rect.top - formatToolbar.offsetHeight - 8);
  formatToolbar.style.left = `${left}px`;
  formatToolbar.style.top = `${top}px`;
}

document.addEventListener("selectionchange", updateFormatToolbar);

// Prevent the toolbar buttons' mousedown from stealing focus away from the contenteditable field,
// which would collapse the selection before the click handler ever runs.
formatToolbar.addEventListener("mousedown", (e) => e.preventDefault());

formatToolbar.addEventListener("click", (e) => {
  const button = (e.target as HTMLElement).closest("button[data-format]") as HTMLButtonElement | null;
  if (!button) return;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
  const range = selection.getRangeAt(0);
  const target = getEditablePathElement(range.commonAncestorContainer);
  const selectedText = range.toString();
  if (!target || !selectedText) return;

  const format = button.dataset.format;
  const replacement =
    format === "bold" ? `**${selectedText}**` :
    format === "italic" ? `_${selectedText}_` :
    selectedText.replace(/\*\*/g, "").replace(/_/g, "");

  range.deleteContents();
  range.insertNode(document.createTextNode(replacement));
  commitEditableChange(target);
});

// Prose fields hold a single-line string in the JSON, so Enter shouldn't insert a paragraph break.
preview.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && getEditablePathElement(e.target as Node)) e.preventDefault();
});

// focusout (not blur) so this works via event delegation — blur doesn't bubble.
preview.addEventListener("focusout", (e) => {
  const target = getEditablePathElement(e.target as Node);
  if (target) commitEditableChange(target);
});

new ResizeObserver(updatePageScale).observe(previewPane);
window.addEventListener("resize", updatePageScale);

setActiveTab("edit");
render();
setActiveEditorTab("form");

if ("serviceWorker" in navigator) {
  import("virtual:pwa-register").then(({ registerSW }) => registerSW({ immediate: true }));
}
