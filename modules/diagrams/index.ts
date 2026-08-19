import * as fs from "fs";
import sharp from "sharp";
import { createBlankDiagram, parseDiagram, serializeDiagram } from "./diagramModel";
import type { DiagramDocument } from "./diagramModel";
import { diagramToSvg } from "./diagramSvg";
import type {
  DocStewModule,
  DocumentHandle,
  RenderDescriptor,
  SearchableText,
} from "../../src/shared/module-contract";

export type { DiagramDocument, DiagramShape, DiagramConnector, ShapeType } from "./diagramModel";

function readDiagram(filePath: string): DiagramDocument {
  return parseDiagram(fs.readFileSync(filePath, "utf-8"));
}

const diagramsModule: DocStewModule = {
  id: "diagrams",
  supportedExtensions: [".diagram"],

  open(filePath: string): DocumentHandle {
    return { id: filePath, filePath, moduleId: "diagrams" };
  },

  render(handle: DocumentHandle): RenderDescriptor {
    return { kind: "diagram", data: readDiagram(handle.filePath) };
  },

  save(handle: DocumentHandle, content?: unknown): void {
    const doc = content as DiagramDocument;
    fs.writeFileSync(handle.filePath, serializeDiagram(doc));
  },

  async export(handle: DocumentHandle, format: string): Promise<Buffer> {
    const doc = readDiagram(handle.filePath);
    const svg = diagramToSvg(doc);
    if (format === "svg") return Buffer.from(svg, "utf-8");
    if (format === "png") return sharp(Buffer.from(svg)).png().toBuffer();
    throw new Error(`diagrams module cannot export to "${format}"`);
  },

  index(handle: DocumentHandle): SearchableText {
    const doc = readDiagram(handle.filePath);
    const text = [...doc.shapes.map((s) => s.label), ...doc.connectors.map((c) => c.label)]
      .filter((label) => label.trim().length > 0)
      .join("\n");
    return { documentId: handle.id, text };
  },

  create(filePath: string): DocumentHandle {
    if (fs.existsSync(filePath)) {
      throw new Error(`A diagram already exists at "${filePath}".`);
    }
    fs.writeFileSync(filePath, serializeDiagram(createBlankDiagram()));
    return { id: filePath, filePath, moduleId: "diagrams" };
  },

  aiTools: [],
};

export default diagramsModule;
