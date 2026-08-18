import * as path from "path";
import * as yaml from "js-yaml";
import { XMLParser, XMLBuilder } from "fast-xml-parser";
import ExcelJS from "exceljs";

export type StructuredFormat = "json" | "xml" | "yaml";

const EXTENSION_FORMATS: Record<string, StructuredFormat> = {
  ".json": "json",
  ".xml": "xml",
  ".yaml": "yaml",
  ".yml": "yaml",
};

export function detectFormat(filePath: string): StructuredFormat {
  const ext = path.extname(filePath).toLowerCase();
  const format = EXTENSION_FORMATS[ext];
  if (!format) throw new Error(`Unrecognized structured-data extension "${ext}".`);
  return format;
}

// fast-xml-parser needs matching attribute/build config on both the parse and
// build side, or attributes silently disappear on round-trip.
const XML_ATTRIBUTE_PREFIX = "@_";

function xmlParser(): XMLParser {
  return new XMLParser({ ignoreAttributes: false, attributeNamePrefix: XML_ATTRIBUTE_PREFIX });
}

function xmlBuilder(pretty: boolean): XMLBuilder {
  return new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: XML_ATTRIBUTE_PREFIX,
    format: pretty,
    indentBy: "  ",
  });
}

export function parseStructuredText(text: string, format: StructuredFormat): unknown {
  if (format === "json") return JSON.parse(text);
  if (format === "yaml") return yaml.load(text);
  return xmlParser().parse(text);
}

export function stringifyPretty(value: unknown, format: StructuredFormat): string {
  if (format === "json") return JSON.stringify(value, null, 2);
  if (format === "yaml") return yaml.dump(value, { indent: 2 });
  return xmlBuilder(true).build(value);
}

export function stringifyMinified(value: unknown, format: StructuredFormat): string {
  if (format === "json") return JSON.stringify(value);
  // YAML has no "minified" form in the JSON sense — flow style (all
  // collections rendered inline, e.g. `{a: 1, b: [2, 3]}`) is its closest
  // equivalent to a single-line, whitespace-insensitive representation.
  if (format === "yaml") return yaml.dump(value, { flowLevel: 0 }).trim();
  return xmlBuilder(false).build(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Converts an array of flat records into CSV — the only shape CSV can
 * represent without an opinionated flattening scheme. Nested object/array
 * values are serialized to their own JSON text within the cell rather than
 * silently dropped, so no data is lost even though it isn't fully tabular. */
export async function toCsvBuffer(value: unknown): Promise<Buffer> {
  if (!Array.isArray(value) || value.length === 0 || !value.every(isPlainRecord)) {
    throw new Error(
      "Only an array of objects (a list of records) can be converted to CSV — this data isn't shaped that way."
    );
  }
  const rows = value as Record<string, unknown>[];
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("data");
  sheet.addRow(columns);
  for (const row of rows) {
    sheet.addRow(
      columns.map((col) => {
        const cell = row[col];
        if (cell === undefined) return "";
        if (typeof cell === "object" && cell !== null) return JSON.stringify(cell);
        return cell as ExcelJS.CellValue;
      })
    );
  }
  return Buffer.from(await workbook.csv.writeBuffer());
}
