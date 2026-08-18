import { PDFDocument, degrees } from "pdf-lib";
import * as fs from "fs";
import * as path from "path";

export async function getPageCount(filePath: string): Promise<number> {
  const doc = await PDFDocument.load(fs.readFileSync(filePath));
  return doc.getPageCount();
}

export async function getTitle(filePath: string): Promise<string | undefined> {
  const doc = await PDFDocument.load(fs.readFileSync(filePath));
  return doc.getTitle() || undefined;
}

/** Rotates one page in place — the only operation here that doesn't need to
 * rebuild the document, since pdf-lib can mutate a page's rotation directly. */
export async function rotatePage(filePath: string, pageIndex: number, deltaDegrees: number): Promise<void> {
  const doc = await PDFDocument.load(fs.readFileSync(filePath));
  const page = doc.getPage(pageIndex);
  const current = page.getRotation().angle;
  page.setRotation(degrees((((current + deltaDegrees) % 360) + 360) % 360));
  fs.writeFileSync(filePath, await doc.save());
}

/** Swaps two pages' order. pdf-lib has no in-place page-reorder primitive, so
 * this rebuilds the document via copyPages in the new order — page content
 * (including per-page annotations) survives, but this phase doesn't touch
 * document-level structures like outlines/bookmarks, so treat those as not
 * guaranteed to be preserved. */
export async function swapPages(filePath: string, indexA: number, indexB: number): Promise<void> {
  const doc = await PDFDocument.load(fs.readFileSync(filePath));
  const count = doc.getPageCount();
  if (indexA < 0 || indexB < 0 || indexA >= count || indexB >= count) {
    throw new Error(`Page index out of range (document has ${count} page(s)).`);
  }
  const order = doc.getPageIndices();
  [order[indexA], order[indexB]] = [order[indexB], order[indexA]];

  const newDoc = await PDFDocument.create();
  const copied = await newDoc.copyPages(doc, order);
  copied.forEach((page) => newDoc.addPage(page));
  fs.writeFileSync(filePath, await newDoc.save());
}

function uniqueOutputPath(dir: string, baseName: string): string {
  let candidate = path.join(dir, `${baseName}.pdf`);
  let n = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${baseName}-${n}.pdf`);
    n++;
  }
  return candidate;
}

/** Merges two PDFs into a new file (base pages, then other's pages) — leaves
 * both originals untouched rather than overwriting either. */
export async function mergePdfs(basePath: string, otherPath: string): Promise<string> {
  const baseDoc = await PDFDocument.load(fs.readFileSync(basePath));
  const otherDoc = await PDFDocument.load(fs.readFileSync(otherPath));
  const merged = await PDFDocument.create();

  const baseCopied = await merged.copyPages(baseDoc, baseDoc.getPageIndices());
  baseCopied.forEach((page) => merged.addPage(page));
  const otherCopied = await merged.copyPages(otherDoc, otherDoc.getPageIndices());
  otherCopied.forEach((page) => merged.addPage(page));

  const dir = path.dirname(basePath);
  const baseName = path.basename(basePath, ".pdf");
  const otherName = path.basename(otherPath, ".pdf");
  const outputPath = uniqueOutputPath(dir, `${baseName}+${otherName}`);
  fs.writeFileSync(outputPath, await merged.save());
  return outputPath;
}

/** Splits a PDF into two new files at atPageIndex (0-indexed): pages
 * [0, atPageIndex) go to the first file, [atPageIndex, end) to the second.
 * Leaves the original untouched. */
export async function splitPdf(filePath: string, atPageIndex: number): Promise<{ firstPath: string; secondPath: string }> {
  const doc = await PDFDocument.load(fs.readFileSync(filePath));
  const count = doc.getPageCount();
  if (atPageIndex <= 0 || atPageIndex >= count) {
    throw new Error(`Cannot split at page ${atPageIndex + 1} — pick a page strictly between the first and last.`);
  }
  const allIndices = doc.getPageIndices();
  const firstIndices = allIndices.slice(0, atPageIndex);
  const secondIndices = allIndices.slice(atPageIndex);

  const firstDoc = await PDFDocument.create();
  (await firstDoc.copyPages(doc, firstIndices)).forEach((page) => firstDoc.addPage(page));
  const secondDoc = await PDFDocument.create();
  (await secondDoc.copyPages(doc, secondIndices)).forEach((page) => secondDoc.addPage(page));

  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath, ".pdf");
  const firstPath = uniqueOutputPath(dir, `${baseName}-part1`);
  const secondPath = uniqueOutputPath(dir, `${baseName}-part2`);
  fs.writeFileSync(firstPath, await firstDoc.save());
  fs.writeFileSync(secondPath, await secondDoc.save());
  return { firstPath, secondPath };
}
