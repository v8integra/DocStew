import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell } from "docx";
import type { WordBlock, WordRun } from "./wordBlocks";

const NUMBERING_REFERENCE = "docstew-numbered-list";

const HEADING_LEVELS = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
} as const;

function buildRuns(runs: WordRun[]): TextRun[] {
  return runs.map(
    (run) =>
      new TextRun({
        text: run.text,
        bold: run.bold,
        italics: run.italic,
        underline: run.underline ? {} : undefined,
      })
  );
}

export async function blocksToDocxBuffer(blocks: WordBlock[]): Promise<Buffer> {
  const children: Array<Paragraph | Table> = blocks.map((block) => {
    switch (block.type) {
      case "heading":
        return new Paragraph({ heading: HEADING_LEVELS[block.level], children: buildRuns(block.runs) });
      case "paragraph":
        return new Paragraph({ children: buildRuns(block.runs) });
      case "bulletItem":
        return new Paragraph({ bullet: { level: 0 }, children: buildRuns(block.runs) });
      case "numberItem":
        return new Paragraph({ numbering: { reference: NUMBERING_REFERENCE, level: 0 }, children: buildRuns(block.runs) });
      case "table":
        return new Table({
          rows: block.rows.map(
            (row) =>
              new TableRow({
                children: row.map(
                  (cellRuns) => new TableCell({ children: [new Paragraph({ children: buildRuns(cellRuns) })] })
                ),
              })
          ),
        });
    }
  });

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: NUMBERING_REFERENCE,
          levels: [{ level: 0, format: "decimal", text: "%1.", alignment: "start" }],
        },
      ],
    },
    sections: [{ children }],
  });

  return Packer.toBuffer(doc);
}
