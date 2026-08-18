import type { StructuredFormat } from "./formats";

// Same escaping discipline as src/main/markdown.ts's HTML-embedded-in-content
// defense — anything that reaches innerHTML in the renderer must have &, <,
// > (and " for safety) escaped first, token content included.
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const JSON_TOKEN = /"(?:\\.|[^"\\])*"(\s*:)?|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

function highlightJson(text: string): string {
  let result = "";
  let lastIndex = 0;
  JSON_TOKEN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = JSON_TOKEN.exec(text))) {
    result += escapeHtml(text.slice(lastIndex, match.index));
    const token = match[0];
    let cls: string;
    if (token.startsWith('"')) {
      cls = match[1] ? "sd-key" : "sd-string";
    } else if (token === "true" || token === "false") {
      cls = "sd-boolean";
    } else if (token === "null") {
      cls = "sd-null";
    } else {
      cls = "sd-number";
    }
    result += `<span class="${cls}">${escapeHtml(token)}</span>`;
    lastIndex = match.index + token.length;
  }
  result += escapeHtml(text.slice(lastIndex));
  return result;
}

function highlightXml(text: string): string {
  return text
    .split(/(<[^>]*>)/g)
    .map((part) => {
      if (part.startsWith("<")) {
        const withAttrs = escapeHtml(part).replace(
          /(&quot;)((?:(?!&quot;).)*)(&quot;)/g,
          (_m, open: string, inner: string, close: string) => `${open}<span class="sd-string">${inner}</span>${close}`
        );
        return `<span class="sd-tag">${withAttrs}</span>`;
      }
      return escapeHtml(part);
    })
    .join("");
}

function highlightYaml(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const commentMatch = line.match(/^(\s*)(#.*)$/);
      if (commentMatch) {
        return `${escapeHtml(commentMatch[1])}<span class="sd-comment">${escapeHtml(commentMatch[2])}</span>`;
      }
      const keyMatch = line.match(/^(\s*(?:-\s+)?)([^:\s][^:]*?)(:)(\s.*|)$/);
      if (keyMatch) {
        const [, indent, key, colon, rest] = keyMatch;
        return `${escapeHtml(indent)}<span class="sd-key">${escapeHtml(key)}</span>${colon}${escapeHtml(rest)}`;
      }
      return escapeHtml(line);
    })
    .join("\n");
}

export function highlightStructuredText(text: string, format: StructuredFormat): string {
  if (format === "json") return highlightJson(text);
  if (format === "xml") return highlightXml(text);
  return highlightYaml(text);
}
