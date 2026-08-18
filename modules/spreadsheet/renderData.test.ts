import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRenderData, sheetToCsvText } from "./renderData";
import type { WorkbookData } from "./sheetModel";

test("buildRenderData() pads small sheets up to the minimum grid size", () => {
  const workbook: WorkbookData = { sheets: [{ name: "Sheet1", cells: { A1: { value: 1 } } }] };
  const data = buildRenderData(workbook, 0);
  assert.ok(data.activeSheet.rowCount >= 15);
  assert.ok(data.activeSheet.colCount >= 8);
});

test("buildRenderData() caps very large sheets at the max grid size", () => {
  const cells: WorkbookData["sheets"][0]["cells"] = {};
  cells[`A${500}`] = { value: 1 };
  const workbook: WorkbookData = { sheets: [{ name: "Sheet1", cells }] };
  const data = buildRenderData(workbook, 0);
  assert.equal(data.activeSheet.rowCount, 100);
});

test("buildRenderData() includes sheet names and the active index", () => {
  const workbook: WorkbookData = {
    sheets: [
      { name: "First", cells: {} },
      { name: "Second", cells: {} },
    ],
  };
  const data = buildRenderData(workbook, 1);
  assert.deepEqual(data.sheetNames, ["First", "Second"]);
  assert.equal(data.activeSheetIndex, 1);
  assert.equal(data.activeSheet.name, "Second");
});

test("buildRenderData() computes a display string per cell", () => {
  const workbook: WorkbookData = {
    sheets: [{ name: "Sheet1", cells: { A1: { value: 42 }, B1: { value: null } } }],
  };
  const data = buildRenderData(workbook, 0);
  assert.equal(data.activeSheet.cells.A1.display, "42");
  assert.equal(data.activeSheet.cells.B1.display, "");
});

test("sheetToCsvText() dumps only the sheet's real content bounds", () => {
  const text = sheetToCsvText({ name: "Sheet1", cells: { A1: { value: 1 }, B1: { value: 2 }, A2: { value: 3 } } });
  assert.equal(text, "1,2\n3,");
});

test("sheetToCsvText() returns an empty string for an empty sheet", () => {
  assert.equal(sheetToCsvText({ name: "Sheet1", cells: {} }), "");
});
