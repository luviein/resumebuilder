const HISTORY_KEY = "resume-builder:history";
const MAX_ENTRIES = 50;

export interface HistoryEntry {
  text: string;
  savedAt: string;
}

/**
 * Appends a checkpoint, deduped against the immediately-previous one so rapid typing doesn't
 * explode the history into one entry per keystroke, and trimmed to `maxEntries` from the front.
 * Pure — returns `history` unchanged (same reference) when nothing actually changed, so callers
 * can skip a write.
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

/** Checkpoints the current resume text, deduped against the last saved checkpoint. */
export function checkpoint(text: string): void {
  const history = loadHistory();
  const next = appendCheckpoint(history, text, new Date().toISOString());
  if (next !== history) saveHistoryList(next);
}
