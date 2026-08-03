import { preview } from "./editorCore";
import { setActiveEditorTab, isFormTabActive, findFormField } from "./editorTabs";

/** Reuses the same flash-highlight the Form editor already gives a row after reordering it — same
 * "look here" purpose, just triggered by a different action. */
const JUMP_HIGHLIGHT_CLASS = "form-just-moved";
const JUMP_HIGHLIGHT_MS = 900;

function jumpToFormField(path: string): void {
  // Switching tabs re-renders the whole Form pane from scratch, which would be wasteful (and
  // would blow away any in-progress edit there) if it's already showing — only switch when it's
  // not, same as clicking the Form tab by hand would.
  if (!isFormTabActive()) setActiveEditorTab("form");

  const field = findFormField(path);
  if (!field) return;
  field.scrollIntoView({ block: "center" });
  field.classList.add(JUMP_HIGHLIGHT_CLASS);
  window.setTimeout(() => field.classList.remove(JUMP_HIGHLIGHT_CLASS), JUMP_HIGHLIGHT_MS);
}

/** Wires clicking/tabbing into an editable preview field (summary, a highlight bullet, a text
 * section) to jump the Form editor to the matching field, so the two views stay visually linked —
 * doesn't move keyboard focus there, just scrolls it into view and flashes it, since the user is
 * still actively working in the preview at that point. */
export function initPreviewFormSync(): void {
  preview.addEventListener("focusin", (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-path]");
    const path = target?.getAttribute("data-path");
    if (path) jumpToFormField(path);
  });
}
