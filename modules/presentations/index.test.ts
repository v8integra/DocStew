import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import presentationsModule from "./index";
import type { PresentationDocument } from "./index";
import { makeTestPptx } from "./testFixtures/makeTestPptx";

test("open() returns a handle carrying the presentations module id", async () => {
  const filePath = await makeTestPptx([{ title: "T", bullets: [] }]);
  const handle = await presentationsModule.open(filePath);
  assert.equal(handle.moduleId, "presentations");
});

test("create() writes a real openable blank presentation", async () => {
  const filePath = (await makeTestPptx([{ title: "placeholder", bullets: [] }])).replace("test.pptx", "new.pptx");
  await presentationsModule.create!(filePath);
  const handle = await presentationsModule.open(filePath);
  const rendered = await presentationsModule.render(handle);
  const data = rendered.data as PresentationDocument;
  assert.equal(data.slides.length, 1);
});

test("create() refuses to overwrite an existing file", async () => {
  const filePath = await makeTestPptx([{ title: "T", bullets: [] }]);
  await assert.rejects(() => Promise.resolve(presentationsModule.create!(filePath)), /already exists/);
});

test("render() returns the real extracted slide content", async () => {
  const filePath = await makeTestPptx([{ title: "Real Title", bullets: ["Real bullet"] }]);
  const handle = await presentationsModule.open(filePath);
  const rendered = await presentationsModule.render(handle);
  assert.equal(rendered.kind, "presentation");
  const data = rendered.data as PresentationDocument;
  assert.equal(data.slides[0].title, "Real Title");
  assert.deepEqual(data.slides[0].bullets, ["Real bullet"]);
});

test("save() regenerates a real .pptx reflecting the edited structure", async () => {
  const filePath = await makeTestPptx([{ title: "Old", bullets: [] }]);
  const handle = await presentationsModule.open(filePath);
  const edited: PresentationDocument = { slides: [{ title: "New Title", bullets: ["New bullet"] }] };

  await presentationsModule.save(handle, edited);

  const reRendered = await presentationsModule.render(handle);
  const data = reRendered.data as PresentationDocument;
  assert.equal(data.slides[0].title, "New Title");
  assert.deepEqual(data.slides[0].bullets, ["New bullet"]);
});

test("export() to pptx returns the raw file bytes", async () => {
  const filePath = await makeTestPptx([{ title: "T", bullets: [] }]);
  const handle = await presentationsModule.open(filePath);
  const buf = await presentationsModule.export(handle, "pptx");
  assert.deepEqual(buf, await fs.promises.readFile(filePath));
});

test("export() to txt returns real slide text content", async () => {
  const filePath = await makeTestPptx([{ title: "Exportable Title", bullets: ["Exportable bullet"] }]);
  const handle = await presentationsModule.open(filePath);
  const buf = await presentationsModule.export(handle, "txt");
  const text = buf.toString("utf-8");
  assert.match(text, /Exportable Title/);
  assert.match(text, /Exportable bullet/);
});

test("export() rejects an unsupported format", async () => {
  const filePath = await makeTestPptx([{ title: "T", bullets: [] }]);
  const handle = await presentationsModule.open(filePath);
  await assert.rejects(() => Promise.resolve(presentationsModule.export(handle, "docx")), /cannot export/);
});

test("index() returns real title and bullet text for search", async () => {
  const filePath = await makeTestPptx([{ title: "needle", bullets: ["haystack"] }]);
  const handle = await presentationsModule.open(filePath);
  const indexed = await presentationsModule.index(handle);
  assert.match(indexed.text, /needle/);
  assert.match(indexed.text, /haystack/);
});
