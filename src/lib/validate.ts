import type { ResumeData } from "../types/resume";

export type ValidationResult =
  | { ok: true; data: ResumeData }
  | { ok: false; error: string };

const ARRAY_FIELDS = ["work", "education", "skills", "projects"] as const;

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

  for (const field of ARRAY_FIELDS) {
    if (field in obj && !Array.isArray(obj[field])) {
      return { ok: false, error: `"${field}" must be an array.` };
    }
  }

  return { ok: true, data: obj as unknown as ResumeData };
}
