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

  it("maps standard JSON Resume field names (name/position) onto companyName/positionName", () => {
    // A plain JSON Resume file uses the standard schema's field names, not this app's — without
    // this mapping it would pass validation but render every work entry with a blank
    // company/position, silently, since the template only reads companyName/positionName.
    const result = validateResumeJson(
      JSON.stringify({
        basics: { name: "Ada Lovelace" },
        work: [{ name: "Acme Corp", position: "Engineer" }],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.work![0].companyName).toBe("Acme Corp");
      expect(result.data.work![0].positionName).toBe("Engineer");
    }
  });

  it("doesn't override companyName/positionName when both the legacy and new fields are present", () => {
    const result = validateResumeJson(
      JSON.stringify({
        basics: { name: "Ada Lovelace" },
        work: [{ name: "Legacy Name", companyName: "Correct Name", position: "Legacy Title", positionName: "Correct Title" }],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.work![0].companyName).toBe("Correct Name");
      expect(result.data.work![0].positionName).toBe("Correct Title");
    }
  });
});
