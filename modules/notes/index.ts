import * as fs from "fs";
import * as path from "path";
import { renderMarkdownToHtml } from "../../src/main/markdown";
import { chat } from "../../src/main/ai-engine/ollamaClient";
import { getChatModel } from "../../src/main/ai-engine/config";
import { parseNote, serializeNote, type ParsedNote } from "./frontmatter";
import type { AITool, DocStewModule, DocumentHandle, PeekInfo, RenderDescriptor, SearchableText } from "../../src/shared/module-contract";

export interface NotesRenderData extends ParsedNote {
  html: string;
}

function fallbackTitle(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}

function readAndParse(filePath: string): ParsedNote {
  const raw = fs.readFileSync(filePath, "utf-8");
  return parseNote(raw, fallbackTitle(filePath));
}

const summarizeTool: AITool = {
  name: "summarize",
  description: "Summarize this note in 2-3 concise sentences.",
  parameters: {},
  async handler(handle: DocumentHandle): Promise<unknown> {
    const model = getChatModel();
    if (!model) {
      throw new Error("No local chat model is available. Install Ollama and pull a model to use AI features.");
    }
    const note = readAndParse(handle.filePath);
    if (note.body.trim().length === 0) {
      return { summary: "(nothing to summarize — this note is empty)" };
    }
    const summary = await chat(model, [
      {
        role: "system",
        content: "Summarize the user's note in 2-3 concise sentences. Respond with only the summary, no preamble.",
      },
      { role: "user", content: note.body },
    ]);
    return { summary: summary.trim() };
  },
};

const notesModule: DocStewModule = {
  id: "notes",
  supportedExtensions: [".md", ".markdown"],

  open(filePath: string): DocumentHandle {
    return { id: filePath, filePath, moduleId: "notes" };
  },

  async render(handle: DocumentHandle): Promise<RenderDescriptor> {
    const note = readAndParse(handle.filePath);
    const data: NotesRenderData = { ...note, html: await renderMarkdownToHtml(note.body) };
    return { kind: "notes", data };
  },

  save(handle: DocumentHandle, content?: unknown): void {
    const note = content as ParsedNote;
    fs.writeFileSync(handle.filePath, serializeNote(note));
  },

  async export(handle: DocumentHandle, format: string): Promise<Buffer> {
    const note = readAndParse(handle.filePath);
    if (format === "md") {
      return fs.readFileSync(handle.filePath);
    }
    if (format === "txt") {
      return Buffer.from(note.body, "utf-8");
    }
    if (format === "html") {
      const body = await renderMarkdownToHtml(note.body);
      const html = `<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>${note.title}</title></head><body>\n<h1>${note.title}</h1>\n${body}\n</body></html>`;
      return Buffer.from(html, "utf-8");
    }
    throw new Error(`notes module cannot export to "${format}"`);
  },

  index(handle: DocumentHandle): SearchableText {
    const note = readAndParse(handle.filePath);
    return { documentId: handle.id, text: [note.title, ...note.tags, note.body].join("\n") };
  },

  create(filePath: string): DocumentHandle {
    if (fs.existsSync(filePath)) {
      throw new Error(`A note already exists at "${filePath}".`);
    }
    const note: ParsedNote = { title: fallbackTitle(filePath), tags: [], body: "" };
    fs.writeFileSync(filePath, serializeNote(note));
    return { id: filePath, filePath, moduleId: "notes" };
  },

  peek(filePath: string): PeekInfo {
    const note = readAndParse(filePath);
    return { title: note.title, tags: note.tags };
  },

  aiTools: [summarizeTool],
};

export default notesModule;
