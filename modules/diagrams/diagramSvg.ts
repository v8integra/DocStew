import type { DiagramDocument, DiagramShape } from "./diagramModel";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Finds the point on a shape's own boundary in the direction of (dirX,
 * dirY) from its center — used so connector lines meet a shape's edge
 * instead of running straight through it to the center. Each shape type
 * needs its own boundary formula: a rectangle's edge is wherever the
 * direction ray first crosses x=±width/2 or y=±height/2 (max-norm), an
 * ellipse's edge follows the standard ellipse-radius formula, and a
 * diamond (a rotated square) uses the taxicab/L1-norm boundary. */
function boundaryPoint(shape: DiagramShape, dirX: number, dirY: number): { x: number; y: number } {
  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  const rx = shape.width / 2 || 1;
  const ry = shape.height / 2 || 1;
  if (dirX === 0 && dirY === 0) return { x: cx, y: cy };

  let scale: number;
  if (shape.type === "ellipse") {
    scale = 1 / Math.sqrt((dirX / rx) ** 2 + (dirY / ry) ** 2);
  } else if (shape.type === "diamond") {
    scale = 1 / (Math.abs(dirX) / rx + Math.abs(dirY) / ry);
  } else {
    scale = 1 / Math.max(Math.abs(dirX) / rx, Math.abs(dirY) / ry);
  }
  return { x: cx + dirX * scale, y: cy + dirY * scale };
}

function shapeCenter(shape: DiagramShape): { x: number; y: number } {
  return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
}

function renderShape(shape: DiagramShape): string {
  const fill = escapeXml(shape.color || "#ffffff");
  const { x: cx, y: cy } = shapeCenter(shape);

  let shapeEl: string;
  if (shape.type === "ellipse") {
    shapeEl = `<ellipse cx="${cx}" cy="${cy}" rx="${shape.width / 2}" ry="${shape.height / 2}" fill="${fill}" stroke="#333333" stroke-width="1.5" />`;
  } else if (shape.type === "diamond") {
    const points = `${cx},${shape.y} ${shape.x + shape.width},${cy} ${cx},${shape.y + shape.height} ${shape.x},${cy}`;
    shapeEl = `<polygon points="${points}" fill="${fill}" stroke="#333333" stroke-width="1.5" />`;
  } else {
    shapeEl = `<rect x="${shape.x}" y="${shape.y}" width="${shape.width}" height="${shape.height}" rx="4" fill="${fill}" stroke="#333333" stroke-width="1.5" />`;
  }

  const labelEl = shape.label
    ? `<text x="${cx}" y="${cy}" font-size="12" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle" fill="#111111">${escapeXml(shape.label)}</text>`
    : "";

  return `${shapeEl}\n${labelEl}`;
}

export function diagramToSvg(doc: DiagramDocument): string {
  const shapesById = new Map(doc.shapes.map((s) => [s.id, s]));

  let maxX = 0;
  let maxY = 0;
  for (const shape of doc.shapes) {
    maxX = Math.max(maxX, shape.x + shape.width);
    maxY = Math.max(maxY, shape.y + shape.height);
  }
  const width = Math.max(maxX + 40, 200);
  const height = Math.max(maxY + 40, 200);

  const connectorsSvg = doc.connectors
    .map((connector) => {
      const from = shapesById.get(connector.fromId);
      const to = shapesById.get(connector.toId);
      if (!from || !to) return "";
      const fromCenter = shapeCenter(from);
      const toCenter = shapeCenter(to);
      const dirX = toCenter.x - fromCenter.x;
      const dirY = toCenter.y - fromCenter.y;
      const p1 = boundaryPoint(from, dirX, dirY);
      const p2 = boundaryPoint(to, -dirX, -dirY);
      const labelEl = connector.label
        ? `<text x="${(p1.x + p2.x) / 2}" y="${(p1.y + p2.y) / 2 - 4}" font-size="11" font-family="sans-serif" text-anchor="middle" fill="#333333">${escapeXml(connector.label)}</text>`
        : "";
      return `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#333333" stroke-width="1.5" marker-end="url(#arrow)" />\n${labelEl}`;
    })
    .join("\n");

  const shapesSvg = doc.shapes.map(renderShape).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="#333333" />
    </marker>
  </defs>
  <rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />
  ${connectorsSvg}
  ${shapesSvg}
</svg>`;
}
