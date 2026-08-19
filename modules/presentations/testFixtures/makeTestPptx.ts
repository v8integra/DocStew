import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import JSZip from "jszip";

const SLIDE_XML_HEADER =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree>';
const SLIDE_XML_FOOTER = "</p:spTree></p:cSld></p:sld>";

function paragraphXml(text: string): string {
  return `<a:p><a:r><a:t>${text}</a:t></a:r></a:p>`;
}

function titleShapeXml(title: string): string {
  return (
    `<p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>` +
    `<p:txBody>${paragraphXml(title)}</p:txBody></p:sp>`
  );
}

function bodyShapeXml(bullets: string[]): string {
  return (
    `<p:sp><p:nvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>` +
    `<p:txBody>${bullets.map(paragraphXml).join("")}</p:txBody></p:sp>`
  );
}

/** Builds a real, minimal .pptx (a real ZIP containing real
 * ppt/slides/slideN.xml parts with genuine PowerPoint-shaped OOXML,
 * including title-placeholder metadata) — used to test slide-content
 * extraction against realistic input, not just our own writer's
 * round-trip. Other archive parts real PowerPoint would include
 * ([Content_Types].xml, presentation.xml, relationship files, etc.) are
 * omitted since readPptx() only reads the slideN.xml parts directly. */
export async function makeTestPptx(
  slides: Array<{ title: string; bullets: string[] }>
): Promise<string> {
  const zip = new JSZip();
  slides.forEach((slide, index) => {
    const xml =
      SLIDE_XML_HEADER + titleShapeXml(slide.title) + bodyShapeXml(slide.bullets) + SLIDE_XML_FOOTER;
    zip.file(`ppt/slides/slide${index + 1}.xml`, xml);
  });
  const buffer = await zip.generateAsync({ type: "nodebuffer" });

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "docstew-pptx-test-"));
  const filePath = path.join(dir, "test.pptx");
  fs.writeFileSync(filePath, buffer);
  return filePath;
}
