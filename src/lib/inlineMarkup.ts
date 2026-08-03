import { escapeHtml } from "./escapeHtml";

/**
 * Converts **bold** / _italic_ inline markup into <strong>/<em> HTML — nesting an <em> inside a
 * <strong> when both markers wrap the same text (source order is always _**bold+italic**_: the
 * bold pass runs first, so a leading/trailing "_" around a "**...**" pair ends up wrapping the
 * resulting <strong>). No other markdown syntax, and no *partial* overlap between a bold run and
 * an italic run — so resume prose stays plain, diff-friendly text with lightweight inline
 * emphasis, not a full markdown or rich-text-span data model.
 */
export function markupToHtml(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/_([^_]+)_/g, "<em>$1</em>");
}

export type InlineFormat = "bold" | "italic";

export interface InlineRun {
  text: string;
  formats: Set<InlineFormat>;
}

function tagFormat(tag: string): InlineFormat | null {
  if (tag === "STRONG" || tag === "B") return "bold";
  if (tag === "EM" || tag === "I") return "italic";
  return null;
}

function elementToRun(el: HTMLElement): InlineRun {
  const formats = new Set<InlineFormat>();
  let current: HTMLElement = el;
  // Descend through at most one level of nesting (<strong><em>...</em></strong> or the reverse)
  // — the only nested shape markupToHtml's bold-then-italic regex passes can ever produce.
  for (;;) {
    const format = tagFormat(current.tagName);
    if (!format) break;
    formats.add(format);
    const onlyChild = current.children.length === 1 ? (current.children[0] as HTMLElement) : null;
    if (!onlyChild || !tagFormat(onlyChild.tagName)) break;
    current = onlyChild;
  }
  return { text: current.textContent ?? "", formats };
}

/**
 * Reads an edited contenteditable region into flat (text, active-formats) runs, one per child
 * node. Only ever needs to handle Text and <strong>/<em>/<b>/<i> (optionally one nested inside
 * the other) — that's every shape markupToHtml can produce. Anything else (e.g. a stray
 * <div>/<br> from pressing Enter) just contributes its text content with no formatting.
 */
export function htmlToRuns(el: HTMLElement): InlineRun[] {
  const runs: InlineRun[] = [];
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      runs.push({ text: node.textContent ?? "", formats: new Set() });
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    runs.push(elementToRun(node as HTMLElement));
  }
  return runs;
}

/** Wraps `text` in the markers for `formats` — bold innermost, italic outermost, matching the
 * only order markupToHtml can round-trip back into nested HTML (see its doc comment). */
export function wrapMarkup(text: string, formats: ReadonlySet<InlineFormat>): string {
  let result = text;
  if (formats.has("bold")) result = `**${result}**`;
  if (formats.has("italic")) result = `_${result}_`;
  return result;
}

export function runsToMarkup(runs: readonly InlineRun[]): string {
  return runs.map((r) => wrapMarkup(r.text, r.formats)).join("");
}

/** Converts an edited contenteditable region back into bold/italic markup text. */
export function htmlToMarkup(el: HTMLElement): string {
  return runsToMarkup(htmlToRuns(el));
}
