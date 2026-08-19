import * as fs from "fs";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import PptxGenJS from "pptxgenjs";
import type { PresentationDocument, Slide } from "./presentationModel";

type XmlNode = Record<string, unknown>;

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function isTitleShape(shape: XmlNode): boolean {
  const nvSpPr = shape["p:nvSpPr"] as XmlNode | undefined;
  const nvPr = nvSpPr?.["p:nvPr"] as XmlNode | undefined;
  const ph = nvPr?.["p:ph"] as XmlNode | undefined;
  const phType = ph?.["@_type"];
  return phType === "title" || phType === "ctrTitle";
}

function extractParagraphText(paragraph: XmlNode): string {
  const runs = asArray(paragraph["a:r"] as XmlNode | XmlNode[] | undefined);
  return runs.map((run) => String(run["a:t"] ?? "")).join("");
}

function extractShapeText(shape: XmlNode): string[] {
  const txBody = shape["p:txBody"] as XmlNode | undefined;
  const paragraphs = asArray(txBody?.["a:p"] as XmlNode | XmlNode[] | undefined);
  return paragraphs.map(extractParagraphText).filter((text) => text.trim().length > 0);
}

/** Best-effort title/bullets extraction from one slide's real OOXML shape
 * tree: prefer a shape explicitly marked as a title placeholder; fall back
 * to the first shape with any text if no placeholder is found (some decks,
 * especially non-PowerPoint-authored ones, omit placeholder metadata).
 * Everything else on the slide becomes bullet lines, one per paragraph. */
function extractSlideContent(parsedXml: XmlNode): Slide {
  const sld = parsedXml["p:sld"] as XmlNode | undefined;
  const cSld = sld?.["p:cSld"] as XmlNode | undefined;
  const spTree = cSld?.["p:spTree"] as XmlNode | undefined;
  const shapes = asArray(spTree?.["p:sp"] as XmlNode | XmlNode[] | undefined);
  const shapeInfos = shapes.map((shape) => ({ isTitle: isTitleShape(shape), texts: extractShapeText(shape) }));

  let titleIndex = shapeInfos.findIndex((s) => s.isTitle && s.texts.length > 0);
  if (titleIndex === -1) titleIndex = shapeInfos.findIndex((s) => s.texts.length > 0);

  const title = titleIndex >= 0 ? shapeInfos[titleIndex].texts.join(" ") : "";
  const bullets = shapeInfos.flatMap((s, i) => (i === titleIndex ? [] : s.texts));
  return { title, bullets };
}

/** Reads an existing .pptx's real slide text best-effort. There's no
 * equivalent of mammoth for pptx (a library that down-converts to a clean
 * editable structure) — this hand-rolls just enough OOXML parsing (unzip +
 * read each ppt/slides/slideN.xml's shape tree) to recover a title +
 * bullet list per slide. Visual layout, images, and non-text shapes are
 * necessarily lost; every Save regenerates the whole file from this
 * structure, a known and disclosed limitation shown as a permanent UI note
 * (same category as Word's own formatting-fidelity note). */
export async function readPptx(filePath: string): Promise<PresentationDocument> {
  const buffer = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buffer);
  const slideFileNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml/)![1]);
      const nb = Number(b.match(/slide(\d+)\.xml/)![1]);
      return na - nb;
    });

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const slides: Slide[] = [];
  for (const fileName of slideFileNames) {
    const xml = await zip.files[fileName].async("string");
    slides.push(extractSlideContent(parser.parse(xml) as XmlNode));
  }
  return { slides: slides.length > 0 ? slides : [{ title: "Untitled Slide", bullets: [] }] };
}

/** Regenerates a full .pptx from the given slide structure via pptxgenjs —
 * the "Save" action for this module. There is no in-place OOXML editing;
 * every save rebuilds the whole file from the current in-memory structure. */
export async function writePptx(filePath: string, doc: PresentationDocument): Promise<void> {
  const pptx = new PptxGenJS();
  for (const slide of doc.slides) {
    const s = pptx.addSlide();
    s.addText(slide.title || " ", { x: 0.5, y: 0.3, w: 9, h: 1, fontSize: 28, bold: true });
    if (slide.bullets.length > 0) {
      s.addText(
        slide.bullets.map((text) => ({ text, options: { bullet: true, breakLine: true } })),
        { x: 0.5, y: 1.5, w: 9, h: 5, fontSize: 18 }
      );
    }
  }
  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  fs.writeFileSync(filePath, buffer);
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** A simple one-section-per-slide HTML document for PDF export, via the
 * same Electron-print-engine path Word/PDF export already use — not a
 * pixel-perfect slide rendering, consistent with this module's "best
 * effort, text-first" scope. */
export function presentationToHtml(doc: PresentationDocument): string {
  const slidesHtml = doc.slides
    .map(
      (slide) =>
        `<section style="page-break-after: always; padding: 60px; font-family: sans-serif;">` +
        `<h1>${escapeHtml(slide.title)}</h1>` +
        `<ul>${slide.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>` +
        `</section>`
    )
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${slidesHtml}</body></html>`;
}

export function presentationToText(doc: PresentationDocument): string {
  return doc.slides
    .map((slide, i) => `Slide ${i + 1}: ${slide.title}\n${slide.bullets.map((b) => `- ${b}`).join("\n")}`)
    .join("\n\n");
}
