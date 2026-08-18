// marked ships ESM-only (no "require" export condition), but this project's
// main process is CommonJS — require("marked") fails with ERR_REQUIRE_ESM.
// A genuine dynamic import() works from CJS at runtime — but TypeScript
// silently downlevels a literal `import(...)` expression back to
// `Promise.resolve().then(() => require(...))` when targeting CommonJS,
// reintroducing the exact same error. Routing it through `new Function`
// hides the import() from TS's downleveling so the real ESM loader runs.
type MarkedModule = typeof import("marked");
const dynamicImport = new Function("specifier", "return import(specifier)") as (
  specifier: string
) => Promise<MarkedModule>;

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let markedModulePromise: Promise<MarkedModule> | null = null;

function getMarked(): Promise<MarkedModule> {
  if (!markedModulePromise) {
    markedModulePromise = dynamicImport("marked").then((mod) => {
      // Raw HTML embedded in a note (an <img onerror=...> or similar) would
      // otherwise pass straight through marked's default renderer into the
      // preview pane's innerHTML. Escaping instead of dropping it keeps the
      // content visible as text.
      const renderer = new mod.Renderer();
      renderer.html = ({ text }) => escapeHtml(text);
      mod.marked.use({ renderer });
      return mod;
    });
  }
  return markedModulePromise;
}

export async function renderMarkdownToHtml(markdown: string): Promise<string> {
  const { marked } = await getMarked();
  return marked.parse(markdown, { async: false }) as string;
}
