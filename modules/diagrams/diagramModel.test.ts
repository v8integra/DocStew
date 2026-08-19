import { test } from "node:test";
import assert from "node:assert/strict";
import { createBlankDiagram, parseDiagram, serializeDiagram } from "./diagramModel";
import type { DiagramDocument } from "./diagramModel";

test("createBlankDiagram() returns an empty valid document", () => {
  const doc = createBlankDiagram();
  assert.deepEqual(doc, { shapes: [], connectors: [] });
});

test("parseDiagram() parses real serialized shapes and connectors", () => {
  const doc: DiagramDocument = {
    shapes: [{ id: "a", type: "rectangle", x: 0, y: 0, width: 100, height: 50, label: "Start", color: "#fff" }],
    connectors: [{ id: "c1", fromId: "a", toId: "a", label: "loop" }],
  };
  const raw = serializeDiagram(doc);
  const reparsed = parseDiagram(raw);
  assert.deepEqual(reparsed, doc);
});

test("parseDiagram() rejects invalid JSON with a clear error", () => {
  assert.throws(() => parseDiagram("{not valid"), /isn't valid diagram JSON/);
});

test("parseDiagram() rejects a document with malformed shapes", () => {
  assert.throws(
    () => parseDiagram(JSON.stringify({ shapes: [{ id: "a" }], connectors: [] })),
    /malformed shapes/
  );
});

test("parseDiagram() rejects a document with malformed connectors", () => {
  assert.throws(
    () => parseDiagram(JSON.stringify({ shapes: [], connectors: [{ fromId: "a" }] })),
    /malformed connectors/
  );
});

test("parseDiagram() rejects an unrecognized shape type", () => {
  const raw = JSON.stringify({
    shapes: [{ id: "a", type: "hexagon", x: 0, y: 0, width: 10, height: 10, label: "", color: "#fff" }],
    connectors: [],
  });
  assert.throws(() => parseDiagram(raw), /malformed shapes/);
});

test("serializeDiagram() produces human-readable indented JSON", () => {
  const raw = serializeDiagram(createBlankDiagram());
  assert.match(raw, /\n {2}"shapes"/);
});
