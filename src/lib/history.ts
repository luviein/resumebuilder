const HISTORY_KEY = "resume-builder:history";
const MAX_ENTRIES = 50;

export interface HistoryEntry {
  text: string;
  savedAt: string;
}

/**
 * Appends a checkpoint, deduped against the immediately-previous one so clicking Save with no
 * changes since the last save doesn't create a meaningless duplicate entry, and trimmed to
 * `maxEntries` from the front. Pure — returns `history` unchanged (same reference) when nothing
 * actually changed, so callers can skip a write and tell the user nothing new was saved.
 */
export function appendCheckpoint(
  history: HistoryEntry[],
  text: string,
  now: string,
  maxEntries: number = MAX_ENTRIES,
): HistoryEntry[] {
  const last = history[history.length - 1];
  if (last && last.text === text) return history;
  const next = [...history, { text, savedAt: now }];
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

/** Saves the current resume text as a new version, deduped against the last saved checkpoint.
 * Returns whether a new version was actually saved (false if it was identical to the last one). */
export function checkpoint(text: string): boolean {
  const history = loadHistory();
  const next = appendCheckpoint(history, text, new Date().toISOString());
  const changed = next !== history;
  if (changed) saveHistoryList(next);
  return changed;
}
