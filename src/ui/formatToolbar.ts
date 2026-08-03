import { validateResumeJson } from "../lib/validate";
import { htmlToMarkup } from "../lib/inlineMarkup";
import { setAtPath } from "../lib/jsonPath";
import { editor, preview, render } from "./editorCore";

const formatToolbar = document.getElementById("format-toolbar") as HTMLDivElement;

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

export function initFormatToolbar(): void {
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
}
