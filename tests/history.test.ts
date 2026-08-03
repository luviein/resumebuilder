import { describe, it, expect } from "vitest";
import { appendCheckpoint, type HistoryEntry } from "../src/lib/history";

describe("appendCheckpoint", () => {
  it("appends a new entry to an empty history", () => {
    const result = appendCheckpoint([], "v1", "2026-01-01T00:00:00.000Z");
    expect(result).toEqual([{ text: "v1", savedAt: "2026-01-01T00:00:00.000Z" }]);
  });

  it("appends when the text differs from the last entry", () => {
    const history: HistoryEntry[] = [{ text: "v1", savedAt: "2026-01-01T00:00:00.000Z" }];
    const result = appendCheckpoint(history, "v2", "2026-01-01T00:01:00.000Z");
    expect(result).toEqual([
      { text: "v1", savedAt: "2026-01-01T00:00:00.000Z" },
      { text: "v2", savedAt: "2026-01-01T00:01:00.000Z" },
    ]);
  });

  it("dedupes against the immediately-previous entry (same reference, no-op)", () => {
    const history: HistoryEntry[] = [{ text: "v1", savedAt: "2026-01-01T00:00:00.000Z" }];
    const result = appendCheckpoint(history, "v1", "2026-01-01T00:01:00.000Z");
    expect(result).toBe(history);
    expect(result).toHaveLength(1);
  });

  it("re-adds a value that matches an OLDER (not immediately-previous) entry", () => {
    // Only the last entry is deduped against — going v1 -> v2 -> v1 is a real, meaningful change
    // (an undo), not a no-op, so it should still get its own checkpoint.
    const history: HistoryEntry[] = [
      { text: "v1", savedAt: "2026-01-01T00:00:00.000Z" },
      { text: "v2", savedAt: "2026-01-01T00:01:00.000Z" },
    ];
    const result = appendCheckpoint(history, "v1", "2026-01-01T00:02:00.000Z");
    expect(result).toHaveLength(3);
    expect(result[2]).toEqual({ text: "v1", savedAt: "2026-01-01T00:02:00.000Z" });
  });

  it("prunes from the front once past maxEntries", () => {
    const history: HistoryEntry[] = Array.from({ length: 5 }, (_, i) => ({
      text: `v${i}`,
      savedAt: `t${i}`,
    }));
    const result = appendCheckpoint(history, "v5", "t5", 5);
    expect(result).toHaveLength(5);
    expect(result.map((e) => e.text)).toEqual(["v1", "v2", "v3", "v4", "v5"]);
  });
});
