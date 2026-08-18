const fs = require("fs");
const path = require("path");

const assets = [
  ["src/renderer/index.html", "dist/src/renderer/index.html"],
  ["src/renderer/styles.css", "dist/src/renderer/styles.css"],
  ["src/renderer/pdfjs-loader.mjs", "dist/src/renderer/pdfjs-loader.mjs"],
  ["node_modules/pdfjs-dist/legacy/build/pdf.mjs", "dist/src/renderer/pdfjs/pdf.mjs"],
  ["node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs", "dist/src/renderer/pdfjs/pdf.worker.mjs"],
];

const directoryAssets = [
  // Needed for correct glyph rendering on PDFs with non-embedded/CJK fonts.
  ["node_modules/pdfjs-dist/standard_fonts", "dist/src/renderer/pdfjs/standard_fonts"],
  ["node_modules/pdfjs-dist/cmaps", "dist/src/renderer/pdfjs/cmaps"],
];

for (const [from, to] of assets) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

for (const [from, to] of directoryAssets) {
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
}
