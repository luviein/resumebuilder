const HISTORY_KEY = "resume-builder:history";
const MAX_ENTRIES = 50;

export interface HistoryEntry {
  text: string;
  savedAt: string;
  label?: string;
}

/**
 * Appends a checkpoint and trims to `maxEntries` from the front. Pure — returns `history`
 * unchanged (same reference) when nothing actually changed, so callers can skip a write and tell
 * the user nothing new was saved.
 *
 * Deduped against the immediately-previous entry so clicking Save with no changes and no name
 * doesn't create a meaningless duplicate — but only when no `label` is given. Naming a save is a
 * deliberate act of marking *this* moment, so it always creates a new entry even if the content
 * happens to match the last one.
 */
export function appendCheckpoint(
  history: HistoryEntry[],
  text: string,
  now: string,
  label?: string,
  maxEntries: number = MAX_ENTRIES,
): HistoryEntry[] {
  const last = history[history.length - 1];
  if (!label && last && last.text === text) return history;
  const entry: HistoryEntry = label ? { text, savedAt: now, label } : { text, savedAt: now };
  const next = [...history, entry];
  return next.length > maxEntries ? next.slice(next.length - maxEntries) : next;
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistoryList(entries: HistoryEntry[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
}

/** Saves the current resume text as a new version, optionally named. Deduped against the last
 * saved checkpoint when unnamed. Returns whether a new version was actually saved. */
export function checkpoint(text: string, label?: string): boolean {
  const history = loadHistory();
  const next = appendCheckpoint(history, text, new Date().toISOString(), label);
  const changed = next !== history;
  if (changed) saveHistoryList(next);
  return changed;
}
