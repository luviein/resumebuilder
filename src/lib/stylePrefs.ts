const STORAGE_KEY = "resume-builder:style-prefs";

export interface SectionStyle {
  font: string;
  sizeScale: number;
  color: string;
}

export interface StylePrefs {
  marginIn: number;
  spacingScale: number;
  lineHeight: number;
  header: SectionStyle;
  heading: SectionStyle;
  body: SectionStyle;
}

const DEFAULT_FONT = 'Georgia, "Times New Roman", serif';

export const DEFAULT_STYLE_PREFS: StylePrefs = {
  marginIn: 0.75,
  spacingScale: 1,
  lineHeight: 1.45,
  header: { font: DEFAULT_FONT, sizeScale: 1, color: "#1a1a1a" },
  heading: { font: DEFAULT_FONT, sizeScale: 1, color: "#1a1a1a" },
  body: { font: DEFAULT_FONT, sizeScale: 1, color: "#1a1a1a" },
};

/** Curated web-safe, print-reliable fonts only — no custom font loading, keeps the app offline and ATS-safe. */
export const FONT_OPTIONS = [
  { label: "Georgia", value: 'Georgia, "Times New Roman", serif' },
  { label: "Times New Roman", value: '"Times New Roman", Times, serif' },
  { label: "Garamond", value: "Garamond, Cambria, serif" },
  { label: "Cambria", value: "Cambria, Georgia, serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Calibri", value: "Calibri, Carlito, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Trebuchet MS", value: '"Trebuchet MS", sans-serif' },
  { label: "System UI", value: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
];

export function loadStylePrefs(): StylePrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STYLE_PREFS);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULT_STYLE_PREFS),
      ...parsed,
      header: { ...DEFAULT_STYLE_PREFS.header, ...parsed.header },
      heading: { ...DEFAULT_STYLE_PREFS.heading, ...parsed.heading },
      body: { ...DEFAULT_STYLE_PREFS.body, ...parsed.body },
    };
  } catch {
    return structuredClone(DEFAULT_STYLE_PREFS);
  }
}

export function saveStylePrefs(prefs: StylePrefs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

/** Applies style prefs as CSS custom properties on `el`, cascading to every descendant (screen and print alike). */
export function applyStylePrefs(el: HTMLElement, prefs: StylePrefs): void {
  el.style.setProperty("--resume-margin", `${prefs.marginIn}in`);
  el.style.setProperty("--resume-spacing-scale", String(prefs.spacingScale));
  el.style.setProperty("--resume-line-height", String(prefs.lineHeight));

  el.style.setProperty("--resume-font-header", prefs.header.font);
  el.style.setProperty("--resume-size-header", String(prefs.header.sizeScale));
  el.style.setProperty("--resume-color-header", prefs.header.color);

  el.style.setProperty("--resume-font-heading", prefs.heading.font);
  el.style.setProperty("--resume-size-heading", String(prefs.heading.sizeScale));
  el.style.setProperty("--resume-color-heading", prefs.heading.color);

  el.style.setProperty("--resume-font-body", prefs.body.font);
  el.style.setProperty("--resume-size-body", String(prefs.body.sizeScale));
  el.style.setProperty("--resume-color-body", prefs.body.color);
}
