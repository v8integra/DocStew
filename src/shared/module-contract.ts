/**
 * The plugin contract every document-type module implements (see docstew-plan.md §4).
 * Core (file manager, plugin registry, AI engine, UI shell) only ever talks to
 * modules through this interface — it never needs to know what a "PDF" or a
 * "spreadsheet" is.
 */

export interface DocumentHandle {
  id: string;
  filePath: string;
  moduleId: string;
}

/** What a module's render() returns. Renderer-side UI is a later phase — for
 * now this is a generic descriptor a fallback view in the UI shell can display,
 * so the contract is exercisable end-to-end before any module has real UI. */
export interface RenderDescriptor {
  kind: string;
  data: unknown;
}

export interface SearchableText {
  documentId: string;
  text: string;
}

export interface AITool {
  name: string;
  description: string;
  /** JSON-schema-shaped parameter description, passed to the local model's tool-calling API. */
  parameters: Record<string, unknown>;
  handler: (handle: DocumentHandle, args: Record<string, unknown>) => Promise<unknown>;
}

export interface DocStewModule {
  id: string;
  supportedExtensions: string[];
  open(filePath: string): DocumentHandle | Promise<DocumentHandle>;
  render(handle: DocumentHandle): RenderDescriptor | Promise<RenderDescriptor>;
  save(handle: DocumentHandle): void | Promise<void>;
  export(handle: DocumentHandle, format: string): Buffer | Promise<Buffer>;
  index(handle: DocumentHandle): SearchableText | Promise<SearchableText>;
  aiTools: AITool[];
}
