import { cellRefToKey, computeBounds } from "./sheetModel";
import type { SheetData, WorkbookData } from "./sheetModel";

export interface RenderCell {
  value: string | number | boolean | null;
  formula?: string;
  display: string;
}

export interface SpreadsheetRenderData {
  sheetNames: string[];
  activeSheetIndex: number;
  activeSheet: {
    name: string;
    rowCount: number;
    colCount: number;
    cells: Record<string, RenderCell>;
  };
}

// Caps how much of a sheet the grid actually renders — a real limitation
// for very large spreadsheets, deliberate for this phase's "core" scope
// (avoids an unbounded DOM in the renderer).
const MIN_ROWS = 15;
const MAX_ROWS = 100;
const MIN_COLS = 8;
const MAX_COLS = 26;
const PADDING_ROWS = 5;
const PADDING_COLS = 3;

function displayOf(value: SheetData["cells"][string]["value"]): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

export function buildRenderData(workbook: WorkbookData, activeSheetIndex: number): SpreadsheetRenderData {
  const sheet = workbook.sheets[activeSheetIndex];
  const bounds = computeBounds(sheet);
  const rowCount = Math.min(Math.max(bounds.maxRow + PADDING_ROWS, MIN_ROWS), MAX_ROWS);
  const colCount = Math.min(Math.max(bounds.maxCol + PADDING_COLS, MIN_COLS), MAX_COLS);

  const cells: Record<string, RenderCell> = {};
  for (const [key, cell] of Object.entries(sheet.cells)) {
    cells[key] = { value: cell.value, formula: cell.formula, display: displayOf(cell.value) };
  }

  return {
    sheetNames: workbook.sheets.map((s) => s.name),
    activeSheetIndex,
    activeSheet: { name: sheet.name, rowCount, colCount, cells },
  };
}

/** A CSV-ish text dump of a sheet's actual content bounds, for AI tool
 * context — cheap and LLM-friendly, not meant to be a real CSV exporter
 * (see xlsxIO.ts's writeCsv for that). */
export function sheetToCsvText(sheet: SheetData): string {
  const bounds = computeBounds(sheet);
  const lines: string[] = [];
  for (let row = 1; row <= bounds.maxRow; row++) {
    const rowValues: string[] = [];
    for (let col = 1; col <= bounds.maxCol; col++) {
      const cell = sheet.cells[cellRefToKey(row, col)];
      rowValues.push(cell ? displayOf(cell.value) : "");
    }
    lines.push(rowValues.join(","));
  }
  return lines.join("\n");
}
