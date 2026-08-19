import * as fs from "fs";
import { readPptx, writePptx, presentationToHtml, presentationToText } from "./pptxIO";
import { createBlankPresentation } from "./presentationModel";
import { htmlToPdfBuffer } from "../../src/main/htmlToPdf";
import type {
  DocStewModule,
  DocumentHandle,
  RenderDescriptor,
  SearchableText,
} from "../../src/shared/module-contract";

export type { PresentationDocument, Slide } from "./presentationModel";

const presentationsModule: DocStewModule = {
  id: "presentations",
  supportedExtensions: [".pptx"],

  open(filePath: string): DocumentHandle {
    return { id: filePath, filePath, moduleId: "presentations" };
  },

  async render(handle: DocumentHandle): Promise<RenderDescriptor> {
    return { kind: "presentation", data: await readPptx(handle.filePath) };
  },

  async save(handle: DocumentHandle, content?: unknown): Promise<void> {
    await writePptx(handle.filePath, content as { slides: { title: string; bullets: string[] }[] });
  },

  async export(handle: DocumentHandle, format: string): Promise<Buffer> {
    if (format === "pptx") return fs.readFileSync(handle.filePath);
    const doc = await readPptx(handle.filePath);
    if (format === "txt") return Buffer.from(presentationToText(doc), "utf-8");
    if (format === "pdf") return htmlToPdfBuffer(presentationToHtml(doc));
    throw new Error(`presentations module cannot export to "${format}"`);
  },

  async index(handle: DocumentHandle): Promise<SearchableText> {
    const doc = await readPptx(handle.filePath);
    const text = doc.slides.flatMap((slide) => [slide.title, ...slide.bullets]).join("\n");
    return { documentId: handle.id, text };
  },

  async create(filePath: string): Promise<DocumentHandle> {
    if (fs.existsSync(filePath)) {
      throw new Error(`A presentation already exists at "${filePath}".`);
    }
    await writePptx(filePath, createBlankPresentation());
    return { id: filePath, filePath, moduleId: "presentations" };
  },

  aiTools: [],
};

export default presentationsModule;
