/**
 * Writes `value` into `obj` at a dot-separated path of object keys and array indices (e.g.
 * "sections.0.items.1.summary") — used to write a formatted-text edit back into the resume data
 * at the exact field it came from.
 */
export function setAtPath(obj: unknown, path: string, value: unknown): void {
  const keys = path.split(".");
  const lastKey = keys.pop();
  if (lastKey === undefined) return;
  let target: Record<string, unknown> = obj as Record<string, unknown>;
  for (const key of keys) {
    target = target?.[key] as Record<string, unknown>;
    if (target == null) return;
  }
  target[lastKey] = value;
}
