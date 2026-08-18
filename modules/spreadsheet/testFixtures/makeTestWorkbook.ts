import ExcelJS from "exceljs";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export interface TestCell {
  ref: string;
  value?: string | number | boolean;
  formula?: string;
}

/** Creates a real .xlsx with real cells (including formulas, with a cached
 * result exceljs writes into the file) — used by tests instead of a fixture
 * binary. */
export async function makeTestWorkbook(sheets: Array<{ name: string; cells: TestCell[] }>): Promise<string> {
  const wb = new ExcelJS.Workbook();
  for (const sheetSpec of sheets) {
    const ws = wb.addWorksheet(sheetSpec.name);
    for (const cell of sheetSpec.cells) {
      if (cell.formula) {
        ws.getCell(cell.ref).value = { formula: cell.formula, result: cell.value } as ExcelJS.CellValue;
      } else {
        ws.getCell(cell.ref).value = cell.value ?? null;
      }
    }
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "docstew-sheet-test-"));
  const filePath = path.join(dir, "test.xlsx");
  await wb.xlsx.writeFile(filePath);
  return filePath;
}

export function makeTestCsv(rows: string[][]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "docstew-sheet-test-"));
  const filePath = path.join(dir, "test.csv");
  fs.writeFileSync(filePath, rows.map((r) => r.join(",")).join("\n"));
  return filePath;
}
