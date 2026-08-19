import { PDFDocument, PDFTextField, PDFCheckBox, PDFRef } from "pdf-lib";
import * as fs from "fs";

export interface FormFieldInfo {
  name: string;
  type: "text" | "checkbox" | "unsupported";
  value: string | boolean;
  pageIndex: number;
  // Rectangle in PDF point space (origin bottom-left) — matches pdf-lib's
  // own coordinate convention; the renderer converts to top-left CSS
  // positioning using each page's height.
  rect: { x: number; y: number; width: number; height: number };
}

export interface PageSize {
  width: number;
  height: number;
}

export interface FormFieldsResult {
  fields: FormFieldInfo[];
  pageSizes: PageSize[];
}

/** Reads a PDF's existing AcroForm fields (core scope: text fields and
 * checkboxes only — dropdowns/radio groups/signatures are surfaced as
 * "unsupported" so the UI can show they exist without pretending to support
 * editing them). Fields with more than one widget (the same field rendered
 * at multiple locations, e.g. some radio groups) are skipped entirely —
 * pdf-lib's public API doesn't expose enough to resolve their per-widget
 * page/rectangle without reimplementing internal Kids traversal, and
 * multi-widget fields are rare in the single-page fillable forms this
 * scope targets. */
export async function listFormFields(filePath: string): Promise<FormFieldsResult> {
  const doc = await PDFDocument.load(fs.readFileSync(filePath));
  const pages = doc.getPages();
  const pageSizes: PageSize[] = pages.map((page) => ({ width: page.getWidth(), height: page.getHeight() }));

  const fields: FormFieldInfo[] = [];
  for (const field of doc.getForm().getFields()) {
    const widgets = field.acroField.getWidgets();
    if (widgets.length !== 1) continue;

    // A field with Kids is non-terminal: addToPage() always registers the
    // widget as its own object referenced from Kids[0], so it's that ref
    // (not the field's own ref) that appears in the page's /Annots array.
    // A field with no Kids IS its own single widget, so its own ref works.
    const kids = field.acroField.Kids();
    const widgetRef = kids ? kids.get(0) : field.ref;
    if (!(widgetRef instanceof PDFRef)) continue;

    const page = doc.findPageForAnnotationRef(widgetRef);
    if (!page) continue;
    const pageIndex = pages.indexOf(page);
    const rect = widgets[0].getRectangle();
    const name = field.getName();

    if (field instanceof PDFTextField) {
      fields.push({ name, type: "text", value: field.getText() ?? "", pageIndex, rect });
    } else if (field instanceof PDFCheckBox) {
      fields.push({ name, type: "checkbox", value: field.isChecked(), pageIndex, rect });
    } else {
      fields.push({ name, type: "unsupported", value: "", pageIndex, rect });
    }
  }
  return { fields, pageSizes };
}

function applyFieldValues(doc: PDFDocument, values: Record<string, string | boolean>): void {
  const form = doc.getForm();
  for (const [name, value] of Object.entries(values)) {
    const field = form.getFieldMaybe(name);
    if (!field) continue;
    if (field instanceof PDFTextField) {
      field.setText(typeof value === "string" ? value : String(value));
    } else if (field instanceof PDFCheckBox) {
      if (value) field.check();
      else field.uncheck();
    }
  }
}

/** Writes field values into the PDF in place — the "Save" action for a form
 * (mirrors Spreadsheet/Images' per-operation auto-save model: the PDF module
 * as a whole doesn't support freeform in-place editing, but a form fill is a
 * well-defined, deterministic write). */
export async function fillFormFields(filePath: string, values: Record<string, string | boolean>): Promise<void> {
  const doc = await PDFDocument.load(fs.readFileSync(filePath));
  applyFieldValues(doc, values);
  fs.writeFileSync(filePath, await doc.save());
}

/** Flattens the form's *currently saved* field values into static page
 * content — the "Export as filled PDF" path. Takes no values of its own:
 * fillFormFields() is what persists values (mirroring a real Save), so by
 * the time this runs, the on-disk fields already hold whatever the user
 * last filled in. The result is no longer editable as a form, matching how
 * a real filled/submitted form is typically shared. */
export async function flattenFilledCopy(filePath: string): Promise<Buffer> {
  const doc = await PDFDocument.load(fs.readFileSync(filePath));
  doc.getForm().flatten();
  return Buffer.from(await doc.save());
}
