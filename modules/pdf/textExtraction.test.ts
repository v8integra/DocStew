import { test } from "node:test";
import assert from "node:assert/strict";
import { makeTestPdf } from "./testFixtures/makeTestPdf";
import { extractPdfText, extractFullText } from "./textExtraction";

test("extractPdfText() returns real text per page, in order", async () => {
  const filePath = await makeTestPdf(["Alpha content here", "Beta content here"]);
  const pages = await extractPdfText(filePath);
  assert.equal(pages.length, 2);
  assert.equal(pages[0].pageNumber, 1);
  assert.match(pages[0].text, /Alpha content here/);
  assert.equal(pages[1].pageNumber, 2);
  assert.match(pages[1].text, /Beta content here/);
});

test("extractFullText() joins every page's text", async () => {
  const filePath = await makeTestPdf(["First", "Second", "Third"]);
  const text = await extractFullText(filePath);
  assert.match(text, /First/);
  assert.match(text, /Second/);
  assert.match(text, /Third/);
});
