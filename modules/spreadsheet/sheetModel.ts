/** The structured data model for a spreadsheet — shared by the xlsx/csv I/O,
 * the formula engine, and the render-data builder. A cell holds either a
 * literal value or a formula (whose computed result is cached in `value`
 * after recalculation, matching how .xlsx itself caches formula results). */
export interface CellData {
  value: string | number | boolean | null;
  formula?: string;
}

export interface SheetData {
  name: string;
  cells: Record<string, CellData>;
}

export interface WorkbookData {
  sheets: SheetData[];
}

export function colToLetter(col: number): string {
  let letters = "";
  let n = col;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

export function letterToCol(letters: string): number {
  let col = 0;
  for (const char of letters.toUpperCase()) {
    col = col * 26 + (char.charCodeAt(0) - 64);
  }
  return col;
}

export function cellRefToKey(row: number, col: number): string {
  return `${colToLetter(col)}${row}`;
}

export function parseCellRef(ref: string): { row: number; col: number } {
  const match = ref.match(/^([A-Za-z]+)(\d+)$/);
  if (!match) throw new Error(`Invalid cell reference "${ref}".`);
  return { row: Number(match[2]), col: letterToCol(match[1]) };
}

export function computeBounds(sheet: SheetData): { maxRow: number; maxCol: number } {
  let maxRow = 0;
  let maxCol = 0;
  for (const key of Object.keys(sheet.cells)) {
    const { row, col } = parseCellRef(key);
    if (row > maxRow) maxRow = row;
    if (col > maxCol) maxCol = col;
  }
  return { maxRow, maxCol };
}
