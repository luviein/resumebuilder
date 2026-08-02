import { describe, it, expect } from "vitest";
import { joinLineItems, groupIntoLines, type PositionedTextItem } from "../src/lib/importers/pdfTextLayout";

function item(str: string, x: number, y: number, width: number): PositionedTextItem {
  return { str, x, y, width };
}

describe("joinLineItems", () => {
  it("concatenates ligature-split word fragments with no spurious space", () => {
    // Real pdf.js behavior: a ligature glyph (fi/fl/ft) often splits a word into multiple text
    // items with zero gap between them. This used to render as "con fi guration".
    const items = [item("con", 100, 700, 18), item("fi", 118, 700, 10), item("guration", 128, 700, 48)];
    expect(joinLineItems(items)).toBe("configuration");
  });

  it("inserts a space at a genuine word boundary (real horizontal gap)", () => {
    const items = [item("Own", 100, 700, 18), item("the", 124, 700, 18)];
    expect(joinLineItems(items)).toBe("Own the");
  });

  it("doesn't double up a space when one is already present in the item text", () => {
    const items = [item("Own ", 100, 700, 24), item("the", 124, 700, 18)];
    expect(joinLineItems(items)).toBe("Own the");
  });

  it("returns an empty string for no items", () => {
    expect(joinLineItems([])).toBe("");
  });

  it("strips an unrecoverable ligature glyph (Private Use Area codepoint) instead of leaving a broken box", () => {
    // Some PDF fonts (notably Canva exports) have no ToUnicode mapping for the "ft" ligature glyph,
    // so pdf.js returns a Private-Use-Area codepoint that renders as a "tofu" box: "So<PUA>ware".
    const puaGlyph = String.fromCharCode(0xf000);
    const items = [item("So", 100, 700, 12), item(puaGlyph, 112, 700, 8), item("ware", 120, 700, 24)];
    expect(joinLineItems(items)).toBe("Soware");
  });
});

describe("groupIntoLines", () => {
  it("groups items into separate lines by y-coordinate and joins each correctly", () => {
    const items = [
      item("EXPERIENCE", 72, 700, 60),
      item("Soft", 72, 680, 22),
      item("ware", 94, 680, 22),
      item("Engineer", 118, 680, 44),
    ];
    expect(groupIntoLines(items)).toEqual(["EXPERIENCE", "Software Engineer"]);
  });
});
