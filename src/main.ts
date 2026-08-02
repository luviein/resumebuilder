import "./styles/app.css";
import { templates, getTemplate } from "./templates";
import { validateResumeJson } from "./lib/validate";
import {
  loadSavedResumeText,
  saveResumeText,
  loadSavedTemplateId,
  saveTemplateId,
  downloadTextFile,
  readFileAsText,
} from "./lib/storage";
import { exportToPdf } from "./lib/print";
import sampleResume from "./data/sample-resume.json";

const editor = document.getElementById("json-editor") as HTMLTextAreaElement;
const lineNumbers = document.getElementById("line-numbers") as HTMLDivElement;
const preview = document.getElementById("preview") as HTMLDivElement;
const errorBanner = document.getElementById("error-banner") as HTMLDivElement;
const templateSelect = document.getElementById("template-select") as HTMLSelectElement;
const loadJsonBtn = document.getElementById("load-json-btn") as HTMLButtonElement;
const loadJsonInput = document.getElementById("load-json-input") as HTMLInputElement;
const downloadJsonBtn = document.getElementById("download-json-btn") as HTMLButtonElement;
const exportPdfBtn = document.getElementById("export-pdf-btn") as HTMLButtonElement;
const tabEdit = document.getElementById("tab-edit") as HTMLButtonElement;
const tabPreview = document.getElementById("tab-preview") as HTMLButtonElement;
const layout = document.querySelector(".layout") as HTMLElement;

let currentTemplateId = loadSavedTemplateId() ?? templates[0].id;

templateSelect.innerHTML = templates
  .map((t) => `<option value="${t.id}">${t.name}</option>`)
  .join("");
templateSelect.value = currentTemplateId;

editor.value = loadSavedResumeText() ?? JSON.stringify(sampleResume, null, 2);

let currentErrorLine: number | null = null;

function showError(message: string | null): void {
  if (message) {
    errorBanner.textContent = message;
    errorBanner.hidden = false;
  } else {
    errorBanner.hidden = true;
  }
}

/** V8's JSON.parse error messages include "line N column M" — pull the line number out for the gutter. */
function extractErrorLine(message: string): number | null {
  const match = /line (\d+)/i.exec(message);
  return match ? Number(match[1]) : null;
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

function render(): void {
  const result = validateResumeJson(editor.value);
  if (!result.ok) {
    showError(result.error);
    currentErrorLine = extractErrorLine(result.error);
    renderLineNumbers(currentErrorLine);
    return;
  }
  showError(null);
  currentErrorLine = null;
  renderLineNumbers(null);
  saveResumeText(editor.value);
  preview.className = `template-${currentTemplateId}`;
  preview.innerHTML = getTemplate(currentTemplateId).render(result.data);
}

let debounceHandle: number | undefined;
editor.addEventListener("input", () => {
  renderLineNumbers(currentErrorLine);
  window.clearTimeout(debounceHandle);
  debounceHandle = window.setTimeout(render, 300);
});

editor.addEventListener("scroll", () => {
  lineNumbers.scrollTop = editor.scrollTop;
});

errorBanner.addEventListener("click", () => {
  if (currentErrorLine != null) scrollToLine(currentErrorLine);
});

templateSelect.addEventListener("change", () => {
  currentTemplateId = templateSelect.value;
  saveTemplateId(currentTemplateId);
  render();
});

loadJsonBtn.addEventListener("click", () => loadJsonInput.click());

loadJsonInput.addEventListener("change", async () => {
  const file = loadJsonInput.files?.[0];
  if (!file) return;
  editor.value = await readFileAsText(file);
  loadJsonInput.value = "";
  render();
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
