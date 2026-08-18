/**
 * The structured content model shared between the renderer (which builds it
 * by walking the contenteditable's DOM after an edit) and the main process
 * (which builds a real .docx from it via the `docx` library). Kept
 * deliberately small — headings/paragraphs/lists/tables with bold/italic/
 * underline runs — matching this phase's "core" rich-text scope. Anything
 * in an opened .docx beyond what this model represents (images, complex
 * styles, headers/footers, etc.) won't round-trip through an edit+save.
 */
export interface WordRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export type WordBlock =
  | { type: "heading"; level: 1 | 2 | 3; runs: WordRun[] }
  | { type: "paragraph"; runs: WordRun[] }
  | { type: "bulletItem"; runs: WordRun[] }
  | { type: "numberItem"; runs: WordRun[] }
  | { type: "table"; rows: WordRun[][][] };
