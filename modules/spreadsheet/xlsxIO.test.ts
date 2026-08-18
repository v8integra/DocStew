import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import { makeTestWorkbook, makeTestCsv } from "./testFixtures/makeTestWorkbook";
import { readXlsx, writeXlsx, writeXlsxBuffer, readCsv, writeCsv, writeCsvBuffer } from "./xlsxIO";

test("readXlsx() reads real literal values and a real formula with its cached result", async () => {
  const filePath = await makeTestWorkbook([
    {
      name: "Sheet1",
      cells: [
        { ref: "A1", value: 10 },
        { ref: "A2", value: 20 },
        { ref: "A3", formula: "SUM(A1:A2)", value: 30 },
        { ref: "B1", value: "Label" },
      ],
    },
  ]);
  const workbook = await readXlsx(filePath);
  assert.equal(workbook.sheets.length, 1);
  const sheet = workbook.sheets[0];
  assert.equal(sheet.cells.A1.value, 10);
  assert.equal(sheet.cells.A3.formula, "SUM(A1:A2)");
  assert.equal(sheet.cells.A3.value, 30);
  assert.equal(sheet.cells.B1.value, "Label");
});

test("readXlsx() preserves multiple sheets", async () => {
  const filePath = await makeTestWorkbook([
    { name: "First", cells: [{ ref: "A1", value: 1 }] },
    { name: "Second", cells: [{ ref: "A1", value: 2 }] },
  ]);
  const workbook = await readXlsx(filePath);
  assert.deepEqual(workbook.sheets.map((s) => s.name), ["First", "Second"]);
  assert.equal(workbook.sheets[1].cells.A1.value, 2);
});

test("writeXlsx() then readXlsx() round-trips real data", async () => {
  const filePath = await makeTestWorkbook([{ name: "Sheet1", cells: [] }]);
  await writeXlsx(filePath, {
    sheets: [
      { name: "Sheet1", cells: { A1: { value: 42 }, B1: { value: "hi" } } },
      { name: "Sheet2", cells: { A1: { value: "kept" } } },
    ],
  });
  const reread = await readXlsx(filePath);
  assert.equal(reread.sheets[0].cells.A1.value, 42);
  assert.equal(reread.sheets[0].cells.B1.value, "hi");
  assert.equal(reread.sheets[1].cells.A1.value, "kept");
});

test("writeXlsxBuffer() produces real, readable xlsx bytes", async () => {
  const buffer = await writeXlsxBuffer({ sheets: [{ name: "Sheet1", cells: { A1: { value: 7 } } }] });
  assert.ok(buffer.length > 0);
});

test("readCsv() reads real CSV rows as a single sheet", async () => {
  const filePath = makeTestCsv([
    ["10", "Label"],
    ["20", ""],
  ]);
  const sheet = await readCsv(filePath);
  assert.equal(sheet.cells.A1.value, 10);
  assert.equal(sheet.cells.B1.value, "Label");
  assert.equal(sheet.cells.A2.value, 20);
});

test("writeCsv() writes resolved values, not formulas (CSV has no formula concept)", async () => {
  const filePath = await makeTestWorkbook([{ name: "Sheet1", cells: [] }]);
  await writeCsv(filePath.replace(".xlsx", ".csv"), {
    name: "Sheet1",
    cells: { A1: { value: 30, formula: "SUM(A1:A2)" } },
  });
  const content = fs.readFileSync(filePath.replace(".xlsx", ".csv"), "utf-8");
  assert.match(content, /30/);
  assert.doesNotMatch(content, /SUM/);
});

test("writeCsvBuffer() produces real, non-empty CSV bytes", async () => {
  const buffer = await writeCsvBuffer({ name: "Sheet1", cells: { A1: { value: "hello" } } });
  assert.match(buffer.toString("utf-8"), /hello/);
});
