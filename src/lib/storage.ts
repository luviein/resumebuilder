const RESUME_TEXT_KEY = "resume-builder:resume-json";

export function loadSavedResumeText(): string | null {
  return localStorage.getItem(RESUME_TEXT_KEY);
}

export function saveResumeText(text: string): void {
  localStorage.setItem(RESUME_TEXT_KEY, text);
}

/** Triggers a browser download of the given text as a file. */
export function downloadTextFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Reads a File (from an <input type="file">) as text. */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsText(file);
  });
}
