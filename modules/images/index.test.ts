import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import sharp from "sharp";
import imagesModule from "./index";
import type { ImageRenderData } from "./index";
import { makeTestImage } from "./testFixtures/makeTestImage";

function tempPath(fileName: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "docstew-images-test-"));
  return path.join(dir, fileName);
}

test("open() returns a handle carrying the images module id", async () => {
  const filePath = tempPath("a.png");
  await makeTestImage(filePath);
  const handle = imagesModule.open(filePath);
  assert.equal((handle as { moduleId: string }).moduleId, "images");
});

test("render() reports real dimensions, format, and mime type from a real PNG", async () => {
  const filePath = tempPath("a.png");
  await makeTestImage(filePath, { width: 40, height: 20, format: "png" });
  const handle = await imagesModule.open(filePath);
  const rendered = await imagesModule.render(handle);
  const data = rendered.data as ImageRenderData;
  assert.equal(rendered.kind, "image");
  assert.equal(data.width, 40);
  assert.equal(data.height, 20);
  assert.equal(data.format, "png");
  assert.equal(data.mimeType, "image/png");
  assert.ok(data.sizeBytes > 0);
});

test("render() reports a real JPEG correctly", async () => {
  const filePath = tempPath("a.jpg");
  await makeTestImage(filePath, { width: 12, height: 8, format: "jpeg" });
  const handle = await imagesModule.open(filePath);
  const rendered = await imagesModule.render(handle);
  const data = rendered.data as ImageRenderData;
  assert.equal(data.format, "jpeg");
  assert.equal(data.mimeType, "image/jpeg");
});

test("save() refuses rather than silently doing nothing (edits apply immediately per operation)", async () => {
  const filePath = tempPath("a.png");
  await makeTestImage(filePath);
  const handle = await imagesModule.open(filePath);
  assert.throws(() => imagesModule.save(handle), /apply immediately/);
});

test("export() to a different real format actually converts the bytes", async () => {
  const filePath = tempPath("a.png");
  await makeTestImage(filePath, { format: "png" });
  const handle = await imagesModule.open(filePath);
  const buf = await imagesModule.export(handle, "webp");
  const metadata = await sharp(buf).metadata();
  assert.equal(metadata.format, "webp");
});

test("export() rejects an unsupported format", async () => {
  const filePath = tempPath("a.png");
  await makeTestImage(filePath);
  const handle = await imagesModule.open(filePath);
  await assert.rejects(() => Promise.resolve(imagesModule.export(handle, "gif")), /cannot export/);
});

test("index() returns empty text (no OCR in core scope)", async () => {
  const filePath = tempPath("a.png");
  await makeTestImage(filePath);
  const handle = await imagesModule.open(filePath);
  const indexed = await imagesModule.index(handle);
  assert.equal(indexed.text, "");
});

test("crop operation really crops the file on disk", async () => {
  const filePath = tempPath("a.png");
  await makeTestImage(filePath, { width: 40, height: 40 });
  const handle = await imagesModule.open(filePath);
  const op = imagesModule.operations!.find((o) => o.name === "crop")!;

  const result = (await op.handler(handle, { x: 0, y: 0, width: 10, height: 5 })) as {
    renderData: ImageRenderData;
  };
  assert.equal(result.renderData.width, 10);
  assert.equal(result.renderData.height, 5);

  const reread = await sharp(fs.readFileSync(filePath)).metadata();
  assert.equal(reread.width, 10);
  assert.equal(reread.height, 5);
});

test("crop operation rejects a non-positive rectangle", async () => {
  const filePath = tempPath("a.png");
  await makeTestImage(filePath, { width: 20, height: 20 });
  const handle = await imagesModule.open(filePath);
  const op = imagesModule.operations!.find((o) => o.name === "crop")!;
  await assert.rejects(() => op.handler(handle, { x: 0, y: 0, width: 0, height: 5 }), /positive/);
});

test("resize operation really resizes the file, preserving aspect ratio when only one dimension is given", async () => {
  const filePath = tempPath("a.png");
  await makeTestImage(filePath, { width: 40, height: 20 });
  const handle = await imagesModule.open(filePath);
  const op = imagesModule.operations!.find((o) => o.name === "resize")!;

  const result = (await op.handler(handle, { width: 20 })) as { renderData: ImageRenderData };
  assert.equal(result.renderData.width, 20);
  assert.equal(result.renderData.height, 10);

  const reread = await sharp(fs.readFileSync(filePath)).metadata();
  assert.equal(reread.width, 20);
  assert.equal(reread.height, 10);
});

test("resize operation requires at least one dimension", async () => {
  const filePath = tempPath("a.png");
  await makeTestImage(filePath);
  const handle = await imagesModule.open(filePath);
  const op = imagesModule.operations!.find((o) => o.name === "resize")!;
  await assert.rejects(() => op.handler(handle, {}), /width or height/);
});

test("rotate operation really rotates the file (dimensions swap for a 90-degree turn)", async () => {
  const filePath = tempPath("a.png");
  await makeTestImage(filePath, { width: 40, height: 20 });
  const handle = await imagesModule.open(filePath);
  const op = imagesModule.operations!.find((o) => o.name === "rotate")!;

  const result = (await op.handler(handle, { degrees: 90 })) as { renderData: ImageRenderData };
  assert.equal(result.renderData.width, 20);
  assert.equal(result.renderData.height, 40);
});

test("adjustColor operation really changes real pixel values", async () => {
  const filePath = tempPath("a.png");
  await makeTestImage(filePath, { width: 4, height: 4, color: { r: 100, g: 100, b: 100 } });
  const handle = await imagesModule.open(filePath);
  const op = imagesModule.operations!.find((o) => o.name === "adjustColor")!;

  await op.handler(handle, { brightness: 2 });

  const { data } = await sharp(fs.readFileSync(filePath)).raw().toBuffer({ resolveWithObject: true });
  assert.ok(data[0] > 150, `expected brightened pixel value > 150, got ${data[0]}`);
});

test("adjustColor operation rejects a negative value", async () => {
  const filePath = tempPath("a.png");
  await makeTestImage(filePath);
  const handle = await imagesModule.open(filePath);
  const op = imagesModule.operations!.find((o) => o.name === "adjustColor")!;
  await assert.rejects(() => op.handler(handle, { brightness: -1 }), /must not be negative/);
});
