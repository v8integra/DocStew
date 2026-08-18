// fast-formula-parser ships no type declarations of its own (and none exist
// on @types either) — this is the minimal real shape needed for the API this
// module actually uses (verified against the package's own README/source,
// not guessed).
declare module "fast-formula-parser" {
  export interface CellRef {
    sheet: string;
    row: number;
    col: number;
  }

  export interface RangeRef {
    sheet: string;
    from: { row: number; col: number };
    to: { row: number; col: number };
  }

  export interface FormulaParserOptions {
    functions?: Record<string, (...args: unknown[]) => unknown>;
    onVariable?: (name: string, sheetName?: string) => CellRef | RangeRef;
    onCell?: (ref: CellRef) => unknown;
    onRange?: (ref: RangeRef) => unknown[][];
  }

  export interface Position {
    row: number;
    col: number;
    sheet: string;
  }

  export class FormulaError {
    constructor(error: string, details?: string);
    toString(): string;
  }

  export default class FormulaParser {
    constructor(options?: FormulaParserOptions);
    parse(formula: string, position: Position, allowReturnArray?: boolean): unknown;
    parseAsync(formula: string, position: Position, allowReturnArray?: boolean): Promise<unknown>;
  }
}
