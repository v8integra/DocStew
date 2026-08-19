import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import { PDFDocument } from "pdf-lib";
import { listFormFields, fillFormFields, flattenFilledCopy } from "./pdfForms";
import { makeTestFormPdf } from "./testFixtures/makeTestFormPdf";
import { makeTestPdf } from "./testFixtures/makeTestPdf";

test("listFormFields() detects a real text field and checkbox with their positions", async () => {
  const filePath = await makeTestFormPdf();
  const { fields, pageSizes } = await listFormFields(filePath);

  assert.equal(pageSizes.length, 1);
  assert.equal(pageSizes[0].width, 400);
  assert.equal(pageSizes[0].height, 400);

  const nameField = fields.find((f) => f.name === "name")!;
  assert.equal(nameField.type, "text");
  assert.equal(nameField.value, "");
  assert.equal(nameField.pageIndex, 0);
  assert.equal(nameField.rect.width, 200);
  assert.equal(nameField.rect.height, 20);

  const agreeField = fields.find((f) => f.name === "agree")!;
  assert.equal(agreeField.type, "checkbox");
  assert.equal(agreeField.value, false);
});

test("listFormFields() returns no fields for a real PDF with no form", async () => {
  const filePath = await makeTestPdf(["plain document"]);
  const { fields } = await listFormFields(filePath);
  assert.deepEqual(fields, []);
});

test("fillFormFields() writes real values into the PDF that a fresh read confirms", async () => {
  const filePath = await makeTestFormPdf();
  await fillFormFields(filePath, { name: "Alice", agree: true });

  const { fields } = await listFormFields(filePath);
  assert.equal(fields.find((f) => f.name === "name")!.value, "Alice");
  assert.equal(fields.find((f) => f.name === "agree")!.value, true);

  // Confirm it's really persisted on disk, not just in the in-memory doc.
  const reloaded = await PDFDocument.load(fs.readFileSync(filePath));
  assert.equal(reloaded.getForm().getTextField("name").getText(), "Alice");
  assert.equal(reloaded.getForm().getCheckBox("agree").isChecked(), true);
});

test("fillFormFields() ignores unknown field names instead of throwing", async () => {
  const filePath = await makeTestFormPdf();
  await assert.doesNotReject(() => fillFormFields(filePath, { nonexistent: "x" }));
});

test("flattenFilledCopy() bakes in the currently-saved values and removes the interactive form", async () => {
  const filePath = await makeTestFormPdf();
  await fillFormFields(filePath, { name: "Bob", agree: true });

  const flattened = await flattenFilledCopy(filePath);
  const flatDoc = await PDFDocument.load(flattened);
  assert.equal(flatDoc.getForm().getFields().length, 0);

  // The original on-disk file is untouched by exporting a flattened copy.
  const { fields } = await listFormFields(filePath);
  assert.equal(fields.find((f) => f.name === "name")!.value, "Bob");
});
