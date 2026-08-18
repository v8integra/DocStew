import * as fs from "fs";
import { extractFullText } from "./textExtraction";
import { getPageCount, getTitle, rotatePage, swapPages, mergePdfs, splitPdf } from "./pdfOperations";
import { chat } from "../../src/main/ai-engine/ollamaClient";
import { getChatModel } from "../../src/main/ai-engine/config";
import type {
  AITool,
  DocStewModule,
  DocumentHandle,
  ModuleOperation,
  PeekInfo,
  RenderDescriptor,
  SearchableText,
} from "../../src/shared/module-contract";

export interface PdfRenderData {
  pageCount: number;
}

// A local 3B-class model's usable context is small; capping keeps prompts
// fast and avoids silently truncating inside Ollama in a way we can't see.
const MAX_CHARS_FOR_MODEL = 6000;

function truncate(text: string): string {
  return text.length > MAX_CHARS_FOR_MODEL ? `${text.slice(0, MAX_CHARS_FOR_MODEL)}\n[...truncated...]` : text;
}

function requireChatModel(): string {
  const model = getChatModel();
  if (!model) {
    throw new Error("No local chat model is available. Install Ollama and pull a model to use AI features.");
  }
  return model;
}

const NO_TEXT_NOTE =
  "this PDF has no extractable text — it may be a scanned document with no text layer; OCR isn't available yet.";

const summarizeTool: AITool = {
  name: "summarize",
  description: "Summarize this PDF in a short paragraph.",
  parameters: {},
  async handler(handle: DocumentHandle): Promise<unknown> {
    const model = requireChatModel();
    const text = truncate(await extractFullText(handle.filePath));
    if (text.trim().length === 0) {
      return { summary: `(nothing to summarize — ${NO_TEXT_NOTE})` };
    }
    const summary = await chat(model, [
      { role: "system", content: "Summarize the user's PDF document in one short paragraph. Respond with only the summary." },
      { role: "user", content: text },
    ]);
    return { summary: summary.trim() };
  },
};

const qaTool: AITool = {
  name: "qa",
  description: "Answer a question about this PDF's content.",
  parameters: { question: { type: "string" } },
  async handler(handle: DocumentHandle, args: Record<string, unknown>): Promise<unknown> {
    const model = requireChatModel();
    const question = String(args.question ?? "").trim();
    if (!question) throw new Error("A question is required.");
    const text = truncate(await extractFullText(handle.filePath));
    if (text.trim().length === 0) {
      return { answer: `I can't answer that — ${NO_TEXT_NOTE}` };
    }
    const answer = await chat(model, [
      {
        role: "system",
        content: `Answer the user's question using ONLY the PDF excerpt below. If it doesn't contain the answer, say so plainly instead of guessing.\n\n${text}`,
      },
      { role: "user", content: question },
    ]);
    return { answer: answer.trim() };
  },
};

const extractTableTool: AITool = {
  name: "extractTable",
  description: "Find and extract tabular data from this PDF as a Markdown table.",
  parameters: {},
  async handler(handle: DocumentHandle): Promise<unknown> {
    const model = requireChatModel();
    const text = truncate(await extractFullText(handle.filePath));
    if (text.trim().length === 0) {
      return { table: `(nothing to extract — ${NO_TEXT_NOTE})` };
    }
    const table = await chat(model, [
      {
        role: "system",
        content:
          "The user's PDF text below was extracted from the document, so column alignment/spacing may be imperfect. " +
          "Find any tabular data and reformat it as a clean Markdown table. If there's no tabular data, say so plainly " +
          "instead of inventing one.\n\n" +
          text,
      },
      { role: "user", content: "Extract the table." },
    ]);
    return { table: table.trim() };
  },
};

const rotateOperation: ModuleOperation = {
  name: "rotatePage",
  description: "Rotate a page 90 degrees.",
  parameters: { pageIndex: { type: "number" }, degrees: { type: "number" } },
  async handler(handle: DocumentHandle, args: Record<string, unknown>): Promise<unknown> {
    await rotatePage(handle.filePath, Number(args.pageIndex), Number(args.degrees ?? 90));
    return {};
  },
};

const swapPagesOperation: ModuleOperation = {
  name: "swapPages",
  description: "Swap the order of two pages.",
  parameters: { indexA: { type: "number" }, indexB: { type: "number" } },
  async handler(handle: DocumentHandle, args: Record<string, unknown>): Promise<unknown> {
    await swapPages(handle.filePath, Number(args.indexA), Number(args.indexB));
    return {};
  },
};

const mergeOperation: ModuleOperation = {
  name: "merge",
  description: "Merge this PDF with another PDF, producing a new combined file.",
  parameters: { otherFilePath: { type: "string" } },
  async handler(handle: DocumentHandle, args: Record<string, unknown>): Promise<unknown> {
    const outputPath = await mergePdfs(handle.filePath, String(args.otherFilePath));
    return { newFiles: [outputPath] };
  },
};

const splitOperation: ModuleOperation = {
  name: "split",
  description: "Split this PDF into two files at a given page.",
  parameters: { atPageIndex: { type: "number" } },
  async handler(handle: DocumentHandle, args: Record<string, unknown>): Promise<unknown> {
    const { firstPath, secondPath } = await splitPdf(handle.filePath, Number(args.atPageIndex));
    return { newFiles: [firstPath, secondPath] };
  },
};

const pdfModule: DocStewModule = {
  id: "pdf",
  supportedExtensions: [".pdf"],

  open(filePath: string): DocumentHandle {
    return { id: filePath, filePath, moduleId: "pdf" };
  },

  async render(handle: DocumentHandle): Promise<RenderDescriptor> {
    const pageCount = await getPageCount(handle.filePath);
    const data: PdfRenderData = { pageCount };
    return { kind: "pdf", data };
  },

  save(): void {
    throw new Error("The PDF module doesn't support in-place editing yet — use rotate/merge/split instead.");
  },

  async export(handle: DocumentHandle, format: string): Promise<Buffer> {
    if (format === "pdf") return fs.readFileSync(handle.filePath);
    if (format === "txt") return Buffer.from(await extractFullText(handle.filePath), "utf-8");
    throw new Error(`pdf module cannot export to "${format}"`);
  },

  async index(handle: DocumentHandle): Promise<SearchableText> {
    return { documentId: handle.id, text: await extractFullText(handle.filePath) };
  },

  async peek(filePath: string): Promise<PeekInfo> {
    const title = await getTitle(filePath);
    return { title };
  },

  aiTools: [summarizeTool, qaTool, extractTableTool],
  operations: [rotateOperation, swapPagesOperation, mergeOperation, splitOperation],
};

export default pdfModule;
