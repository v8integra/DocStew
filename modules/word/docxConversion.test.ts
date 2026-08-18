import { test } from "node:test";
import assert from "node:assert/strict";
import { makeTestDocx } from "./testFixtures/makeTestDocx";
import { convertToHtml, extractRawText } from "./docxConversion";
import { blocksToDocxBuffer } from "./blocksToDocx";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

test("convertToHtml() converts real headings, paragraphs, and bullets", async () => {
  const filePath = await makeTestDocx({
    title: "My Report",
    paragraphs: ["A body paragraph."],
    bulletItems: ["First item", "Second item"],
  });
  const { html, warnings } = await convertToHtml(filePath);
  assert.match(html, /<h1>My Report<\/h1>/);
  assert.match(html, /<p>A body paragraph\.<\/p>/);
  assert.match(html, /<ul><li>First item<\/li><li>Second item<\/li><\/ul>/);
  assert.deepEqual(warnings, []);
});

test("convertToHtml() preserves underline via the style map (mammoth drops it by default)", async () => {
  const buffer = await blocksToDocxBuffer([{ type: "paragraph", runs: [{ text: "underlined", underline: true }] }]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "docstew-word-test-"));
  const filePath = path.join(dir, "u.docx");
  fs.writeFileSync(filePath, buffer);

  const { html } = await convertToHtml(filePath);
  assert.match(html, /<u>underlined<\/u>/);
});

test("extractRawText() returns real plain text", async () => {
  const filePath = await makeTestDocx({ title: "Title Here", paragraphs: ["Body text here."] });
  const text = await extractRawText(filePath);
  assert.match(text, /Title Here/);
  assert.match(text, /Body text here\./);
});
