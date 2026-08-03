import type { ResumeData } from "../types/resume";

export type ValidationResult =
  | { ok: true; data: ResumeData }
  | { ok: false; error: string };

const SECTION_TYPES = ["entries", "skills", "text"] as const;

/** Parses raw JSON text and checks it has the minimal shape a template needs. */
export function validateResumeJson(raw: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { ok: false, error: `Invalid JSON: ${(err as Error).message}` };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: "Resume JSON must be an object." };
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj.basics !== "object" || obj.basics === null || Array.isArray(obj.basics)) {
    return { ok: false, error: '"basics" must be an object.' };
  }
  const basics = obj.basics as Record<string, unknown>;
  if (typeof basics.name !== "string" || basics.name.trim() === "") {
    return { ok: false, error: '"basics.name" is required.' };
  }

  normalizeLegacyWorkFields(obj);

  if (!("sections" in obj)) {
    obj.sections = migrateLegacySchema(obj);
  }

  if (!Array.isArray(obj.sections)) {
    return { ok: false, error: '"sections" must be an array.' };
  }

  for (const section of obj.sections) {
    if (typeof section !== "object" || section === null || Array.isArray(section)) {
      return { ok: false, error: "Each entry in \"sections\" must be an object." };
    }
    const s = section as Record<string, unknown>;
    if (typeof s.title !== "string") {
      return { ok: false, error: 'Each section needs a "title" string.' };
    }
    if (!SECTION_TYPES.includes(s.type as (typeof SECTION_TYPES)[number])) {
      return { ok: false, error: `Section "${s.title}" has an unknown "type" — must be one of: ${SECTION_TYPES.join(", ")}.` };
    }
    if (s.type === "text" ? typeof s.items !== "string" : !Array.isArray(s.items)) {
      return { ok: false, error: `Section "${s.title}"'s "items" doesn't match its type.` };
    }
  }

  return { ok: true, data: obj as unknown as ResumeData };
}

/**
 * ResumeWork uses companyName/positionName, not the standard JSON Resume field names
 * (name/position) — accept the standard names too so a JSON Resume file loads correctly
 * instead of silently rendering with blank company/position on every work entry.
 */
function normalizeLegacyWorkFields(obj: Record<string, unknown>): void {
  if (!Array.isArray(obj.work)) return;
  for (const entry of obj.work) {
    if (typeof entry !== "object" || entry === null) continue;
    const work = entry as Record<string, unknown>;
    if (work.companyName === undefined && typeof work.name === "string") {
      work.companyName = work.name;
    }
    if (work.positionName === undefined && typeof work.position === "string") {
      work.positionName = work.position;
    }
  }
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

/**
 * Converts the old fixed work/education/skills/projects fields into the generic sections[]
 * shape, so existing resume.json files (and anything already sitting in a user's localStorage)
 * keep working with zero hand-editing. Runs only when "sections" isn't present at all.
 */
function migrateLegacySchema(obj: Record<string, unknown>): unknown[] {
  const sections: unknown[] = [];

  if (Array.isArray(obj.work) && obj.work.length) {
    sections.push({
      title: "Experience",
      type: "entries",
      items: obj.work.map((entry) => {
        const w = (entry ?? {}) as Record<string, unknown>;
        return {
          heading: str(w.companyName) ?? "Unknown Company",
          subheading: str(w.positionName),
          url: str(w.url),
          startDate: str(w.startDate),
          endDate: typeof w.endDate === "string" ? w.endDate : undefined,
          summary: str(w.summary),
          highlights: Array.isArray(w.highlights) ? w.highlights : undefined,
        };
      }),
    });
  }

  if (Array.isArray(obj.education) && obj.education.length) {
    sections.push({
      title: "Education",
      type: "entries",
      items: obj.education.map((entry) => {
        const e = (entry ?? {}) as Record<string, unknown>;
        const subheading = [str(e.studyType), str(e.area)].filter(Boolean).join(", ") || undefined;
        const highlights = Array.isArray(e.courses) && e.courses.length
          ? [`Coursework: ${(e.courses as unknown[]).join(", ")}`]
          : undefined;
        const summary = str(e.score) ? `Score: ${e.score}` : undefined;
        return {
          heading: str(e.institution) ?? "Unknown Institution",
          subheading,
          startDate: str(e.startDate),
          endDate: typeof e.endDate === "string" ? e.endDate : undefined,
          summary,
          highlights,
        };
      }),
    });
  }

  if (Array.isArray(obj.projects) && obj.projects.length) {
    sections.push({
      title: "Projects",
      type: "entries",
      items: obj.projects.map((entry) => {
        const p = (entry ?? {}) as Record<string, unknown>;
        const highlights = Array.isArray(p.highlights) ? [...p.highlights] : [];
        if (Array.isArray(p.keywords) && p.keywords.length) {
          highlights.push(`Technologies: ${(p.keywords as unknown[]).join(", ")}`);
        }
        return {
          heading: str(p.name) ?? "Untitled Project",
          url: str(p.url),
          startDate: str(p.startDate),
          endDate: typeof p.endDate === "string" ? p.endDate : undefined,
          summary: str(p.description),
          highlights: highlights.length ? highlights : undefined,
        };
      }),
    });
  }

  if (Array.isArray(obj.skills) && obj.skills.length) {
    sections.push({ title: "Skills", type: "skills", items: obj.skills });
  }

  return sections;
}
