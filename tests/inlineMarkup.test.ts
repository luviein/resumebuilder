import { describe, it, expect } from "vitest";
import { markupToHtml, wrapMarkup, runsToMarkup, type InlineFormat } from "../src/lib/inlineMarkup";

describe("markupToHtml", () => {
  it("converts **bold** and _italic_ independently", () => {
    expect(markupToHtml("**bold**")).toBe("<strong>bold</strong>");
    expect(markupToHtml("_italic_")).toBe("<em>italic</em>");
    expect(markupToHtml("plain **bold** and _italic_ text")).toBe(
      "plain <strong>bold</strong> and <em>italic</em> text",
    );
  });

  it("nests <em> around <strong> for combined bold+italic markup (_**text**_)", () => {
    expect(markupToHtml("_**text**_")).toBe("<em><strong>text</strong></em>");
  });

  it("also round-trips the other source ordering (**_text_**)", () => {
    expect(markupToHtml("**_text_**")).toBe("<strong><em>text</em></strong>");
  });

  it("escapes HTML-significant characters before applying markup", () => {
    expect(markupToHtml("**<script>**")).toBe("<strong>&lt;script&gt;</strong>");
  });
});

describe("wrapMarkup", () => {
  it("wraps plain text unchanged when there are no formats", () => {
    expect(wrapMarkup("hello", new Set())).toBe("hello");
  });

  it("wraps bold-only and italic-only", () => {
    expect(wrapMarkup("hello", new Set<InlineFormat>(["bold"]))).toBe("**hello**");
    expect(wrapMarkup("hello", new Set<InlineFormat>(["italic"]))).toBe("_hello_");
  });

  it("wraps bold+italic with bold innermost, italic outermost", () => {
    expect(wrapMarkup("hello", new Set<InlineFormat>(["bold", "italic"]))).toBe("_**hello**_");
    // Set insertion order shouldn't matter — the wrapping order is fixed.
    expect(wrapMarkup("hello", new Set<InlineFormat>(["italic", "bold"]))).toBe("_**hello**_");
  });
});

describe("runsToMarkup", () => {
  it("joins runs with each one's own formatting applied", () => {
    const markup = runsToMarkup([
      { text: "plain ", formats: new Set() },
      { text: "bold", formats: new Set<InlineFormat>(["bold"]) },
      { text: " and ", formats: new Set() },
      { text: "both", formats: new Set<InlineFormat>(["bold", "italic"]) },
    ]);
    expect(markup).toBe("plain **bold** and _**both**_");
  });

  it("round-trips back through markupToHtml into the expected nested HTML", () => {
    const markup = runsToMarkup([{ text: "both", formats: new Set<InlineFormat>(["bold", "italic"]) }]);
    expect(markupToHtml(markup)).toBe("<em><strong>both</strong></em>");
  });
});
