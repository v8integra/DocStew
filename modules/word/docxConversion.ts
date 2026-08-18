import * as mammoth from "mammoth";

// mammoth deliberately ignores direct/manual formatting like underline by
// default (treated as non-semantic) — verified empirically: a real generated
// .docx with an underlined run produced plain <p> with no <u> at all, and no
// warning either. The style map opts back in, matching this module's
// supported formatting set (bold/italic/underline).
const STYLE_MAP = ["u => u"];

export interface DocxHtml {
  html: string;
  warnings: string[];
}

export async function convertToHtml(filePath: string): Promise<DocxHtml> {
  const result = await mammoth.convertToHtml({ path: filePath }, { styleMap: STYLE_MAP });
  return { html: result.value, warnings: result.messages.map((m) => m.message) };
}

export async function extractRawText(filePath: string): Promise<string> {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}
