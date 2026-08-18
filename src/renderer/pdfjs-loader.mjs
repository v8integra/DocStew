// A genuine ES module (not TypeScript-compiled — tsconfig only touches
// src/**/*.ts) so pdfjs-dist's ESM-only build can be loaded with a real
// static `import`, which the page's CSP (`default-src 'self'`) allows for a
// same-origin script with no eval needed. renderer.ts is deliberately kept a
// classic (non-module) script — see its own comments — so it can't use
// `import` directly; it reads pdfjs off `window.pdfjsLib` instead, set here.
import * as pdfjsLib from "./pdfjs/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = "./pdfjs/pdf.worker.mjs";
window.pdfjsLib = pdfjsLib;
