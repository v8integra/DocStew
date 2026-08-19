import { test } from "node:test";
import assert from "node:assert/strict";
import { diagramToSvg } from "./diagramSvg";
import type { DiagramDocument } from "./diagramModel";

test("diagramToSvg() renders a rectangle with its label", () => {
  const doc: DiagramDocument = {
    shapes: [{ id: "a", type: "rectangle", x: 10, y: 10, width: 100, height: 50, label: "Start", color: "#eeeeee" }],
    connectors: [],
  };
  const svg = diagramToSvg(doc);
  assert.match(svg, /<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /<rect x="10" y="10" width="100" height="50"/);
  assert.match(svg, />Start<\/text>/);
});

test("diagramToSvg() renders an ellipse and a diamond with the right SVG primitives", () => {
  const doc: DiagramDocument = {
    shapes: [
      { id: "a", type: "ellipse", x: 0, y: 0, width: 40, height: 20, label: "", color: "#fff" },
      { id: "b", type: "diamond", x: 0, y: 100, width: 40, height: 40, label: "", color: "#fff" },
    ],
    connectors: [],
  };
  const svg = diagramToSvg(doc);
  assert.match(svg, /<ellipse cx="20" cy="10" rx="20" ry="10"/);
  assert.match(svg, /<polygon points="20,100 40,120 20,140 0,120"/);
});

test("diagramToSvg() escapes label text instead of injecting it as raw markup", () => {
  const doc: DiagramDocument = {
    shapes: [{ id: "a", type: "rectangle", x: 0, y: 0, width: 40, height: 20, label: '<script>alert(1)</script>', color: "#fff" }],
    connectors: [],
  };
  const svg = diagramToSvg(doc);
  assert.ok(!svg.includes("<script>"), "a real <script> tag must not pass through unescaped");
  assert.match(svg, /&lt;script&gt;/);
});

test("diagramToSvg() draws a connector line that stops at each shape's boundary, not its center", () => {
  const doc: DiagramDocument = {
    shapes: [
      { id: "a", type: "rectangle", x: 0, y: 0, width: 100, height: 50, label: "", color: "#fff" },
      { id: "b", type: "rectangle", x: 300, y: 0, width: 100, height: 50, label: "", color: "#fff" },
    ],
    connectors: [{ id: "c1", fromId: "a", toId: "b", label: "" }],
  };
  const svg = diagramToSvg(doc);
  const match = svg.match(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/);
  assert.ok(match, "expected a real <line> element for the connector");
  const [, x1, , x2] = match!;
  // Shape a's right edge is at x=100, shape b's left edge is at x=300 —
  // the line must start/end at those edges, not at the centers (50, 350).
  assert.equal(Number(x1), 100);
  assert.equal(Number(x2), 300);
});

test("diagramToSvg() skips a connector referencing a missing shape instead of throwing", () => {
  const doc: DiagramDocument = {
    shapes: [{ id: "a", type: "rectangle", x: 0, y: 0, width: 40, height: 20, label: "", color: "#fff" }],
    connectors: [{ id: "c1", fromId: "a", toId: "missing", label: "" }],
  };
  assert.doesNotThrow(() => diagramToSvg(doc));
});

test("diagramToSvg() sizes the canvas to fit the content", () => {
  const doc: DiagramDocument = {
    shapes: [{ id: "a", type: "rectangle", x: 500, y: 500, width: 50, height: 50, label: "", color: "#fff" }],
    connectors: [],
  };
  const svg = diagramToSvg(doc);
  assert.match(svg, /width="590"/);
  assert.match(svg, /height="590"/);
});
