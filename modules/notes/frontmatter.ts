export interface ParsedNote {
  title: string;
  tags: string[];
  body: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/**
 * A small hand-rolled parser for this module's own narrow frontmatter shape
 * (title: string, tags: [a, b, c]) — not a general YAML parser. Deliberately
 * avoids taking a full YAML dependency for two fields.
 */
export function parseNote(raw: string, fallbackTitle: string): ParsedNote {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    return { title: fallbackTitle, tags: [], body: raw };
  }

  const [, frontmatter, body] = match;
  let title = fallbackTitle;
  let tags: string[] = [];

  for (const line of frontmatter.split(/\r?\n/)) {
    const titleMatch = line.match(/^title:\s*(.*)$/);
    if (titleMatch) {
      title = titleMatch[1].trim().replace(/^["']|["']$/g, "") || fallbackTitle;
      continue;
    }
    const tagsMatch = line.match(/^tags:\s*\[(.*)\]$/);
    if (tagsMatch) {
      tags = tagsMatch[1]
        .split(",")
        .map((t) => t.trim().replace(/^["']|["']$/g, ""))
        .filter((t) => t.length > 0);
    }
  }

  return { title, tags, body };
}

export function serializeNote(note: ParsedNote): string {
  const tagsLine = `tags: [${note.tags.join(", ")}]`;
  return `---\ntitle: ${note.title}\n${tagsLine}\n---\n${note.body}`;
}
