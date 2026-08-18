import * as fs from "fs";

// pdfjs-dist ships ESM-only (no CommonJS export condition). Same situation as
// marked in src/main/markdown.ts — TypeScript silently downlevels a literal
// import() back to require() when targeting CommonJS, which would reintroduce
// the same ERR_REQUIRE_ESM failure, so the dynamic import is routed through
// `new Function` to hide it from TS's downleveling.
type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
const dynamicImport = new Function("specifier", "return import(specifier)") as (
  specifier: string
) => Promise<PdfjsModule>;

let pdfjsModulePromise: Promise<PdfjsModule> | null = null;

function getPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsModulePromise) {
    pdfjsModulePromise = dynamicImport("pdfjs-dist/legacy/build/pdf.mjs");
  }
  return pdfjsModulePromise;
}

export interface PdfPageText {
  pageNumber: number;
  text: string;
}

/** Extracts each page's text layer. A scanned PDF with no text layer yields
 * empty strings — that's an expected limitation, not an error; OCR (to fill
 * this gap) is deliberately out of scope for this phase. */
export async function extractPdfText(filePath: string): Promise<PdfPageText[]> {
  const pdfjsLib = await getPdfjs();
  const data = new Uint8Array(fs.readFileSync(filePath));
  // Resource cleanup lives on the loading task, not the resolved document —
  // PDFDocumentProxy only has cleanup()/no destroy(); the task returned by
  // getDocument() (before awaiting .promise) is what owns destroy().
  const loadingTask = pdfjsLib.getDocument({ data, useWorkerFetch: false, useSystemFonts: true });
  const doc = await loadingTask.promise;

  const pages: PdfPageText[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    pages.push({ pageNumber: i, text });
  }
  await loadingTask.destroy();
  return pages;
}

export async function extractFullText(filePath: string): Promise<string> {
  const pages = await extractPdfText(filePath);
  return pages.map((p) => p.text).join("\n\n");
}
