import { checkpoint, loadHistory, type HistoryEntry } from "../lib/history";
import { diffLines } from "../lib/diffLines";
import { escapeHtml } from "../lib/escapeHtml";
import { editor, showInfo } from "./editorCore";
import { loadResumeText } from "./editorTabs";
import { makeDialogDraggable, closeOnEscape } from "./dialogUtils";

const versionSelect = document.getElementById("version-select") as HTMLSelectElement;
const versionNameInput = document.getElementById("version-name-input") as HTMLInputElement;
const saveVersionBtn = document.getElementById("save-version-btn") as HTMLButtonElement;
const historyDialog = document.getElementById("history-dialog") as HTMLDialogElement;
const historyDialogHeader = document.getElementById("history-dialog-header") as HTMLDivElement;
const historyDiff = document.getElementById("history-diff") as HTMLDivElement;
const historyRestoreBtn = document.getElementById("history-restore-btn") as HTMLButtonElement;

function formatHistoryLabel(entry: HistoryEntry): string {
  const timestamp = new Date(entry.savedAt).toLocaleString();
  return entry.label ? `${entry.label} (${timestamp})` : timestamp;
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

function saveVersion(): void {
  const label = versionNameInput.value.trim();
  const saved = checkpoint(editor.value, label || undefined);
  versionNameInput.value = "";
  refreshVersionSelect();
  showInfo(saved ? "Version saved." : "Nothing's changed since your last save.");
}

export function initHistoryDialog(): void {
  makeDialogDraggable(historyDialog, historyDialogHeader);
  closeOnEscape(historyDialog);

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
    loadResumeText(entry.text);
    historyDialog.close();
    // Explicit, not just relying on the "close" listener above — the reset needs to be reliable
    // right after a restore, since re-selecting the same (now-current) version should be a no-op
    // rather than silently doing nothing because the <select> never changed value.
    versionSelect.value = "";
  });

  saveVersionBtn.addEventListener("click", saveVersion);

  versionNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveVersion();
  });

  refreshVersionSelect();
}
