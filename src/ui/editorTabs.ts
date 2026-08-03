import { validateResumeJson } from "../lib/validate";
import { renderFormEditor } from "../lib/formEditor";
import { editor, render, showInfo } from "./editorCore";

const tabEdit = document.getElementById("tab-edit") as HTMLButtonElement;
const tabPreview = document.getElementById("tab-preview") as HTMLButtonElement;
const layout = document.querySelector(".layout") as HTMLElement;

const editorWrap = document.querySelector(".editor-wrap") as HTMLElement;
const formEditorPane = document.getElementById("form-editor") as HTMLDivElement;
const tabSource = document.getElementById("tab-source") as HTMLButtonElement;
const tabForm = document.getElementById("tab-form") as HTMLButtonElement;

export function setActiveTab(tab: "edit" | "preview"): void {
  const isEdit = tab === "edit";
  tabEdit.classList.toggle("is-active", isEdit);
  tabEdit.setAttribute("aria-selected", String(isEdit));
  tabPreview.classList.toggle("is-active", !isEdit);
  tabPreview.setAttribute("aria-selected", String(!isEdit));
  layout.classList.toggle("show-edit", isEdit);
  layout.classList.toggle("show-preview", !isEdit);
}

/**
 * Switches the left panel between the raw JSON textarea and a generated form. The form is just
 * another way to produce the same JSON text — switching TO Form re-parses the current editor
 * text fresh (so manual edits are always picked up), and every form edit writes straight back
 * into `editor.value` and calls `render()`, the same as typing would. No separate state.
 */
export function setActiveEditorTab(tab: "source" | "form"): void {
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

export function isFormTabActive(): boolean {
  return !formEditorPane.hidden;
}

/** Finds the Form editor's field for a preview field's `data-path` (e.g.
 * "sections.0.items.1.highlights.2") — an exact `data-form-path` match, or, for the combined
 * highlights textarea (one field standing in for a whole highlights *list*), the longest
 * `data-form-path` that's a prefix of `path`. */
export function findFormField(path: string): HTMLElement | null {
  let best: HTMLElement | null = null;
  let bestLength = -1;
  for (const el of formEditorPane.querySelectorAll<HTMLElement>("[data-form-path]")) {
    const candidate = el.dataset.formPath ?? "";
    const matches = path === candidate || path.startsWith(`${candidate}.`);
    if (matches && candidate.length > bestLength) {
      best = el;
      bestLength = candidate.length;
    }
  }
  return best;
}

/** Loads a full replacement of the resume text (restore, import) and refreshes whichever view
 * — Source or Form — is currently showing. render() alone only updates the JSON textarea/preview;
 * the Form pane is only rebuilt by setActiveEditorTab, so it goes stale after a wholesale
 * replacement unless explicitly refreshed too. */
export function loadResumeText(text: string): void {
  editor.value = text;
  render();
  setActiveEditorTab(formEditorPane.hidden ? "source" : "form");
}

export function initEditorTabs(): void {
  tabEdit.addEventListener("click", () => setActiveTab("edit"));
  tabPreview.addEventListener("click", () => setActiveTab("preview"));
  tabSource.addEventListener("click", () => setActiveEditorTab("source"));
  tabForm.addEventListener("click", () => setActiveEditorTab("form"));
}
