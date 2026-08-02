import { describe, it, expect } from "vitest";
import { validateResumeJson } from "../src/lib/validate";

describe("validateResumeJson", () => {
  it("accepts a minimal valid resume", () => {
    const result = validateResumeJson(JSON.stringify({ basics: { name: "Ada Lovelace" } }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.basics.name).toBe("Ada Lovelace");
    }
  });

  it("rejects malformed JSON", () => {
    const result = validateResumeJson("{ not valid json");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Invalid JSON/);
    }
  });

  it("rejects a JSON array at the top level", () => {
    const result = validateResumeJson("[]");
    expect(result.ok).toBe(false);
  });

  it("rejects a missing basics object", () => {
    const result = validateResumeJson(JSON.stringify({ work: [] }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/basics/);
    }
  });

  it("rejects a missing or empty basics.name", () => {
    const result = validateResumeJson(JSON.stringify({ basics: { name: "" } }));
    expect(result.ok).toBe(false);
  });

  it("rejects a non-array value for a list field", () => {
    const result = validateResumeJson(
      JSON.stringify({ basics: { name: "Ada" }, work: "not an array" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/work/);
    }
  });
});
