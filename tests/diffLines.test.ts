import { describe, it, expect } from "vitest";
import { diffLines } from "../src/lib/diffLines";

describe("diffLines", () => {
  it("returns all equal lines for identical text", () => {
    const text = "a\nb\nc";
    const ops = diffLines(text, text);
    expect(ops).toEqual([
      { type: "equal", line: "a" },
      { type: "equal", line: "b" },
      { type: "equal", line: "c" },
    ]);
  });

  it("detects a pure addition", () => {
    const ops = diffLines("a\nb", "a\nb\nc");
    expect(ops).toEqual([
      { type: "equal", line: "a" },
      { type: "equal", line: "b" },
      { type: "add", line: "c" },
    ]);
  });

  it("detects a pure removal", () => {
    const ops = diffLines("a\nb\nc", "a\nc");
    expect(ops).toEqual([
      { type: "equal", line: "a" },
      { type: "remove", line: "b" },
      { type: "equal", line: "c" },
    ]);
  });

  it("detects a line changed in place as a remove+add pair", () => {
    const ops = diffLines("a\nb\nc", "a\nX\nc");
    expect(ops).toEqual([
      { type: "equal", line: "a" },
      { type: "remove", line: "b" },
      { type: "add", line: "X" },
      { type: "equal", line: "c" },
    ]);
  });

  it("handles a fully replaced document", () => {
    const ops = diffLines("a\nb", "x\ny");
    expect(ops.filter((o) => o.type === "remove").map((o) => o.line)).toEqual(["a", "b"]);
    expect(ops.filter((o) => o.type === "add").map((o) => o.line)).toEqual(["x", "y"]);
  });

  it("handles empty strings on either side", () => {
    expect(diffLines("", "")).toEqual([{ type: "equal", line: "" }]);
    expect(diffLines("", "a")).toEqual([
      { type: "remove", line: "" },
      { type: "add", line: "a" },
    ]);
  });
});
