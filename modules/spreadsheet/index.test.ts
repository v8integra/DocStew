import { test } from "node:test";
import assert from "node:assert/strict";
import spreadsheetModule from "./index";
import type { SpreadsheetRenderData } from "./renderData";
import { makeTestWorkbook, makeTestCsv } from "./testFixtures/makeTestWorkbook";
import { readXlsx } from "./xlsxIO";
import { setModels } from "../../src/main/ai-engine/config";
import { withFakeOllamaServer, fakeChatHandler } from "../../src/main/ai-engine/testFixtures/fakeOllamaServer";

test("open() returns a handle carrying the spreadsheet module id", async () => {
  const filePath = await makeTestWorkbook([{ name: "Sheet1", cells: [] }]);
  const handle = await spreadsheetModule.open(filePath);
  assert.equal(handle.moduleId, "spreadsheet");
});

test("render() returns real recalculated grid data", async () => {
  const filePath = await makeTestWorkbook([
    { name: "Sheet1", cells: [{ ref: "A1", value: 10 }, { ref: "A2", value: 20 }, { ref: "A3", formula: "SUM(A1:A2)" }] },
  ]);
  const handle = await spreadsheetModule.open(filePath);
  const rendered = await spreadsheetModule.render(handle);
  const data = rendered.data as SpreadsheetRenderData;
  assert.equal(rendered.kind, "spreadsheet");
  assert.equal(data.activeSheet.cells.A3.display, "30");
});

test("save() refuses rather than silently doing nothing (edits save per-cell instead)", async () => {
  const filePath = await makeTestWorkbook([{ name: "Sheet1", cells: [] }]);
  const handle = await spreadsheetModule.open(filePath);
  assert.throws(() => spreadsheetModule.save(handle), /save immediately per cell/);
});

test("setCell operation writes a real literal value and persists it to disk", async () => {
  const filePath = await makeTestWorkbook([{ name: "Sheet1", cells: [] }]);
  const handle = await spreadsheetModule.open(filePath);
  const op = spreadsheetModule.operations!.find((o) => o.name === "setCell")!;

  await op.handler(handle, { ref: "A1", input: "42" });

  const reread = await readXlsx(filePath);
  assert.equal(reread.sheets[0].cells.A1.value, 42);
});

test("setCell operation writes a real formula and recalculates it", async () => {
  const filePath = await makeTestWorkbook([{ name: "Sheet1", cells: [{ ref: "A1", value: 10 }, { ref: "A2", value: 20 }] }]);
  const handle = await spreadsheetModule.open(filePath);
  const op = spreadsheetModule.operations!.find((o) => o.name === "setCell")!;

  const result = (await op.handler(handle, { ref: "A3", input: "=SUM(A1:A2)" })) as {
    renderData: SpreadsheetRenderData;
  };

  assert.equal(result.renderData.activeSheet.cells.A3.display, "30");
  const reread = await readXlsx(filePath);
  assert.equal(reread.sheets[0].cells.A3.formula, "SUM(A1:A2)");
  assert.equal(reread.sheets[0].cells.A3.value, 30);
});

test("setCell operation clearing a cell (empty input) removes it", async () => {
  const filePath = await makeTestWorkbook([{ name: "Sheet1", cells: [{ ref: "A1", value: 5 }] }]);
  const handle = await spreadsheetModule.open(filePath);
  const op = spreadsheetModule.operations!.find((o) => o.name === "setCell")!;

  await op.handler(handle, { ref: "A1", input: "" });

  const reread = await readXlsx(filePath);
  assert.equal(reread.sheets[0].cells.A1, undefined);
});

test("setCell operation preserves other sheets in an .xlsx workbook", async () => {
  const filePath = await makeTestWorkbook([
    { name: "Sheet1", cells: [] },
    { name: "Sheet2", cells: [{ ref: "A1", value: "untouched" }] },
  ]);
  const handle = await spreadsheetModule.open(filePath);
  const op = spreadsheetModule.operations!.find((o) => o.name === "setCell")!;

  await op.handler(handle, { ref: "A1", input: "new value" });

  const reread = await readXlsx(filePath);
  assert.equal(reread.sheets[1].cells.A1.value, "untouched");
});

test("setCell operation works on a real CSV file", async () => {
  const filePath = makeTestCsv([["1", "2"]]);
  const handle = await spreadsheetModule.open(filePath);
  const op = spreadsheetModule.operations!.find((o) => o.name === "setCell")!;

  await op.handler(handle, { ref: "C1", input: "3" });

  const rendered = await spreadsheetModule.render(handle);
  const data = rendered.data as SpreadsheetRenderData;
  assert.equal(data.activeSheet.cells.C1.display, "3");
});

