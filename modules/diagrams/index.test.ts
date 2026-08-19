import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import sharp from "sharp";
import diagramsModule from "./index";
import type { DiagramDocument } from "./index";

function tempPath(fileName: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "docstew-diagrams-test-"));
  return path.join(dir, fileName);
}

test("open() returns a handle carrying the diagrams module id", () => {
  const filePath = tempPath("a.diagram");
  fs.writeFileSync(filePath, JSON.stringify({ shapes: [], connectors: [] }));
  const handle = diagramsModule.open(filePath);
  assert.equal((handle as { moduleId: string }).moduleId, "diagrams");
});

test("create() writes a real blank diagram", () => {
  const filePath = tempPath("new.diagram");
  diagramsModule.create!(filePath);
  const raw = fs.readFileSync(filePath, "utf-8");
  assert.deepEqual(JSON.parse(raw), { shapes: [], connectors: [] });
});

test("create() refuses to overwrite an existing diagram", () => {
  const filePath = tempPath("existing.diagram");
  fs.writeFileSync(filePath, JSON.stringify({ shapes: [], connectors: [] }));
  assert.throws(() => diagramsModule.create!(filePath), /already exists/);
});

test("render() returns the real parsed diagram document", async () => {
  const filePath = tempPath("a.diagram");
  const doc: DiagramDocument = {
    shapes: [{ id: "a", type: "rectangle", x: 0, y: 0, width: 40, height: 20, label: "Box", color: "#fff" }],
    connectors: [],
  };
  fs.writeFileSync(filePath, JSON.stringify(doc));
  const handle = await diagramsModule.open(filePath);
  const rendered = await diagramsModule.render(handle);
  assert.equal(rendered.kind, "diagram");
  assert.deepEqual(rendered.data, doc);
});

test("render() surfaces a clear error for a malformed diagram file", async () => {
  const filePath = tempPath("broken.diagram");
  fs.writeFileSync(filePath, "not json");
  const handle = await diagramsModule.open(filePath);
  // render() throws synchronously (it's not async) — assert.rejects would
  // miss that entirely, since the throw happens before any Promise exists.
  assert.throws(() => diagramsModule.render(handle), /isn't valid diagram JSON/);
});

test("save() writes the given document back to disk, round-tripping through render()", async () => {
  const filePath = tempPath("a.diagram");
  diagramsModule.create!(filePath);
  const handle = await diagramsModule.open(filePath);
  const doc: DiagramDocument = {
    shapes: [{ id: "a", type: "ellipse", x: 5, y: 5, width: 30, height: 30, label: "Node", color: "#eee" }],
    connectors: [],
  };
  await diagramsModule.save(handle, doc);

  const rendered = await diagramsModule.render(handle);
  assert.deepEqual(rendered.data, doc);
});

test("export() to svg returns a real, well-formed SVG document", async () => {
  const filePath = tempPath("a.diagram");
  const doc: DiagramDocument = {
    shapes: [{ id: "a", type: "rectangle", x: 0, y: 0, width: 40, height: 20, label: "Box", color: "#fff" }],
    connectors: [],
  };
  fs.writeFileSync(filePath, JSON.stringify(doc));
  const handle = await diagramsModule.open(filePath);
  const buf = await diagramsModule.export(handle, "svg");
  assert.match(buf.toString("utf-8"), /<svg xmlns=/);
});

test("export() to png returns a real rasterized PNG", async () => {
  const filePath = tempPath("a.diagram");
  const doc: DiagramDocument = {
    shapes: [{ id: "a", type: "rectangle", x: 0, y: 0, width: 40, height: 20, label: "Box", color: "#fff" }],
    connectors: [],
  };
  fs.writeFileSync(filePath, JSON.stringify(doc));
  const handle = await diagramsModule.open(filePath);
  const buf = await diagramsModule.export(handle, "png");
  const metadata = await sharp(buf).metadata();
  assert.equal(metadata.format, "png");
});

test("export() rejects an unsupported format", async () => {
  const filePath = tempPath("a.diagram");
  fs.writeFileSync(filePath, JSON.stringify({ shapes: [], connectors: [] }));
  const handle = await diagramsModule.open(filePath);
  await assert.rejects(() => Promise.resolve(diagramsModule.export(handle, "pdf")), /cannot export/);
});

test("index() joins shape and connector labels for full-text search", async () => {
  const filePath = tempPath("a.diagram");
  const doc: DiagramDocument = {
    shapes: [{ id: "a", type: "rectangle", x: 0, y: 0, width: 40, height: 20, label: "needle", color: "#fff" }],
    connectors: [{ id: "c1", fromId: "a", toId: "a", label: "haystack" }],
  };
  fs.writeFileSync(filePath, JSON.stringify(doc));
  const handle = await diagramsModule.open(filePath);
  const indexed = await diagramsModule.index(handle);
  assert.match(indexed.text, /needle/);
  assert.match(indexed.text, /haystack/);
});

test("index() returns empty text for a diagram with no labels", async () => {
  const filePath = tempPath("a.diagram");
  fs.writeFileSync(filePath, JSON.stringify({ shapes: [], connectors: [] }));
  const handle = await diagramsModule.open(filePath);
  const indexed = await diagramsModule.index(handle);
  assert.equal(indexed.text, "");
});
