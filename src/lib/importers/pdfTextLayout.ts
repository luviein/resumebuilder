export interface PositionedTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
}

// Some PDF exports (notably Canva and similar design tools) subset their fonts without a proper
// ToUnicode mapping for ligature glyphs (fi/fl/ft/ffi/ffl). pdf.js can't recover the real character
// in that case and returns either the Unicode replacement character or a Private-Use-Area codepoint,
// which renders as a visible "tofu" box (e.g. "So[box]ware" instead of "Software"). The original
// character is genuinely unrecoverable from the file -- stripping it is better than leaving a broken
// glyph in the text (and a PUA codepoint wouldn't match anything in an ATS keyword search anyway).
const UNRECOVERABLE_GLYPH_RE = new RegExp("[\\uE000-\\uF8FF\\uFFFD]", "g");

/**
 * Joins the text items of one visual line into a string. pdf.js frequently splits a single word
 * into multiple adjacent items at font/ligature boundaries (e.g. "fi", "fl", "ft" ligatures) --
 * naively joining every item with a space produces garbage like "con fi guration". Instead, only
 * insert a space when there's an actual horizontal gap between items; touching/overlapping items
 * are concatenated directly.
 */
export function joinLineItems(items: PositionedTextItem[]): string {
  let result = "";
  let prevEndX: number | null = null;

  for (const item of items) {
    if (!item.str) continue;
    if (prevEndX !== null) {
      const gap = item.x - prevEndX;
      const avgCharWidth = item.width / Math.max(item.str.length, 1);
      const alreadySpaced = result.endsWith(" ") || item.str.startsWith(" ");
      if (!alreadySpaced && gap > avgCharWidth * 0.35) {
        result += " ";
      }
    }
    result += item.str;
    prevEndX = item.x + item.width;
  }

  return result.replace(UNRECOVERABLE_GLYPH_RE, "").replace(/\s+/g, " ").trim();
}

/** Groups PDF text items into lines by matching y-coordinate -- pdf.js doesn't preserve line breaks itself. */
export function groupIntoLines(items: PositionedTextItem[]): string[] {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lineGroups: PositionedTextItem[][] = [];
  let currentY: number | null = null;

  for (const item of sorted) {
    if (currentY === null || Math.abs(item.y - currentY) > 2) {
      lineGroups.push([]);
      currentY = item.y;
    }
    lineGroups[lineGroups.length - 1].push(item);
  }

  return lineGroups.map(joinLineItems).filter(Boolean);
}
