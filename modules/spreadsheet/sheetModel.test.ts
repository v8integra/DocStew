import { test } from "node:test";
import assert from "node:assert/strict";
import { colToLetter, letterToCol, cellRefToKey, parseCellRef, computeBounds } from "./sheetModel";

test("colToLetter() converts 1-indexed columns correctly", () => {
  assert.equal(colToLetter(1), "A");
  assert.equal(colToLetter(26), "Z");
  assert.equal(colToLetter(27), "AA");
  assert.equal(colToLetter(52), "AZ");
  assert.equal(colToLetter(53), "BA");
});

test("letterToCol() is the inverse of colToLetter()", () => {
  for (const col of [1, 5, 26, 27, 52, 53, 100, 702, 703]) {
    assert.equal(letterToCol(colToLetter(col)), col);
  }
});

test("letterToCol() handles lowercase input", () => {
  assert.equal(letterToCol("a"), 1);
  assert.equal(letterToCol("aa"), 27);
});

test("cellRefToKey() and parseCellRef() round-trip", () => {
  assert.equal(cellRefToKey(1, 1), "A1");
  assert.equal(cellRefToKey(10, 27), "AA10");
  assert.deepEqual(parseCellRef("A1"), { row: 1, col: 1 });
  assert.deepEqual(parseCellRef("AA10"), { row: 10, col: 27 });
});

test("parseCellRef() rejects an invalid reference", () => {
  assert.throws(() => parseCellRef("123"), /Invalid cell reference/);
  assert.throws(() => parseCellRef(""), /Invalid cell reference/);
});

test("computeBounds() finds the real max row/col across sparse cells", () => {
  const bounds = computeBounds({
    name: "Sheet1",
    cells: { A1: { value: 1 }, C5: { value: 2 }, B2: { value: 3 } },
  });
  assert.deepEqual(bounds, { maxRow: 5, maxCol: 3 });
});

test("computeBounds() returns zero for an empty sheet", () => {
  assert.deepEqual(computeBounds({ name: "Sheet1", cells: {} }), { maxRow: 0, maxCol: 0 });
});
