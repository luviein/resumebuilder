import { validateResumeJson } from "../lib/validate";
import { htmlToMarkup, htmlToRuns, runsToMarkup, type InlineFormat, type InlineRun } from "../lib/inlineMarkup";
import { setAtPath } from "../lib/jsonPath";
import { editor, preview, render } from "./editorCore";

const formatToolbar = document.getElementById("format-toolbar") as HTMLDivElement;

/** Walks up from `node` to find the nearest ancestor (within #preview) carrying a `data-path` —
 * the leaf prose elements the template tags as editable (summary, highlight bullets, text
 * sections). Returns null for selections outside any editable field (headings, dates, chrome). */
function getEditablePathElement(node: Node | null): HTMLElement | null {
  let el = node instanceof HTMLElement ? node : (node?.parentElement ?? null);
  while (el && el !== preview) {
    if (el.hasAttribute("data-path")) return el;
    el = el.parentElement;
  }
  return null;
}

// Toolbar buttons deliberately keep focus on the contenteditable field they're formatting (see
// preventFocusSteal below), so it's still focused when commitFieldMarkup's render() replaces
// #preview's contents. Removing a focused element fires a synthetic focusout on it, which would
// otherwise re-enter commitEditableChange and read that (now-stale, about-to-be-replaced) DOM,
// silently reverting the change this same call just wrote. Suppressed only around that render()
// — a *genuine* focusout (the user clicking elsewhere) has already moved focus off the field
// before its own render() runs, so it never re-triggers this way and doesn't need suppressing.
let suppressFocusoutCommit = false;

/** Writes `markup` back into the resume JSON at `target`'s field and re-renders. */
function commitFieldMarkup(target: HTMLElement, markup: string): void {
  const path = target.getAttribute("data-path");
  if (!path) return;
  const result = validateResumeJson(editor.value);
  if (!result.ok) return;
  setAtPath(result.data, path, markup);
  editor.value = JSON.stringify(result.data, null, 2);
  suppressFocusoutCommit = true;
  render();
  suppressFocusoutCommit = false;
  formatToolbar.hidden = true;
}

/** Writes an edited field's current markup back into the resume JSON and re-renders — same
 * write-through-Source model as the Form editor, so this never becomes a second source of truth. */
function commitEditableChange(target: HTMLElement): void {
  commitFieldMarkup(target, htmlToMarkup(target));
}

/** Offset (in `root`'s flattened plain text) of the point `node`+`offset` in the live DOM —
 * the same coordinate space `htmlToRuns`' run lengths are measured in, so a selection can be
 * mapped onto the runs it covers regardless of which text node/element it actually landed in. */
function plainTextOffset(root: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(node, offset);
  return range.toString().length;
}

/** Splits `runs` so that every `offsets` position falls exactly on a run boundary, dropping any
 * now-empty runs the split produces. */
function splitRunsAtOffsets(runs: readonly InlineRun[], offsets: readonly number[]): InlineRun[] {
  const cuts = [...new Set(offsets)].sort((a, b) => a - b);
  const result: InlineRun[] = [];
  let pos = 0;
  for (const run of runs) {
    let text = run.text;
    let start = pos;
    for (const cut of cuts) {
      if (cut <= start || cut >= start + text.length) continue;
      const local = cut - start;
      result.push({ text: text.slice(0, local), formats: run.formats });
      text = text.slice(local);
      start = cut;
    }
    result.push({ text, formats: run.formats });
    pos += run.text.length;
  }
  return result.filter((r) => r.text.length > 0);
}

/**
 * Recomputes `target`'s full markup with `action` applied to the [start, end) plain-text range.
 * Operates on the field's markup as a string (split into runs, act on the ones the selection
 * covers, reassemble) rather than mutating the live DOM — the DOM already contains <strong>/<em>
 * wrappers around any previously-formatted text in the selection, and directly inserting new
 * marker characters via Range.insertNode left them trapped inside those wrappers, silently
 * failing to un-format text and corrupting the markup on repeated clicks. "bold"/"italic" toggle:
 * if every run touched by the selection already has that format, it's removed from all of them;
 * otherwise it's added to all of them (so a mixed-state selection becomes fully formatted, same
 * as most rich text editors) — which also means bold and italic combine correctly, since they're
 * independent entries in each run's format set.
 */
function applyFormatToSelection(
  target: HTMLElement,
  start: number,
  end: number,
  action: InlineFormat | "reset",
): string {
  const runs = splitRunsAtOffsets(htmlToRuns(target), [start, end]);

  let pos = 0;
  const withRange = runs.map((run) => {
    const runStart = pos;
    pos += run.text.length;
    return { run, inSelection: runStart >= start && pos <= end && pos > runStart };
  });

  if (action === "reset") {
    return runsToMarkup(
      withRange.map(({ run, inSelection }) =>
        inSelection ? { text: run.text, formats: new Set<InlineFormat>() } : run,
      ),
    );
  }

  const touched = withRange.filter((r) => r.inSelection).map((r) => r.run);
  const alreadyApplied = touched.length > 0 && touched.every((r) => r.formats.has(action));

  return runsToMarkup(
    withRange.map(({ run, inSelection }) => {
      if (!inSelection) return run;
      const formats = new Set(run.formats);
      if (alreadyApplied) formats.delete(action);
      else formats.add(action);
      return { text: run.text, formats };
    }),
  );
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

  // Prevent the toolbar buttons' mousedown/touchstart from stealing focus away from the
  // contenteditable field, which would collapse the selection before the click handler ever runs.
  // Both events are needed: touch input clears the selection at touchstart, before any synthetic
  // mousedown fires, so listening for mousedown alone doesn't stop it on touch devices.
  const preventFocusSteal = (e: Event): void => e.preventDefault();
  formatToolbar.addEventListener("mousedown", preventFocusSteal);
  formatToolbar.addEventListener("touchstart", preventFocusSteal, { passive: false });

  formatToolbar.addEventListener("click", (e) => {
    const button = (e.target as HTMLElement).closest("button[data-format]") as HTMLButtonElement | null;
    if (!button) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    const target = getEditablePathElement(range.commonAncestorContainer);
    if (!target || !range.toString()) return;

    const start = plainTextOffset(target, range.startContainer, range.startOffset);
    const end = plainTextOffset(target, range.endContainer, range.endOffset);
    const action = button.dataset.format as InlineFormat | "reset";

    commitFieldMarkup(target, applyFormatToSelection(target, start, end, action));
  });

  // Prose fields hold a single-line string in the JSON, so Enter shouldn't insert a paragraph break.
  preview.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && getEditablePathElement(e.target as Node)) e.preventDefault();
  });

  // focusout (not blur) so this works via event delegation — blur doesn't bubble.
  preview.addEventListener("focusout", (e) => {
    if (suppressFocusoutCommit) return;
    const target = getEditablePathElement(e.target as Node);
    if (target) commitEditableChange(target);
  });
}
