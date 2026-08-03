import { loadStylePrefs, type StylePrefs } from "../lib/stylePrefs";
import { getTemplate } from "../templates";
import { loadSavedTemplateId } from "../lib/storage";

/**
 * The handful of pieces of state that cross module boundaries (style prefs are read by the
 * render pipeline but written by the Customize dialog; the template id is read by the render
 * pipeline but written by its own dropdown). A single mutable object, not separate module-level
 * `let`s, since other modules can freely mutate an imported object's properties but can't
 * reassign an imported `let` binding.
 */
export const appState = {
  stylePrefs: loadStylePrefs() as StylePrefs,
  currentTemplateId: getTemplate(loadSavedTemplateId() ?? "").id,
};
