import { test } from "node:test";
import assert from "node:assert/strict";
import { blocksToDocxBuffer } from "./blocksToDocx";
import { convertToHtml, extractRawText } from "./docxConversion";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { WordBlock } from "./wordBlocks";

async function writeAndConvert(blocks: WordBlock[]) {
  const buffer = await blocksToDocxBuffer(blocks);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "docstew-word-test-"));
  const filePath = path.join(dir, "out.docx");
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

test("blocksToDocxBuffer() round-trips headings, bold, and italic", async () => {
  const filePath = await writeAndConvert([
    { type: "heading", level: 1, runs: [{ text: "Title" }] },
    { type: "paragraph", runs: [{ text: "bold part", bold: true }, { text: " normal part" }] },
    { type: "paragraph", runs: [{ text: "italic part", italic: true }] },
  ]);
  const { html } = await convertToHtml(filePath);
  assert.match(html, /<h1>Title<\/h1>/);
  assert.match(html, /<strong>bold part<\/strong> normal part/);
  assert.match(html, /<em>italic part<\/em>/);
});

test("blocksToDocxBuffer() round-trips bullet and numbered lists", async () => {
  const filePath = await writeAndConvert([
    { type: "bulletItem", runs: [{ text: "bullet one" }] },
    { type: "bulletItem", runs: [{ text: "bullet two" }] },
    { type: "numberItem", runs: [{ text: "number one" }] },
    { type: "numberItem", runs: [{ text: "number two" }] },
  ]);
  const { html } = await convertToHtml(filePath);
  assert.match(html, /<ul><li>bullet one<\/li><li>bullet two<\/li><\/ul>/);
  assert.match(html, /<ol><li>number one<\/li><li>number two<\/li><\/ol>/);
});

test("blocksToDocxBuffer() round-trips a table", async () => {
  const filePath = await writeAndConvert([
    {
      type: "table",
      rows: [
        [[{ text: "A1" }], [{ text: "B1" }]],
        [[{ text: "A2" }], [{ text: "B2" }]],
      ],
    },
  ]);
  const text = await extractRawText(filePath);
  assert.match(text, /A1/);
  assert.match(text, /B1/);
  assert.match(text, /A2/);
  assert.match(text, /B2/);
});

test("blocksToDocxBuffer() produces a real, non-empty .docx for an empty block list", async () => {
  const buffer = await blocksToDocxBuffer([]);
  assert.ok(buffer.length > 0);
});
