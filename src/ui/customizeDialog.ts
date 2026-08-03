import {
  DEFAULT_STYLE_PREFS,
  FONT_OPTIONS,
  saveStylePrefs,
  applyStylePrefs,
  type StylePrefs,
  type SectionStyle,
} from "../lib/stylePrefs";
import { escapeHtml } from "../lib/escapeHtml";
import { appState } from "./appState";
import { preview, previewPane, showInfo, updatePageScale } from "./editorCore";
import { makeDialogDraggable, closeOnEscape } from "./dialogUtils";

const customizeBtn = document.getElementById("customize-btn") as HTMLButtonElement;
const styleDialog = document.getElementById("style-dialog") as HTMLDialogElement;
const styleDialogHeader = document.getElementById("style-dialog-header") as HTMLDivElement;

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

function syncStyleControlsFromPrefs(): void {
  const stylePrefs = appState.stylePrefs;
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
  applyStylePrefs(previewPane, appState.stylePrefs);
  saveStylePrefs(appState.stylePrefs);
}

const MM_PER_IN = 25.4;
const PX_PER_MM = 96 / MM_PER_IN;
const AUTO_FIT_FLOOR = { spacingScale: 0.5, lineHeight: 1, sizeScale: 0.7 };

/** Rounds to 2 decimal places — matches the sliders' own step="0.05" precision and avoids
 * floating-point artifacts (e.g. 1.45 * 0.75 === 1.0874999999999999) leaking into the display. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Scales spacing/line-height/font-size together by `factor`, never below each control's own slider minimum. */
function scaledStylePrefs(base: StylePrefs, factor: number): StylePrefs {
  const candidate = structuredClone(base);
  candidate.spacingScale = round2(Math.max(AUTO_FIT_FLOOR.spacingScale, base.spacingScale * factor));
  candidate.lineHeight = round2(Math.max(AUTO_FIT_FLOOR.lineHeight, base.lineHeight * factor));
  for (const key of ["header", "heading", "body"] as const) {
    candidate[key].sizeScale = round2(Math.max(AUTO_FIT_FLOOR.sizeScale, base[key].sizeScale * factor));
  }
  return candidate;
}

export function initCustomizeDialog(): void {
  applyStylePrefs(previewPane, appState.stylePrefs);

  customizeBtn.addEventListener("click", () => {
    syncStyleControlsFromPrefs();
    // Non-modal (.show(), not .showModal()): no dimming backdrop, so the live preview stays fully
    // visible and interactive while the panel is open.
    styleDialog.show();
  });

  makeDialogDraggable(styleDialog, styleDialogHeader);
  closeOnEscape(styleDialog);

  styleMarginInput.addEventListener("input", () => {
    appState.stylePrefs.marginIn = Number(styleMarginInput.value);
    styleMarginValue.textContent = `${appState.stylePrefs.marginIn}in`;
    applyAndSaveStylePrefs();
  });

  styleSpacingInput.addEventListener("input", () => {
    appState.stylePrefs.spacingScale = Number(styleSpacingInput.value);
    styleSpacingValue.textContent = `${Math.round(appState.stylePrefs.spacingScale * 100)}%`;
    applyAndSaveStylePrefs();
  });

  styleLineHeightInput.addEventListener("input", () => {
    appState.stylePrefs.lineHeight = Number(styleLineHeightInput.value);
    styleLineHeightValue.textContent = String(appState.stylePrefs.lineHeight);
    applyAndSaveStylePrefs();
  });

  for (const key of ["header", "heading", "body"] as const) {
    const controls = sectionControls[key];

    controls.font.addEventListener("change", () => {
      appState.stylePrefs[key].font = controls.font.value;
      applyAndSaveStylePrefs();
    });

    controls.size.addEventListener("input", () => {
      const section: SectionStyle = appState.stylePrefs[key];
      section.sizeScale = Number(controls.size.value);
      controls.sizeValue.textContent = `${Math.round(section.sizeScale * 100)}%`;
      applyAndSaveStylePrefs();
    });

    controls.color.addEventListener("input", () => {
      appState.stylePrefs[key].color = controls.color.value;
      applyAndSaveStylePrefs();
    });
  }

  styleResetBtn.addEventListener("click", () => {
    appState.stylePrefs = structuredClone(DEFAULT_STYLE_PREFS);
    syncStyleControlsFromPrefs();
    applyAndSaveStylePrefs();
  });

  styleAutofitBtn.addEventListener("click", () => {
    const original = structuredClone(appState.stylePrefs);
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

    appState.stylePrefs = bestFit;
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
}
