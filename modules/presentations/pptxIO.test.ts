import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { readPptx, writePptx, presentationToHtml, presentationToText } from "./pptxIO";
import { makeTestPptx } from "./testFixtures/makeTestPptx";

test("readPptx() extracts a real title placeholder and body bullets from genuine OOXML", async () => {
  const filePath = await makeTestPptx([
    { title: "Quarterly Results", bullets: ["Revenue up 12%", "Costs down 5%"] },
  ]);
  const doc = await readPptx(filePath);
  assert.equal(doc.slides.length, 1);
  assert.equal(doc.slides[0].title, "Quarterly Results");
  assert.deepEqual(doc.slides[0].bullets, ["Revenue up 12%", "Costs down 5%"]);
});

test("readPptx() reads multiple real slides in the correct numeric order", async () => {
  const filePath = await makeTestPptx([
    { title: "First", bullets: [] },
    { title: "Second", bullets: [] },
    { title: "Third", bullets: [] },
  ]);
  const doc = await readPptx(filePath);
  assert.deepEqual(doc.slides.map((s) => s.title), ["First", "Second", "Third"]);
});

test("readPptx() falls back to the first text shape when there's no title placeholder", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "docstew-pptx-notitle-test-"));
  const filePath = path.join(dir, "test.pptx");
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const xml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree>' +
    '<p:sp><p:txBody><a:p><a:r><a:t>Untitled Heading</a:t></a:r></a:p></p:txBody></p:sp>' +
    '<p:sp><p:txBody><a:p><a:r><a:t>Some other text</a:t></a:r></a:p></p:txBody></p:sp>' +
    "</p:spTree></p:cSld></p:sld>";
  zip.file("ppt/slides/slide1.xml", xml);
  fs.writeFileSync(filePath, await zip.generateAsync({ type: "nodebuffer" }));

  const doc = await readPptx(filePath);
  assert.equal(doc.slides[0].title, "Untitled Heading");
  assert.deepEqual(doc.slides[0].bullets, ["Some other text"]);
});

test("writePptx() + readPptx() round-trips real slide content", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "docstew-pptx-roundtrip-test-"));
  const filePath = path.join(dir, "out.pptx");
  const doc = { slides: [{ title: "Intro", bullets: ["Point A", "Point B"] }] };

  await writePptx(filePath, doc);
  assert.match(fs.readFileSync(filePath).toString("latin1", 0, 2), /PK/);

  const reread = await readPptx(filePath);
  assert.equal(reread.slides[0].title, "Intro");
  assert.deepEqual(reread.slides[0].bullets, ["Point A", "Point B"]);
});

test("writePptx() handles a slide with an empty title and no bullets without throwing", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "docstew-pptx-empty-test-"));
  const filePath = path.join(dir, "out.pptx");
  await assert.doesNotReject(() => writePptx(filePath, { slides: [{ title: "", bullets: [] }] }));
});

test("presentationToHtml() renders one section per slide with escaped text", () => {
  const html = presentationToHtml({
    slides: [{ title: "<script>bad</script>", bullets: ["a & b"] }],
  });
  assert.match(html, /<section/);
  assert.ok(!html.includes("<script>bad</script>"), "a real <script> tag must not pass through unescaped");
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /a &amp; b/);
});

test("presentationToText() lists each slide's title and bullets", () => {
  const text = presentationToText({
    slides: [
      { title: "One", bullets: ["x"] },
      { title: "Two", bullets: [] },
    ],
  });
  assert.match(text, /Slide 1: One/);
  assert.match(text, /- x/);
  assert.match(text, /Slide 2: Two/);
});