test("export() to csv writes resolved values for an xlsx source", async () => {
  const filePath = await makeTestWorkbook([{ name: "Sheet1", cells: [{ ref: "A1", value: 10 }, { ref: "A2", formula: "A1*2", value: 20 }] }]);
  const handle = await spreadsheetModule.open(filePath);
  const buf = await spreadsheetModule.export(handle, "csv");
  assert.match(buf.toString("utf-8"), /20/);
});

test("export() to xlsx converts a csv source into real xlsx bytes", async () => {
  const filePath = makeTestCsv([["1", "2"]]);
  const handle = await spreadsheetModule.open(filePath);
  const buf = await spreadsheetModule.export(handle, "xlsx");
  assert.ok(buf.length > 0);
});

test("export() to txt returns a tab-separated dump", async () => {
  const filePath = await makeTestWorkbook([{ name: "Sheet1", cells: [{ ref: "A1", value: 1 }, { ref: "B1", value: 2 }] }]);
  const handle = await spreadsheetModule.open(filePath);
  const buf = await spreadsheetModule.export(handle, "txt");
  assert.equal(buf.toString("utf-8"), "1\t2");
});

test("export() rejects an unsupported format", async () => {
  const filePath = await makeTestWorkbook([{ name: "Sheet1", cells: [] }]);
  const handle = await spreadsheetModule.open(filePath);
  await assert.rejects(() => Promise.resolve(spreadsheetModule.export(handle, "pdf")), /cannot export/);
});

test("index() includes every sheet's real data for search", async () => {
  const filePath = await makeTestWorkbook([
    { name: "Sheet1", cells: [{ ref: "A1", value: "needle" }] },
    { name: "Sheet2", cells: [{ ref: "A1", value: "haystack" }] },
  ]);
  const handle = await spreadsheetModule.open(filePath);
  const indexed = await spreadsheetModule.index(handle);
  assert.match(indexed.text, /needle/);
  assert.match(indexed.text, /haystack/);
});

test("peek() flags additional sheets when present", async () => {
  const filePath = await makeTestWorkbook([
    { name: "Budget", cells: [] },
    { name: "Notes", cells: [] },
  ]);
  const info = await spreadsheetModule.peek!(filePath);
  assert.equal(info.title, "Budget (+1 more)");
});

test("peek() has no title for a single-sheet workbook", async () => {
  const filePath = await makeTestWorkbook([{ name: "Sheet1", cells: [] }]);
  const info = await spreadsheetModule.peek!(filePath);
  assert.equal(info.title, undefined);
});

test("generateFormula aiTool returns a formula string from the fake model", async () => {
  const filePath = await makeTestWorkbook([{ name: "Sheet1", cells: [{ ref: "A1", value: 1 }, { ref: "A2", value: 2 }] }]);
  const handle = await spreadsheetModule.open(filePath);
  const tool = spreadsheetModule.aiTools.find((t) => t.name === "generateFormula")!;

  await withFakeOllamaServer(fakeChatHandler("=SUM(A1:A2)"), async () => {
    setModels({ chatModel: "fake-model" });
    const result = (await tool.handler(handle, { instruction: "sum column A" })) as { formula: string };
    assert.equal(result.formula, "=SUM(A1:A2)");
  });
  setModels({});
});

test("generateFormula aiTool requires an instruction", async () => {
  const filePath = await makeTestWorkbook([{ name: "Sheet1", cells: [] }]);
  const handle = await spreadsheetModule.open(filePath);
  const tool = spreadsheetModule.aiTools.find((t) => t.name === "generateFormula")!;
  setModels({ chatModel: "fake-model" });
  await assert.rejects(() => tool.handler(handle, {}), /instruction is required/);
  setModels({});
});

test("cleanData aiTool reports on real sheet content via the fake model", async () => {
  const filePath = await makeTestWorkbook([{ name: "Sheet1", cells: [{ ref: "A1", value: "dupe" }, { ref: "A2", value: "dupe" }] }]);
  const handle = await spreadsheetModule.open(filePath);
  const tool = spreadsheetModule.aiTools.find((t) => t.name === "cleanData")!;

  await withFakeOllamaServer(fakeChatHandler("Rows 1 and 2 are duplicates."), async () => {
    setModels({ chatModel: "fake-model" });
    const result = (await tool.handler(handle, {})) as { report: string };
    assert.equal(result.report, "Rows 1 and 2 are duplicates.");
  });
  setModels({});
});

test("aiTools refuse with a clear error when no chat model is configured", async () => {
  const filePath = await makeTestWorkbook([{ name: "Sheet1", cells: [] }]);
  const handle = await spreadsheetModule.open(filePath);
  setModels({});
  const tool = spreadsheetModule.aiTools.find((t) => t.name === "generateFormula")!;
  await assert.rejects(() => tool.handler(handle, { instruction: "x" }), /No local chat model is available/);
});
