import mammoth from "mammoth";

/** Extracts plain text from a .docx entirely client-side, preserving paragraph breaks. */
export async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}
