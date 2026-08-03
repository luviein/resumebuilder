import { describe, it, expect } from "vitest";
import { validateResumeJson } from "../src/lib/validate";

describe("validateResumeJson", () => {
  it("accepts a minimal valid resume with no sections", () => {
    const result = validateResumeJson(JSON.stringify({ basics: { name: "Ada Lovelace" } }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.basics.name).toBe("Ada Lovelace");
      expect(result.data.sections).toEqual([]);
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
    const result = validateResumeJson(JSON.stringify({ sections: [] }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/basics/);
    }
  });

  it("rejects a missing or empty basics.name", () => {
    const result = validateResumeJson(JSON.stringify({ basics: { name: "" } }));
    expect(result.ok).toBe(false);
  });

  it('rejects a non-array "sections"', () => {
    const result = validateResumeJson(JSON.stringify({ basics: { name: "Ada" }, sections: "not an array" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/sections/);
    }
  });

  it("rejects a section with an unrecognized type", () => {
    const result = validateResumeJson(
      JSON.stringify({ basics: { name: "Ada" }, sections: [{ title: "X", type: "bogus", items: [] }] }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a section whose items don't match its declared type", () => {
    const result = validateResumeJson(
      JSON.stringify({ basics: { name: "Ada" }, sections: [{ title: "Bio", type: "text", items: [] }] }),
    );
    expect(result.ok).toBe(false);
  });

  it("leaves a resume already in the new sections[] shape untouched", () => {
    const input = {
      basics: { name: "Ada Lovelace" },
      sections: [{ title: "Certifications", type: "text", items: "AWS Certified" }],
    };
    const result = validateResumeJson(JSON.stringify(input));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sections).toEqual(input.sections);
    }
  });

  it("migrates legacy work/education/skills/projects fields into sections[], in a fixed order", () => {
    const result = validateResumeJson(
      JSON.stringify({
        basics: { name: "Ada Lovelace" },
        work: [{ companyName: "Acme", positionName: "Engineer" }],
        education: [{ institution: "MIT", studyType: "B.S." }],
        skills: [{ name: "Backend", keywords: ["TS"] }],
        projects: [{ name: "Widget", description: "A widget" }],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sections.map((s) => s.title)).toEqual(["Experience", "Education", "Projects", "Skills"]);
    }
  });

  it("maps standard JSON Resume field names (name/position) onto companyName/positionName before migrating", () => {
    // A plain JSON Resume file uses the standard schema's field names, not this app's — without
    // this mapping the migrated entry would render with a blank heading/subheading.
    const result = validateResumeJson(
      JSON.stringify({
        basics: { name: "Ada Lovelace" },
        work: [{ name: "Acme Corp", position: "Engineer" }],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const experience = result.data.sections.find((s) => s.title === "Experience");
      expect(experience?.type).toBe("entries");
      if (experience?.type === "entries") {
        expect(experience.items[0].heading).toBe("Acme Corp");
        expect(experience.items[0].subheading).toBe("Engineer");
      }
    }
  });

  it("doesn't override companyName/positionName when both the legacy and new fields are present", () => {
    const result = validateResumeJson(
      JSON.stringify({
        basics: { name: "Ada Lovelace" },
        work: [
          { name: "Legacy Name", companyName: "Correct Name", position: "Legacy Title", positionName: "Correct Title" },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const experience = result.data.sections.find((s) => s.title === "Experience");
      if (experience?.type === "entries") {
        expect(experience.items[0].heading).toBe("Correct Name");
        expect(experience.items[0].subheading).toBe("Correct Title");
      }
    }
  });
});
