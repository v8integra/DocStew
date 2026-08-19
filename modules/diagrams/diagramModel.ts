export type ShapeType = "rectangle" | "ellipse" | "diamond";

export interface DiagramShape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  color: string;
}

export interface DiagramConnector {
  id: string;
  fromId: string;
  toId: string;
  label: string;
}

export interface DiagramDocument {
  shapes: DiagramShape[];
  connectors: DiagramConnector[];
}

export function createBlankDiagram(): DiagramDocument {
  return { shapes: [], connectors: [] };
}

const SHAPE_TYPES: ShapeType[] = ["rectangle", "ellipse", "diamond"];

function isShape(value: unknown): value is DiagramShape {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.id === "string" &&
    typeof s.type === "string" &&
    SHAPE_TYPES.includes(s.type as ShapeType) &&
    typeof s.x === "number" &&
    typeof s.y === "number" &&
    typeof s.width === "number" &&
    typeof s.height === "number" &&
    typeof s.label === "string" &&
    typeof s.color === "string"
  );
}

function isConnector(value: unknown): value is DiagramConnector {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.id === "string" &&
    typeof c.fromId === "string" &&
    typeof c.toId === "string" &&
    typeof c.label === "string"
  );
}

/** Parses and validates a diagram document's raw JSON text, throwing a clear
 * error rather than letting a malformed/foreign file silently produce a
 * blank or partially-broken diagram. */
export function parseDiagram(raw: string): DiagramDocument {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    throw new Error(`This file isn't valid diagram JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (typeof value !== "object" || value === null) {
    throw new Error("This file isn't a valid diagram document.");
  }
  const doc = value as Record<string, unknown>;
  if (!Array.isArray(doc.shapes) || !doc.shapes.every(isShape)) {
    throw new Error("This file isn't a valid diagram document (malformed shapes).");
  }
  if (!Array.isArray(doc.connectors) || !doc.connectors.every(isConnector)) {
    throw new Error("This file isn't a valid diagram document (malformed connectors).");
  }
  return { shapes: doc.shapes, connectors: doc.connectors };
}

export function serializeDiagram(doc: DiagramDocument): string {
  return JSON.stringify(doc, null, 2);
}
