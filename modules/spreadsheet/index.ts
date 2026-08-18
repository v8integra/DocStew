import * as path from "path";
import { readXlsx, writeXlsx, writeXlsxBuffer, readCsv, writeCsv, writeCsvBuffer } from "./xlsxIO";
import { recalculateSheet } from "./formulaEngine";
import { buildRenderData, sheetToCsvText } from "./renderData";
import type { WorkbookData } from "./sheetModel";
import { chat } from "../../src/main/ai-engine/ollamaClient";
import { getChatModel } from "../../src/main/ai-engine/config";
import { translateText } from "../../src/main/translation/translationService";
import type {
  AITool,
  DocStewModule,
  DocumentHandle,
  ModuleOperation,
  PeekInfo,
  RenderDescriptor,
  SearchableText,
} from "../../src/shared/module-contract";

const MAX_CHARS_FOR_MODEL = 6000;

function truncate(text: string): string {
  return text.length > MAX_CHARS_FOR_MODEL ? `${text.slice(0, MAX_CHARS_FOR_MODEL)}\n[...truncated...]` : text;
}

function requireChatModel(): string {
  const model = getChatModel();
  if (!model) {
    throw new Error("No local chat model is available. Install Ollama and pull a model to use AI features.");
  }
  return model;
}

const ACTIVE_SHEET_INDEX = 0; // "single active sheet" scope — always the first sheet; others are preserved untouched.

function isCsv(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === ".csv";
}

async function loadWorkbook(filePath: string): Promise<WorkbookData> {
  if (isCsv(filePath)) {
    return { sheets: [await readCsv(filePath)] };
  }
  return readXlsx(filePath);
}

async function loadAndRecalculate(filePath: string): Promise<WorkbookData> {
  const workbook = await loadWorkbook(filePath);
  recalculateSheet(workbook.sheets[ACTIVE_SHEET_INDEX]);
  return workbook;
}

async function saveWorkbook(filePath: string, workbook: WorkbookData): Promise<void> {
  if (isCsv(filePath)) {
    await writeCsv(filePath, workbook.sheets[ACTIVE_SHEET_INDEX]);
  } else {
    await writeXlsx(filePath, workbook);
  }
}

const generateFormulaTool: AITool = {
  name: "generateFormula",
  description: "Generate an Excel-style formula from a plain-English instruction.",
  parameters: { instruction: { type: "string" } },
  async handler(handle: DocumentHandle, args: Record<string, unknown>): Promise<unknown> {
    const model = requireChatModel();
    const instruction = String(args.instruction ?? "").trim();
    if (!instruction) throw new Error("An instruction is required.");
    const workbook = await loadAndRecalculate(handle.filePath);
    const sheetText = truncate(sheetToCsvText(workbook.sheets[ACTIVE_SHEET_INDEX]));
    const formula = await chat(model, [
      {
        role: "system",
        content:
          "You are a spreadsheet formula assistant. Given the sheet data below (CSV, one row per line, " +
          "columns are A, B, C... in order), respond with ONLY a single Excel-style formula (starting with =) " +
          "that accomplishes the user's request. No explanation.\n\nSheet data:\n" + (sheetText || "(empty sheet)"),
      },
      { role: "user", content: instruction },
    ]);
    return { formula: formula.trim() };
  },
};

const cleanDataTool: AITool = {
  name: "cleanData",
  description: "Analyze the sheet for data quality issues and suggest cleanup actions.",
  parameters: {},
  async handler(handle: DocumentHandle): Promise<unknown> {
    const model = requireChatModel();
    const workbook = await loadAndRecalculate(handle.filePath);
    const sheetText = truncate(sheetToCsvText(workbook.sheets[ACTIVE_SHEET_INDEX]));
    if (sheetText.trim().length === 0) return { report: "(nothing to analyze — this sheet is empty)" };
    const report = await chat(model, [
      {
        role: "system",
        content:
          "You are a data-cleaning assistant. Review the CSV data below and report any data quality issues " +
          "(duplicates, inconsistent formatting, missing values, obvious outliers or typos) and suggest fixes. Be concise.",
      },
      { role: "user", content: sheetText },
    ]);
    return { report: report.trim() };
  },
};

