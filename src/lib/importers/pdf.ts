import * as pdfjsLib from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { groupIntoLines, type PositionedTextItem } from "./pdfTextLayout";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/** Extracts text from a PDF entirely client-side, reconstructing line breaks from text positions. */
export async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
  const lines: string[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const items: PositionedTextItem[] = content.items
      .filter((item): item is TextItem => "str" in item)
      .map((item) => ({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
      }));

    lines.push(...groupIntoLines(items));
  }

  return lines.join("\n");
}
