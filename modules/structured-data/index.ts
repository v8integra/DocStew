import * as fs from "fs";
import { chat } from "../../src/main/ai-engine/ollamaClient";
import { getChatModel } from "../../src/main/ai-engine/config";
import { detectFormat, parseStructuredText, stringifyPretty, stringifyMinified, toCsvBuffer } from "./formats";
import type { StructuredFormat } from "./formats";
import { highlightStructuredText } from "./highlight";
import type {
  AITool,
  DocStewModule,
  DocumentHandle,
  ModuleOperation,
  RenderDescriptor,
  SearchableText,
} from "../../src/shared/module-contract";

export interface StructuredDataRenderData {
  format: StructuredFormat;
  raw: string;
  valid: boolean;
  error?: string;
  html: string;
}

// A local 3B-class model's usable context is small; capping keeps prompts
// fast and avoids silently truncating inside Ollama in a way we can't see —
// same reasoning and limit as every other module's aiTools.
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

function readRaw(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8");
}

const BLANK_DOCUMENT: Record<StructuredFormat, string> = {
  json: "{}\n",
  yaml: "{}\n",
  xml: "<root></root>\n",
};

const explainStructureTool: AITool = {
  name: "explainStructure",
  description: "Explain in plain English what this file's structure represents.",
  parameters: {},
  async handler(handle: DocumentHandle): Promise<unknown> {
    const model = requireChatModel();
    const raw = readRaw(handle.filePath);
    if (raw.trim().length === 0) return { explanation: "(nothing to explain — this file is empty)" };
    const format = detectFormat(handle.filePath);
    const explanation = await chat(model, [
      {
        role: "system",
        content:
          `The user has a ${format.toUpperCase()} file. Explain in plain English what its structure represents — ` +
          "the overall shape, key fields, and what the data appears to be used for. Be concise.",
      },
      { role: "user", content: truncate(raw) },
    ]);
    return { explanation: explanation.trim() };
  },
};

const fixMalformedTool: AITool = {
  name: "fixMalformed",
  description: "Attempt to fix syntax errors in this file using the local model.",
  parameters: {},
  async handler(handle: DocumentHandle): Promise<unknown> {
    const raw = readRaw(handle.filePath);
    const format = detectFormat(handle.filePath);
    try {
      parseStructuredText(raw, format);
      return { fixed: raw, alreadyValid: true };
    } catch {
      // falls through — the file really is malformed, ask the model to fix it
    }
    const model = requireChatModel();
    const fixed = await chat(model, [
      {
        role: "system",
        content:
          `The user's ${format.toUpperCase()} file has a syntax error. Fix it and respond with ONLY the ` +
          `corrected ${format.toUpperCase()} text — no explanation, no code fences, no preamble.`,
      },
      { role: "user", content: truncate(raw) },
    ]);
    return { fixed: fixed.trim(), alreadyValid: false };
  },
};

const prettyPrintQuery: ModuleOperation = {
  name: "prettyPrint",
  description: "Reformat the given text with standard indentation.",
  parameters: { raw: { type: "string" } },
  async handler(handle: DocumentHandle, args: Record<string, unknown>): Promise<unknown> {
    const raw = String(args.raw ?? "");
    const format = detectFormat(handle.filePath);
    const value = parseStructuredText(raw, format);
    return { raw: stringifyPretty(value, format) };
  },
};

const minifyQuery: ModuleOperation = {
  name: "minify",
  description: "Collapse the given text to its most compact form.",
  parameters: { raw: { type: "string" } },
  async handler(handle: DocumentHandle, args: Record<string, unknown>): Promise<unknown> {
    const raw = String(args.raw ?? "");
    const format = detectFormat(handle.filePath);
    const value = parseStructuredText(raw, format);
    return { raw: stringifyMinified(value, format) };
  },
};

const highlightQuery: ModuleOperation = {
  name: "highlight",
  description: "Syntax-highlight the given text for preview.",
  parameters: { raw: { type: "string" } },
  async handler(handle: DocumentHandle, args: Record<string, unknown>): Promise<unknown> {
    const raw = String(args.raw ?? "");
    const format = detectFormat(handle.filePath);
    return { html: highlightStructuredText(raw, format) };
  },
};

const structuredDataModule: DocStewModule = {
  id: "structured-data",
  supportedExtensions: [".json", ".xml", ".yaml", ".yml"],

  open(filePath: string): DocumentHandle {
    return { id: filePath, filePath, moduleId: "structured-data" };
  },

  render(handle: DocumentHandle): RenderDescriptor {
    const format = detectFormat(handle.filePath);
    const raw = readRaw(handle.filePath);
    let valid = true;
    let error: string | undefined;
    try {
      parseStructuredText(raw, format);
    } catch (parseError) {
      valid = false;
      error = parseError instanceof Error ? parseError.message : String(parseError);
    }
    const data: StructuredDataRenderData = { format, raw, valid, error, html: highlightStructuredText(raw, format) };
    return { kind: "structured-data", data };
  },

  save(handle: DocumentHandle, content?: unknown): void {
    const { raw } = content as { raw: string };
    fs.writeFileSync(handle.filePath, raw);
  },

  async export(handle: DocumentHandle, format: string): Promise<Buffer> {
    const sourceFormat = detectFormat(handle.filePath);
    const raw = readRaw(handle.filePath);
    if (format === "txt" || format === sourceFormat) {
      return Buffer.from(raw, "utf-8");
    }
    const value = parseStructuredText(raw, sourceFormat);
    if (format === "json") return Buffer.from(stringifyPretty(value, "json"), "utf-8");
    if (format === "xml") return Buffer.from(stringifyPretty(value, "xml"), "utf-8");
    if (format === "yaml") return Buffer.from(stringifyPretty(value, "yaml"), "utf-8");
    if (format === "csv") return toCsvBuffer(value);
    throw new Error(`structured-data module cannot export to "${format}"`);
  },

  index(handle: DocumentHandle): SearchableText {
    return { documentId: handle.id, text: readRaw(handle.filePath) };
  },

  create(filePath: string): DocumentHandle {
    if (fs.existsSync(filePath)) {
      throw new Error(`A file already exists at "${filePath}".`);
    }
    const format = detectFormat(filePath);
    fs.writeFileSync(filePath, BLANK_DOCUMENT[format]);
    return { id: filePath, filePath, moduleId: "structured-data" };
  },

  aiTools: [explainStructureTool, fixMalformedTool],
  queries: [prettyPrintQuery, minifyQuery, highlightQuery],
};

export default structuredDataModule;
