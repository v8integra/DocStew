import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateFormula, recalculateSheet } from "./formulaEngine";
import type { SheetData } from "./sheetModel";

function sheet(cells: SheetData["cells"]): SheetData {
  return { name: "Sheet1", cells };
}

test("evaluateFormula() sums a range", () => {
  const s = sheet({ A1: { value: 10 }, A2: { value: 20 } });
  assert.equal(evaluateFormula("SUM(A1:A2)", s, 3, 1), 30);
});

test("evaluateFormula() handles arithmetic between cell references", () => {
  const s = sheet({ A1: { value: 4 }, B1: { value: 5 } });
  assert.equal(evaluateFormula("A1*B1", s, 1, 3), 20);
});

test("evaluateFormula() evaluates IF()", () => {
  const s = sheet({ A1: { value: 10 } });
  assert.equal(evaluateFormula('IF(A1>5,"big","small")', s, 1, 2), "big");
});

test("evaluateFormula() returns an Excel-style error string for a runtime error, not a throw", () => {
  const s = sheet({ A1: { value: 10 }, B1: { value: 0 } });
  const result = evaluateFormula("A1/B1", s, 1, 3);
  assert.equal(result, "#DIV/0!");
});

test("evaluateFormula() returns an error string for a malformed formula rather than throwing", () => {
  const s = sheet({});
  const result = evaluateFormula("SUM(", s, 1, 1);
  assert.equal(result, "#ERROR!");
});

test("evaluateFormula() treats a missing referenced cell as empty/zero", () => {
  const s = sheet({ A1: { value: 10 } });
  assert.equal(evaluateFormula("SUM(A1:A5)", s, 6, 1), 10);
});

test("recalculateSheet() fills in computed values for every formula cell", () => {
  const s = sheet({
    A1: { value: 5 },
    A2: { value: 7 },
    A3: { value: null, formula: "SUM(A1:A2)" },
  });
  recalculateSheet(s);
  assert.equal(s.cells.A3.value, 12);
});

test("recalculateSheet() resolves a short chain of formulas referencing formulas", () => {
  const s = sheet({
    A1: { value: 10 },
    B1: { value: null, formula: "A1*2" },
    C1: { value: null, formula: "B1+1" },
  });
  recalculateSheet(s);
  assert.equal(s.cells.B1.value, 20);
  assert.equal(s.cells.C1.value, 21);
});

test("recalculateSheet() leaves non-formula cells untouched", () => {
  const s = sheet({ A1: { value: "hello" } });
  recalculateSheet(s);
  assert.equal(s.cells.A1.value, "hello");
});
