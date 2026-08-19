import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import type {
  DocStewModule,
  DocumentHandle,
  ModuleOperation,
  RenderDescriptor,
  SearchableText,
} from "../../src/shared/module-contract";

export interface ImageRenderData {
  width: number;
  height: number;
  format: string;
  mimeType: string;
  sizeBytes: number;
}

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function mimeTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext];
  if (!mime) throw new Error(`Unrecognized image extension "${ext}".`);
  return mime;
}

async function readMetadata(filePath: string): Promise<ImageRenderData> {
  const buffer = fs.readFileSync(filePath);
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    format: metadata.format ?? "unknown",
    mimeType: mimeTypeFor(filePath),
    sizeBytes: buffer.length,
  };
}

function requireFiniteNumber(value: unknown, label: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`"${label}" must be a number.`);
  return n;
}

function optionalDimension(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Dimensions must be positive numbers.");
  return Math.round(n);
}

// All operations read the full file into memory first rather than piping
// sharp's read straight from filePath — sharp cannot safely read and write
// the same path in one pipeline (the output can come out truncated/empty),
// so decoupling read from write via a Buffer sidesteps that hazard entirely.
type SharpInstance = ReturnType<typeof sharp>;

async function transformInPlace(filePath: string, transform: (image: SharpInstance) => SharpInstance): Promise<void> {
  const buffer = fs.readFileSync(filePath);
  const out = await transform(sharp(buffer)).toBuffer();
  fs.writeFileSync(filePath, out);
}

const cropOperation: ModuleOperation = {
  name: "crop",
  description: "Crop the image to the given rectangle.",
  parameters: {
    x: { type: "number" },
    y: { type: "number" },
    width: { type: "number" },
    height: { type: "number" },
  },
  async handler(handle: DocumentHandle, args: Record<string, unknown>): Promise<unknown> {
    const x = requireFiniteNumber(args.x, "x");
    const y = requireFiniteNumber(args.y, "y");
    const width = requireFiniteNumber(args.width, "width");
    const height = requireFiniteNumber(args.height, "height");
    if (width <= 0 || height <= 0) throw new Error("Crop width and height must be positive.");
    await transformInPlace(handle.filePath, (image) =>
      image.extract({ left: Math.round(x), top: Math.round(y), width: Math.round(width), height: Math.round(height) })
    );
    return { renderData: await readMetadata(handle.filePath) };
  },
};

const resizeOperation: ModuleOperation = {
  name: "resize",
  description: "Resize the image (omit one dimension to preserve aspect ratio).",
  parameters: { width: { type: "number" }, height: { type: "number" } },
  async handler(handle: DocumentHandle, args: Record<string, unknown>): Promise<unknown> {
    const width = optionalDimension(args.width);
    const height = optionalDimension(args.height);
    if (width === undefined && height === undefined) throw new Error("At least a width or height is required.");
    await transformInPlace(handle.filePath, (image) => image.resize(width ?? null, height ?? null));
    return { renderData: await readMetadata(handle.filePath) };
  },
};

const rotateOperation: ModuleOperation = {
  name: "rotate",
  description: "Rotate the image clockwise by the given number of degrees.",
  parameters: { degrees: { type: "number" } },
  async handler(handle: DocumentHandle, args: Record<string, unknown>): Promise<unknown> {
    const degrees = requireFiniteNumber(args.degrees, "degrees");
    await transformInPlace(handle.filePath, (image) =>
      image.rotate(degrees, { background: { r: 255, g: 255, b: 255, alpha: 1 } })
    );
    return { renderData: await readMetadata(handle.filePath) };
  },
};

const adjustColorOperation: ModuleOperation = {
  name: "adjustColor",
  description: "Adjust brightness, contrast, and/or saturation (1.0 = unchanged).",
  parameters: { brightness: { type: "number" }, contrast: { type: "number" }, saturation: { type: "number" } },
  async handler(handle: DocumentHandle, args: Record<string, unknown>): Promise<unknown> {
    const brightness = args.brightness !== undefined ? requireFiniteNumber(args.brightness, "brightness") : 1;
    const contrast = args.contrast !== undefined ? requireFiniteNumber(args.contrast, "contrast") : 1;
    const saturation = args.saturation !== undefined ? requireFiniteNumber(args.saturation, "saturation") : 1;
    for (const [label, value] of [
      ["brightness", brightness],
      ["contrast", contrast],
      ["saturation", saturation],
    ] as const) {
      if (value < 0) throw new Error(`"${label}" must not be negative.`);
    }
    await transformInPlace(handle.filePath, (image) => {
      const modulated = image.modulate({ brightness, saturation });
      // sharp has no direct "contrast" knob — the standard linear-remap
      // formula (output = input * a + b, pivoted around the 128 midpoint)
      // is the textbook way to derive one from modulate()'s primitives.
      return contrast === 1 ? modulated : modulated.linear(contrast, 128 * (1 - contrast));
    });
    return { renderData: await readMetadata(handle.filePath) };
  },
};

const imagesModule: DocStewModule = {
  id: "images",
  supportedExtensions: [".png", ".jpg", ".jpeg", ".webp"],

  open(filePath: string): DocumentHandle {
    return { id: filePath, filePath, moduleId: "images" };
  },

  async render(handle: DocumentHandle): Promise<RenderDescriptor> {
    return { kind: "image", data: await readMetadata(handle.filePath) };
  },

  save(): void {
    throw new Error("Image edits apply immediately via crop/resize/rotate/color tools — there's no separate Save step.");
  },

  async export(handle: DocumentHandle, format: string): Promise<Buffer> {
    const buffer = fs.readFileSync(handle.filePath);
    if (format === "png") return sharp(buffer).png().toBuffer();
    if (format === "jpg" || format === "jpeg") return sharp(buffer).jpeg().toBuffer();
    if (format === "webp") return sharp(buffer).webp().toBuffer();
    throw new Error(`images module cannot export to "${format}"`);
  },

  index(handle: DocumentHandle): SearchableText {
    // Images carry no extractable text in "core" scope (no OCR yet) — an
    // empty string keeps this document out of full-text search results
    // rather than indexing something misleading like the file path.
    return { documentId: handle.id, text: "" };
  },

  operations: [cropOperation, resizeOperation, rotateOperation, adjustColorOperation],
  aiTools: [],
};

export default imagesModule;
