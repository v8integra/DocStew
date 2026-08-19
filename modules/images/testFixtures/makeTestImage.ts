import sharp from "sharp";

export interface TestImageOptions {
  width?: number;
  height?: number;
  format?: "png" | "jpeg" | "webp";
  color?: { r: number; g: number; b: number };
}

/** Generates a real, valid image file for tests via sharp's synthetic-image
 * support, rather than committing binary fixture files to the repo — same
 * spirit as this project's other testFixtures/ helpers (makeTestDocx,
 * makeTestWorkbook) that build real documents in-memory. */
export async function makeTestImage(filePath: string, options: TestImageOptions = {}): Promise<void> {
  const width = options.width ?? 20;
  const height = options.height ?? 10;
  const format = options.format ?? "png";
  const color = options.color ?? { r: 200, g: 50, b: 50 };

  let image = sharp({ create: { width, height, channels: 3, background: color } });
  if (format === "png") image = image.png();
  else if (format === "jpeg") image = image.jpeg();
  else image = image.webp();

  await image.toFile(filePath);
}
