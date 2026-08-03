import { templates, getTemplate } from "../templates";
import { validateResumeJson } from "../lib/validate";
import { loadSavedResumeText, saveResumeText, saveTemplateId } from "../lib/storage";
import { escapeHtml } from "../lib/escapeHtml";
import { applyStylePrefs } from "../lib/stylePrefs";
import sampleResume from "../data/sample-resume.json";
import { appState } from "./appState";

export const editor = document.getElementById("json-editor") as HTMLTextAreaElement;
const lineNumbers = document.getElementById("line-numbers") as HTMLDivElement;
const errorLineHighlight = document.getElementById("error-line-highlight") as HTMLDivElement;
export const preview = document.getElementById("preview") as HTMLDivElement;
export const previewPane = document.getElementById("preview-pane") as HTMLElement;
const page = document.getElementById("page") as HTMLDivElement;
const pageScaleWrapper = document.getElementById("page-scale-wrapper") as HTMLDivElement;
const errorBanner = document.getElementById("error-banner") as HTMLDivElement;
const infoBanner = document.getElementById("info-banner") as HTMLDivElement;
const infoBannerText = document.getElementById("info-banner-text") as HTMLSpanElement;
const infoBannerClose = document.getElementById("info-banner-close") as HTMLButtonElement;
const templateSelect = document.getElementById("template-select") as HTMLSelectElement;

let currentErrorLine: number | null = null;
let previousErrorLine: number | null = null;

export function showError(message: string | null): void {
  if (message) {
    errorBanner.textContent = message;
    errorBanner.hidden = false;
  } else {
    errorBanner.hidden = true;
  }
}

export function showInfo(message: string | null): void {
  if (message) {
    infoBannerText.textContent = message;
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

/**
 * Keeps .page at true A4 proportions regardless of the pane's width, shrinking it (never
 * enlarging past 100%) to fit narrower panes via a CSS transform. .page-scale-wrapper is sized
 * in JS to match the *scaled* footprint so the scrollable pane doesn't reserve dead space below
 * a page that's been shrunk — transforms don't affect layout flow on their own.
 */
export function updatePageScale(): void {
  page.style.transform = "";
  const naturalWidth = page.offsetWidth;
  const naturalHeight = page.offsetHeight;
  const availableWidth = previewPane.clientWidth - 24;
  const scale = Math.min(1, availableWidth / naturalWidth);
  page.style.transform = scale < 1 ? `scale(${scale})` : "";
  pageScaleWrapper.style.width = `${naturalWidth * scale}px`;
  pageScaleWrapper.style.height = `${naturalHeight * scale}px`;
}

export function render(): void {
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
  preview.className = `template-${appState.currentTemplateId}`;
  preview.innerHTML = getTemplate(appState.currentTemplateId).render(result.data);
  applyStylePrefs(previewPane, appState.stylePrefs);
  updatePageScale();
}

/** Wires the JSON textarea, line numbers, error/info banners, template dropdown, and page-scale
 * listeners, and loads the saved (or sample) resume text into the editor. Must run before any
 * other init*() that reads `editor.value` or calls `render()`. */
export function initEditorCore(): void {
  templateSelect.innerHTML = templates
    .map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`)
    .join("");
  templateSelect.value = appState.currentTemplateId;

  templateSelect.addEventListener("change", () => {
    appState.currentTemplateId = getTemplate(templateSelect.value).id;
    saveTemplateId(appState.currentTemplateId);
    render();
  });

  editor.value = loadSavedResumeText() ?? JSON.stringify(sampleResume, null, 2);

  infoBannerClose.addEventListener("click", () => showInfo(null));

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

  new ResizeObserver(updatePageScale).observe(previewPane);
  window.addEventListener("resize", updatePageScale);
}
