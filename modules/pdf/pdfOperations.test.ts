import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { PDFDocument } from "pdf-lib";
import { makeTestPdf } from "./testFixtures/makeTestPdf";
import { getPageCount, rotatePage, swapPages, mergePdfs, splitPdf } from "./pdfOperations";
import { extractPdfText } from "./textExtraction";

test("getPageCount() reports the real page count", async () => {
  const filePath = await makeTestPdf(["one", "two", "three"]);
  assert.equal(await getPageCount(filePath), 3);
});

test("rotatePage() persists a real rotation on the target page only", async () => {
  const filePath = await makeTestPdf(["page one", "page two"]);

  await rotatePage(filePath, 0, 90);

  const doc = await PDFDocument.load(fs.readFileSync(filePath));
  assert.equal(doc.getPage(0).getRotation().angle, 90);
  assert.equal(doc.getPage(1).getRotation().angle, 0);
});

test("rotatePage() wraps past 360 degrees", async () => {
  const filePath = await makeTestPdf(["page one"]);

  await rotatePage(filePath, 0, 90);
  await rotatePage(filePath, 0, 90);
  await rotatePage(filePath, 0, 90);
  await rotatePage(filePath, 0, 90);

  const doc = await PDFDocument.load(fs.readFileSync(filePath));
  assert.equal(doc.getPage(0).getRotation().angle, 0);
});

test("swapPages() actually reorders page content", async () => {
  const filePath = await makeTestPdf(["FIRST PAGE CONTENT", "SECOND PAGE CONTENT"]);

  await swapPages(filePath, 0, 1);

  const pages = await extractPdfText(filePath);
  assert.match(pages[0].text, /SECOND PAGE CONTENT/);
  assert.match(pages[1].text, /FIRST PAGE CONTENT/);
});

test("swapPages() rejects an out-of-range index", async () => {
  const filePath = await makeTestPdf(["only page"]);
  await assert.rejects(() => swapPages(filePath, 0, 5), /out of range/);
});

test("mergePdfs() combines both documents' pages into a new file, leaving originals untouched", async () => {
  const baseFile = await makeTestPdf(["BASE PAGE"]);
  const otherFile = await makeTestPdf(["OTHER PAGE"]);

  const outputPath = await mergePdfs(baseFile, otherFile);

  assert.notEqual(outputPath, baseFile);
  assert.notEqual(outputPath, otherFile);
  assert.equal(await getPageCount(outputPath), 2);
  const pages = await extractPdfText(outputPath);
  assert.match(pages[0].text, /BASE PAGE/);
  assert.match(pages[1].text, /OTHER PAGE/);
  assert.equal(await getPageCount(baseFile), 1, "original base file must be untouched");
});

test("splitPdf() divides a document into two new files at the given page, leaving the original untouched", async () => {
  const filePath = await makeTestPdf(["PAGE A", "PAGE B", "PAGE C"]);

  const { firstPath, secondPath } = await splitPdf(filePath, 1);

  assert.equal(await getPageCount(firstPath), 1);
  assert.equal(await getPageCount(secondPath), 2);
  const firstPages = await extractPdfText(firstPath);
  const secondPages = await extractPdfText(secondPath);
  assert.match(firstPages[0].text, /PAGE A/);
  assert.match(secondPages[0].text, /PAGE B/);
  assert.match(secondPages[1].text, /PAGE C/);
  assert.equal(await getPageCount(filePath), 3, "original file must be untouched");
});

test("splitPdf() rejects splitting at the first or last page", async () => {
  const filePath = await makeTestPdf(["A", "B", "C"]);
  await assert.rejects(() => splitPdf(filePath, 0), /Cannot split/);
  await assert.rejects(() => splitPdf(filePath, 3), /Cannot split/);
});

test("mergePdfs() never collides on an existing output filename", async () => {
  const baseFile = await makeTestPdf(["base"]);
  const otherFile = await makeTestPdf(["other"]);
  const first = await mergePdfs(baseFile, otherFile);
  const second = await mergePdfs(baseFile, otherFile);
  assert.notEqual(first, second);
  assert.equal(path.dirname(first), path.dirname(second));
});
