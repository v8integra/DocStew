import { test } from "node:test";
import assert from "node:assert/strict";
import pdfModule from "./index";
import type { PdfRenderData } from "./index";
import { makeTestPdf } from "./testFixtures/makeTestPdf";
import { setModels } from "../../src/main/ai-engine/config";
import { withFakeOllamaServer, fakeChatHandler } from "../../src/main/ai-engine/testFixtures/fakeOllamaServer";

test("open() returns a handle carrying the pdf module id", async () => {
  const filePath = await makeTestPdf(["hello"]);
  const handle = await pdfModule.open(filePath);
  assert.equal(handle.moduleId, "pdf");
  assert.equal(handle.filePath, filePath);
});

test("render() reports the real page count", async () => {
  const filePath = await makeTestPdf(["one", "two", "three"]);
  const handle = await pdfModule.open(filePath);
  const rendered = await pdfModule.render(handle);
  assert.equal(rendered.kind, "pdf");
  assert.equal((rendered.data as PdfRenderData).pageCount, 3);
});

test("save() refuses rather than silently doing nothing", async () => {
  const filePath = await makeTestPdf(["hello"]);
  const handle = await pdfModule.open(filePath);
  // save() throws synchronously (it's not async), unlike Notes' — assert.rejects
  // would miss that entirely, since the throw happens before any Promise exists.
  assert.throws(() => pdfModule.save(handle), /doesn't support in-place editing/);
});

test("export() to txt returns the real extracted text", async () => {
  const filePath = await makeTestPdf(["exportable text content"]);
  const handle = await pdfModule.open(filePath);
  const buf = await pdfModule.export(handle, "txt");
  assert.match(buf.toString("utf-8"), /exportable text content/);
});

test("export() to pdf returns the raw file bytes", async () => {
  const filePath = await makeTestPdf(["hello"]);
  const handle = await pdfModule.open(filePath);
  const buf = await pdfModule.export(handle, "pdf");
  assert.match(buf.toString("latin1"), /^%PDF-/);
});

test("export() rejects an unsupported format", async () => {
  const filePath = await makeTestPdf(["hello"]);
  const handle = await pdfModule.open(filePath);
  await assert.rejects(() => Promise.resolve(pdfModule.export(handle, "docx")), /cannot export/);
});

test("index() returns the document's real extracted text for search", async () => {
  const filePath = await makeTestPdf(["searchable needle content"]);
  const handle = await pdfModule.open(filePath);
  const indexed = await pdfModule.index(handle);
  assert.match(indexed.text, /searchable needle content/);
});

test("peek() reads the PDF's title metadata when present", async () => {
  const { PDFDocument } = await import("pdf-lib");
  const fs = await import("fs");
  const filePath = await makeTestPdf(["hello"]);
  const doc = await PDFDocument.load(fs.readFileSync(filePath));
  doc.setTitle("A Real Document Title");
  fs.writeFileSync(filePath, await doc.save());

  const info = await pdfModule.peek!(filePath);
  assert.equal(info.title, "A Real Document Title");
});

test("summarize aiTool calls the configured chat model", async () => {
  const filePath = await makeTestPdf(["A long document about quarterly sales figures."]);
  const handle = await pdfModule.open(filePath);
  const tool = pdfModule.aiTools.find((t) => t.name === "summarize")!;

  await withFakeOllamaServer(fakeChatHandler("Sales figures summary."), async () => {
    setModels({ chatModel: "fake-model" });
    const result = (await tool.handler(handle, {})) as { summary: string };
    assert.equal(result.summary, "Sales figures summary.");
  });
  setModels({});
});

test("qa aiTool requires a question", async () => {
  const filePath = await makeTestPdf(["content"]);
  const handle = await pdfModule.open(filePath);
  const tool = pdfModule.aiTools.find((t) => t.name === "qa")!;
  setModels({ chatModel: "fake-model" });
  await assert.rejects(() => tool.handler(handle, {}), /question is required/);
  setModels({});
});

test("qa aiTool answers using the fake model", async () => {
  const filePath = await makeTestPdf(["The total revenue was 5 million dollars."]);
  const handle = await pdfModule.open(filePath);
  const tool = pdfModule.aiTools.find((t) => t.name === "qa")!;

  await withFakeOllamaServer(fakeChatHandler("5 million dollars."), async () => {
    setModels({ chatModel: "fake-model" });
    const result = (await tool.handler(handle, { question: "What was the revenue?" })) as { answer: string };
    assert.equal(result.answer, "5 million dollars.");
  });
  setModels({});
});

test("aiTools refuse with a clear error when no chat model is configured", async () => {
  const filePath = await makeTestPdf(["content"]);
  const handle = await pdfModule.open(filePath);
  setModels({});
  const summarize = pdfModule.aiTools.find((t) => t.name === "summarize")!;
  await assert.rejects(() => summarize.handler(handle, {}), /No local chat model is available/);
});

test("rotatePage operation delegates with parsed numeric args", async () => {
  const { PDFDocument } = await import("pdf-lib");
  const fs = await import("fs");
  const filePath = await makeTestPdf(["page one"]);
  const handle = await pdfModule.open(filePath);
  const op = pdfModule.operations!.find((o) => o.name === "rotatePage")!;

  await op.handler(handle, { pageIndex: 0, degrees: 90 });

  const doc = await PDFDocument.load(fs.readFileSync(filePath));
  assert.equal(doc.getPage(0).getRotation().angle, 90);
});

test("split operation returns the two newly created file paths", async () => {
  const filePath = await makeTestPdf(["A", "B", "C"]);
  const handle = await pdfModule.open(filePath);
  const op = pdfModule.operations!.find((o) => o.name === "split")!;

  const result = (await op.handler(handle, { atPageIndex: 1 })) as { newFiles: string[] };

  assert.equal(result.newFiles.length, 2);
});

test("merge operation returns the newly created combined file path", async () => {
  const filePath = await makeTestPdf(["base"]);
  const otherPath = await makeTestPdf(["other"]);
  const handle = await pdfModule.open(filePath);
  const op = pdfModule.operations!.find((o) => o.name === "merge")!;

  const result = (await op.handler(handle, { otherFilePath: otherPath })) as { newFiles: string[] };

  assert.equal(result.newFiles.length, 1);
  assert.notEqual(result.newFiles[0], filePath);
});
