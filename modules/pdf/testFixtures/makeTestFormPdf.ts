import { PDFDocument } from "pdf-lib";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

/** Creates a real single-page PDF with a real fillable AcroForm: one text
 * field and one checkbox, at known positions — used to test form-field
 * detection/filling against genuine PDF structure rather than a fixture
 * binary that could go stale. */
export async function makeTestFormPdf(): Promise<string> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 400]);
  const form = doc.getForm();

  const nameField = form.createTextField("name");
  nameField.addToPage(page, { x: 50, y: 300, width: 200, height: 20, borderWidth: 0 });

  const agreeBox = form.createCheckBox("agree");
  agreeBox.addToPage(page, { x: 50, y: 250, width: 15, height: 15, borderWidth: 0 });

  const bytes = await doc.save();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "docstew-pdf-form-test-"));
  const filePath = path.join(dir, "form-test.pdf");
  fs.writeFileSync(filePath, bytes);
  return filePath;
}