const translateTool: AITool = {
  name: "translate",
  description: "Translate the active sheet's text content into another language.",
  parameters: { targetLanguage: { type: "string" }, sourceLanguage: { type: "string" } },
  async handler(handle: DocumentHandle, args: Record<string, unknown>): Promise<unknown> {
    const targetLanguage = String(args.targetLanguage ?? "").trim();
    const sourceLanguage = args.sourceLanguage ? String(args.sourceLanguage).trim() : undefined;
    const workbook = await loadAndRecalculate(handle.filePath);
    const sheetText = truncate(sheetToCsvText(workbook.sheets[ACTIVE_SHEET_INDEX]));
    return translateText(sheetText, targetLanguage, sourceLanguage);
  },
};

const setCellOperation: ModuleOperation = {
  name: "setCell",
  description: "Set a cell's value or formula and recalculate the sheet.",
  parameters: { ref: { type: "string" }, input: { type: "string" } },
  async handler(handle: DocumentHandle, args: Record<string, unknown>): Promise<unknown> {
    const ref = String(args.ref ?? "");
    const input = String(args.input ?? "");
    if (!ref) throw new Error("A cell reference is required.");

    const workbook = await loadWorkbook(handle.filePath);
    const sheet = workbook.sheets[ACTIVE_SHEET_INDEX];

    const trimmed = input.trim();
    if (trimmed === "") {
      delete sheet.cells[ref];
    } else if (trimmed.startsWith("=")) {
      sheet.cells[ref] = { value: null, formula: trimmed.slice(1) };
    } else {
      const isNumeric = /^-?\d+(\.\d+)?$/.test(trimmed);
      sheet.cells[ref] = { value: isNumeric ? Number(trimmed) : trimmed };
    }

    recalculateSheet(sheet);
    await saveWorkbook(handle.filePath, workbook);
    return { renderData: buildRenderData(workbook, ACTIVE_SHEET_INDEX) };
  },
};

const spreadsheetModule: DocStewModule = {
  id: "spreadsheet",
  supportedExtensions: [".xlsx", ".csv"],

  open(filePath: string): DocumentHandle {
    return { id: filePath, filePath, moduleId: "spreadsheet" };
  },

  async render(handle: DocumentHandle): Promise<RenderDescriptor> {
    const workbook = await loadAndRecalculate(handle.filePath);
    return { kind: "spreadsheet", data: buildRenderData(workbook, ACTIVE_SHEET_INDEX) };
  },

  save(): void {
    throw new Error("Spreadsheet edits save immediately per cell — there's no separate Save step.");
  },

  async export(handle: DocumentHandle, format: string): Promise<Buffer> {
    const workbook = await loadAndRecalculate(handle.filePath);
    if (format === "xlsx") {
      return isCsv(handle.filePath) ? writeXlsxBuffer(workbook) : (await import("fs")).promises.readFile(handle.filePath);
    }
    if (format === "csv") {
      return isCsv(handle.filePath)
        ? (await import("fs")).promises.readFile(handle.filePath)
        : writeCsvBuffer(workbook.sheets[ACTIVE_SHEET_INDEX]);
    }
    if (format === "txt") {
      return Buffer.from(sheetToCsvText(workbook.sheets[ACTIVE_SHEET_INDEX]).replace(/,/g, "\t"), "utf-8");
    }
    throw new Error(`spreadsheet module cannot export to "${format}"`);
  },

  async index(handle: DocumentHandle): Promise<SearchableText> {
    const workbook = await loadAndRecalculate(handle.filePath);
    const text = workbook.sheets.map((sheet) => `${sheet.name}\n${sheetToCsvText(sheet)}`).join("\n\n");
    return { documentId: handle.id, text };
  },

  async peek(filePath: string): Promise<PeekInfo> {
    const workbook = await loadWorkbook(filePath);
    const title = workbook.sheets.length > 1 ? `${workbook.sheets[0].name} (+${workbook.sheets.length - 1} more)` : undefined;
    return { title };
  },

  aiTools: [generateFormulaTool, cleanDataTool, translateTool],
  operations: [setCellOperation],
};

export default spreadsheetModule;
