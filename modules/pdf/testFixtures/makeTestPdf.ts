import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

/** Creates a real multi-page PDF with real, distinct text per page — used by
 * tests instead of a fixture binary, so the PDF is guaranteed to match
 * whatever content each test needs and never goes stale. */
export async function makeTestPdf(pageTexts: string[]): Promise<string> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const text of pageTexts) {
    const page = doc.addPage([400, 400]);
    page.drawText(text, { x: 50, y: 350, size: 14, font, color: rgb(0, 0, 0) });
  }
  const bytes = await doc.save();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "docstew-pdf-test-"));
  const filePath = path.join(dir, "test.pdf");
  fs.writeFileSync(filePath, bytes);
  return filePath;
}
