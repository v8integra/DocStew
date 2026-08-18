import * as fs from "fs";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { convertToHtml, extractRawText } from "./docxConversion";
import { blocksToDocxBuffer } from "./blocksToDocx";
import type { WordBlock } from "./wordBlocks";
import { chat } from "../../src/main/ai-engine/ollamaClient";
import { getChatModel } from "../../src/main/ai-engine/config";
import { translateText } from "../../src/main/translation/translationService";
import { htmlToPdfBuffer } from "../../src/main/htmlToPdf";
import type {
  AITool,
  DocStewModule,
  DocumentHandle,
  PeekInfo,
  RenderDescriptor,
  SearchableText,
} from "../../src/shared/module-contract";

export interface WordRenderData {
  html: string;
  warnings: string[];
}

const turndownService = new TurndownService();
turndownService.use(gfm);

// A local 3B-class model's usable context is small; capping keeps prompts
// fast and avoids silently truncating inside Ollama in a way we can't see —
// same reasoning and limit as the PDF module.
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

function firstNonEmptyLine(text: string): string | undefined {
  return text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0)
    ?.slice(0, 80);
}

const summarizeTool: AITool = {
  name: "summarize",
  description: "Summarize this document in a short paragraph.",
  parameters: {},
  async handler(handle: DocumentHandle): Promise<unknown> {
    const model = requireChatModel();
    const text = truncate(await extractRawText(handle.filePath));
    if (text.trim().length === 0) return { summary: "(nothing to summarize — this document is empty)" };
    const summary = await chat(model, [
      { role: "system", content: "Summarize the user's document in one short paragraph. Respond with only the summary." },
      { role: "user", content: text },
    ]);
    return { summary: summary.trim() };
  },
};

const rewriteTool: AITool = {
  name: "rewrite",
  description: "Rewrite this document's text following an optional instruction (defaults to improving clarity).",
  parameters: { instruction: { type: "string" } },
  async handler(handle: DocumentHandle, args: Record<string, unknown>): Promise<unknown> {
    const model = requireChatModel();
    const instruction = String(args.instruction ?? "").trim() || "Improve clarity and flow without changing the meaning.";
    const text = truncate(await extractRawText(handle.filePath));
    if (text.trim().length === 0) return { rewritten: "(nothing to rewrite — this document is empty)" };
    const rewritten = await chat(model, [
      {
        role: "system",
        content: `Rewrite the user's document text. Instruction: ${instruction}\nRespond with only the rewritten text, no preamble.`,
      },
      { role: "user", content: text },
    ]);
    return { rewritten: rewritten.trim() };
  },
};

const toneAdjustTool: AITool = {
  name: "toneAdjust",
  description: "Rewrite this document's text in a different tone.",
  parameters: { tone: { type: "string" } },
  async handler(handle: DocumentHandle, args: Record<string, unknown>): Promise<unknown> {
    const model = requireChatModel();
    const tone = String(args.tone ?? "").trim();
    if (!tone) throw new Error("A target tone is required.");
    const text = truncate(await extractRawText(handle.filePath));
    if (text.trim().length === 0) return { rewritten: "(nothing to rewrite — this document is empty)" };
    const rewritten = await chat(model, [
      {
        role: "system",
        content: `Rewrite the user's document text in a ${tone} tone, keeping the same meaning. Respond with only the rewritten text, no preamble.`,
      },
      { role: "user", content: text },
    ]);
    return { rewritten: rewritten.trim() };
  },
};

const translateTool: AITool = {
  name: "translate",
  description: "Translate this document's text into another language.",
  parameters: { targetLanguage: { type: "string" }, sourceLanguage: { type: "string" } },
  async handler(handle: DocumentHandle, args: Record<string, unknown>): Promise<unknown> {
    const targetLanguage = String(args.targetLanguage ?? "").trim();
    const sourceLanguage = args.sourceLanguage ? String(args.sourceLanguage).trim() : undefined;
    const text = truncate(await extractRawText(handle.filePath));
    return translateText(text, targetLanguage, sourceLanguage);
  },
};

const wordModule: DocStewModule = {
  id: "word",
  supportedExtensions: [".docx"],

  open(filePath: string): DocumentHandle {
    return { id: filePath, filePath, moduleId: "word" };
  },

  async render(handle: DocumentHandle): Promise<RenderDescriptor> {
    const { html, warnings } = await convertToHtml(handle.filePath);
    const data: WordRenderData = { html, warnings };
    return { kind: "word", data };
  },

  async save(handle: DocumentHandle, content?: unknown): Promise<void> {
    const { blocks } = content as { blocks: WordBlock[] };
    const buffer = await blocksToDocxBuffer(blocks);
    fs.writeFileSync(handle.filePath, buffer);
  },

  async export(handle: DocumentHandle, format: string): Promise<Buffer> {
    if (format === "docx") return fs.readFileSync(handle.filePath);
    if (format === "txt") return Buffer.from(await extractRawText(handle.filePath), "utf-8");
    if (format === "md") {
      const { html } = await convertToHtml(handle.filePath);
      return Buffer.from(turndownService.turndown(html), "utf-8");
    }
    if (format === "pdf") {
      const { html } = await convertToHtml(handle.filePath);
      return htmlToPdfBuffer(html);
    }
    throw new Error(`word module cannot export to "${format}"`);
  },

  async index(handle: DocumentHandle): Promise<SearchableText> {
    return { documentId: handle.id, text: await extractRawText(handle.filePath) };
  },

  async peek(filePath: string): Promise<PeekInfo> {
    const text = await extractRawText(filePath);
    return { title: firstNonEmptyLine(text) };
  },

  aiTools: [summarizeTool, rewriteTool, toneAdjustTool, translateTool],
};

export default wordModule;
