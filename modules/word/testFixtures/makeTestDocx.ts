import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export interface TestDocxSpec {
  title?: string;
  paragraphs?: string[];
  bulletItems?: string[];
}

/** Creates a real .docx with real content — used by tests instead of a
 * fixture binary, so it's guaranteed to match whatever each test needs. */
export async function makeTestDocx(spec: TestDocxSpec): Promise<string> {
  const children: Paragraph[] = [];
  if (spec.title) {
    children.push(new Paragraph({ text: spec.title, heading: HeadingLevel.HEADING_1 }));
  }
  for (const text of spec.paragraphs ?? []) {
    children.push(new Paragraph({ children: [new TextRun(text)] }));
  }
  for (const text of spec.bulletItems ?? []) {
    children.push(new Paragraph({ text, bullet: { level: 0 } }));
  }

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "docstew-word-test-"));
  const filePath = path.join(dir, "test.docx");
  fs.writeFileSync(filePath, buffer);
  return filePath;
}
