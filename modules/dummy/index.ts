import * as fs from "fs";
import type { DocStewModule, DocumentHandle, RenderDescriptor, SearchableText } from "../../src/shared/module-contract";

/**
 * The Phase 0 "hello world" module: proves the plugin contract is real and
 * loadable end-to-end before any actual document type is implemented.
 * Treats any file it's given as plain text.
 */
const dummyModule: DocStewModule = {
  id: "dummy",
  supportedExtensions: [".txt", ".dummy"],

  open(filePath: string): DocumentHandle {
    return { id: filePath, filePath, moduleId: "dummy" };
  },

  render(handle: DocumentHandle): RenderDescriptor {
    const text = fs.existsSync(handle.filePath) ? fs.readFileSync(handle.filePath, "utf-8") : "";
    return { kind: "plaintext", data: text };
  },

  save(handle: DocumentHandle): void {
    if (!fs.existsSync(handle.filePath)) {
      fs.writeFileSync(handle.filePath, "");
    }
  },

  export(handle: DocumentHandle, format: string): Buffer {
    if (format !== "txt") {
      throw new Error(`dummy module cannot export to "${format}"`);
    }
    return fs.readFileSync(handle.filePath);
  },

  index(handle: DocumentHandle): SearchableText {
    const text = fs.existsSync(handle.filePath) ? fs.readFileSync(handle.filePath, "utf-8") : "";
    return { documentId: handle.id, text };
  },

  aiTools: [
    {
      name: "wordCount",
      description: "Count the words in this document.",
      parameters: {},
      async handler(handle: DocumentHandle): Promise<unknown> {
        const text = fs.existsSync(handle.filePath) ? fs.readFileSync(handle.filePath, "utf-8") : "";
        const words = text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
        return { words };
      },
    },
  ],
};

export default dummyModule;
