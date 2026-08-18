import ExcelJS from "exceljs";
import { colToLetter, parseCellRef } from "./sheetModel";
import type { CellData, SheetData, WorkbookData } from "./sheetModel";

interface ExcelJSFormulaValue {
  formula: string;
  result?: unknown;
}

function isFormulaValue(value: unknown): value is ExcelJSFormulaValue {
  return typeof value === "object" && value !== null && "formula" in value;
}

/** Normalizes exceljs's various cell value shapes (string/number/boolean/
 * Date/richtext/hyperlink/formula/error) down to this module's plain value
 * types. Anything exotic is stringified rather than dropped. */
function normalizeValue(raw: ExcelJS.CellValue): CellData["value"] {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") return raw;
  if (raw instanceof Date) return raw.toISOString();
  if (isFormulaValue(raw)) {
    const result = raw.result;
    if (result === null || result === undefined) return null;
    if (typeof result === "string" || typeof result === "number" || typeof result === "boolean") return result;
    return String(result);
  }
  if (typeof raw === "object" && "richText" in raw) {
    return (raw.richText as Array<{ text: string }>).map((r) => r.text).join("");
  }
  if (typeof raw === "object" && "text" in raw) {
    return String((raw as { text: unknown }).text);
  }
  return String(raw);
}

function sheetFromWorksheet(ws: ExcelJS.Worksheet): SheetData {
  const cells: Record<string, CellData> = {};
  ws.eachRow((row, rowNumber) => {
    row.eachCell((cell, colNumber) => {
      const key = `${colToLetter(colNumber)}${rowNumber}`;
      const raw = cell.value;
      if (isFormulaValue(raw)) {
        cells[key] = { value: normalizeValue(raw), formula: raw.formula };
      } else {
        const value = normalizeValue(raw);
        if (value !== null) cells[key] = { value };
      }
    });
  });
  return { name: ws.name, cells };
}

function populateWorksheet(ws: ExcelJS.Worksheet, sheet: SheetData): void {
  for (const [key, cell] of Object.entries(sheet.cells)) {
    const { row, col } = parseCellRef(key);
    if (cell.formula !== undefined) {
      const result = typeof cell.value === "object" ? undefined : cell.value ?? undefined;
      ws.getCell(row, col).value = { formula: cell.formula, result } as ExcelJS.CellValue;
    } else {
      ws.getCell(row, col).value = cell.value;
    }
  }
}

export async function readXlsx(filePath: string): Promise<WorkbookData> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  return { sheets: workbook.worksheets.map(sheetFromWorksheet) };
}

export async function writeXlsxBuffer(workbook: WorkbookData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  for (const sheet of workbook.sheets) {
    populateWorksheet(wb.addWorksheet(sheet.name), sheet);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function writeXlsx(filePath: string, workbook: WorkbookData): Promise<void> {
  const wb = new ExcelJS.Workbook();
  for (const sheet of workbook.sheets) {
    populateWorksheet(wb.addWorksheet(sheet.name), sheet);
  }
  await wb.xlsx.writeFile(filePath);
}

export async function readCsv(filePath: string): Promise<SheetData> {
  const workbook = new ExcelJS.Workbook();
  await workbook.csv.readFile(filePath);
  return sheetFromWorksheet(workbook.worksheets[0]);
}

export async function writeCsv(filePath: string, sheet: SheetData): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheet.name);
  // CSV has no formula concept — write the resolved value, matching how a
  // real spreadsheet app exports formulas to CSV.
  for (const [key, cell] of Object.entries(sheet.cells)) {
    const { row, col } = parseCellRef(key);
    ws.getCell(row, col).value = cell.value;
  }
  await wb.csv.writeFile(filePath);
}

export async function writeCsvBuffer(sheet: SheetData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheet.name);
  for (const [key, cell] of Object.entries(sheet.cells)) {
    const { row, col } = parseCellRef(key);
    ws.getCell(row, col).value = cell.value;
  }
  return Buffer.from(await wb.csv.writeBuffer());
}
