import FormulaParser, { FormulaError } from "fast-formula-parser";
import type { SheetData } from "./sheetModel";
import { cellRefToKey, parseCellRef } from "./sheetModel";

function cellValue(sheet: SheetData, row: number, col: number): unknown {
  const cell = sheet.cells[cellRefToKey(row, col)];
  if (!cell) return null;
  return cell.value;
}

function makeParser(sheet: SheetData): FormulaParser {
  return new FormulaParser({
    onCell: ({ row, col }) => cellValue(sheet, row, col),
    onRange: (ref) => {
      const rows: unknown[][] = [];
      for (let row = ref.from.row; row <= ref.to.row; row++) {
        const rowValues: unknown[] = [];
        for (let col = ref.from.col; col <= ref.to.col; col++) {
          rowValues.push(cellValue(sheet, row, col));
        }
        rows.push(rowValues);
      }
      return rows;
    },
  });
}

/** Evaluates a formula (without the leading "=") against a sheet's current
 * values. Formula runtime errors (#DIV/0!, #REF!, etc.) and parse failures
 * both come back as their Excel-style error string rather than throwing —
 * a bad formula shouldn't crash the app, just show an error in that cell. */
export function evaluateFormula(formula: string, sheet: SheetData, row: number, col: number): string | number | boolean {
  const parser = makeParser(sheet);
  try {
    const result = parser.parse(formula, { row, col, sheet: sheet.name });
    if (result instanceof FormulaError) return result.toString();
    if (typeof result === "number" || typeof result === "string" || typeof result === "boolean") return result;
    return String(result);
  } catch {
    return "#ERROR!";
  }
}

/**
 * Recalculates every formula cell in a sheet. Not a real dependency graph —
 * just re-evaluates all formulas `passes` times so short chains (a formula
 * referencing another formula) converge. Deliberately simple for this
 * phase's "core" scope: no topological sort, no circular-reference
 * detection (a true cycle just stabilizes on whatever a fixed number of
 * passes produces rather than looping forever, but won't match Excel's
 * iterative-calc semantics for genuine cycles).
 */
export function recalculateSheet(sheet: SheetData, passes = 3): void {
  for (let pass = 0; pass < passes; pass++) {
    for (const [key, cell] of Object.entries(sheet.cells)) {
      if (cell.formula === undefined) continue;
      const { row, col } = parseCellRef(key);
      cell.value = evaluateFormula(cell.formula, sheet, row, col);
    }
  }
}
