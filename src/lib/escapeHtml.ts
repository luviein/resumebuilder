const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapes text for safe interpolation into template HTML strings. */
export function escapeHtml(value: string | undefined | null): string {
  if (!value) return "";
  return value.replace(/[&<>"']/g, (char) => ESCAPE_MAP[char]);
}
