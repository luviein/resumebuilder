import { escapeHtml } from "./escapeHtml";

/**
 * Converts **bold** / _italic_ inline markup into <strong>/<em> HTML. Deliberately minimal — no
 * nested/overlapping marks, no other markdown syntax — so resume prose stays plain, diff-friendly
 * text with lightweight inline emphasis, not a full markdown or rich-text-span data model.
 */
export function markupToHtml(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/_([^_]+)_/g, "<em>$1</em>");
}

/**
 * Converts an edited contenteditable region back into bold/italic markup text. Only ever needs to
 * handle Text, <strong>, and <em> nodes — that's all markupToHtml ever produces — so the walk is
 * unambiguous; anything else (e.g. a stray <div>/<br> from pressing Enter) just contributes its
 * text content.
 */
export function htmlToMarkup(el: HTMLElement): string {
  let result = "";
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent ?? "";
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const tag = (node as HTMLElement).tagName;
    const inner = (node as HTMLElement).textContent ?? "";
    if (tag === "STRONG" || tag === "B") result += `**${inner}**`;
    else if (tag === "EM" || tag === "I") result += `_${inner}_`;
    else result += inner;
  }
  return result;
}
