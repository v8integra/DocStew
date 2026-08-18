import type BetterSqlite3 from "better-sqlite3";

export interface FullTextMatch {
  documentId: string;
  snippet: string;
}

/** Turns raw user input into a query FTS5's MATCH syntax can never reject.
 * FTS5 has its own query language (AND/OR/NOT, quoted phrases, prefix `*`,
 * parentheses) — verified empirically that ordinary-looking input breaks it
 * outright ("hello-world", "C++", an unbalanced quote or paren all throw a
 * syntax error). Tokenizing and wrapping each word in its own quoted phrase
 * neutralizes every special character, joined with OR so any matching word
 * surfaces a result. Returns null when there's nothing searchable (FTS5
 * rejects an empty MATCH query). */
function sanitizeQuery(raw: string): string | null {
  const tokens = raw.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (tokens.length === 0) return null;
  return tokens.map((token) => `"${token.replace(/"/g, '""')}"`).join(" OR ");
}

/** Full-text search over indexed documents' extracted text, independent of
 * the AI engine — works even when Ollama isn't installed/running, unlike
 * the semantic "ask my notes" chat (see ai-engine/embeddingIndex.ts). */
export class FullTextIndex {
  private upsertStmt: BetterSqlite3.Statement<Record<string, unknown>>;
  private deleteStmt: BetterSqlite3.Statement<[string]>;
  private searchStmt: BetterSqlite3.Statement<[string, number]>;

  constructor(private db: BetterSqlite3.Database) {
    this.upsertStmt = this.db.prepare(`
      INSERT INTO documents_fts (document_id, file_name, text) VALUES (@document_id, @file_name, @text)
    `);
    this.deleteStmt = this.db.prepare(`DELETE FROM documents_fts WHERE document_id = ?`);
    this.searchStmt = this.db.prepare(`
      SELECT document_id, snippet(documents_fts, 2, '‹', '›', '…', 12) AS snippet
      FROM documents_fts
      WHERE documents_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `);
  }

  indexDocument(documentId: string, fileName: string, text: string): void {
    this.deleteStmt.run(documentId);
    if (fileName.trim().length === 0 && text.trim().length === 0) return;
    this.upsertStmt.run({ document_id: documentId, file_name: fileName, text });
  }

  removeDocument(documentId: string): void {
    this.deleteStmt.run(documentId);
  }

  search(query: string, limit = 20): FullTextMatch[] {
    const sanitized = sanitizeQuery(query);
    if (!sanitized) return [];
    const rows = this.searchStmt.all(sanitized, limit) as Array<{ document_id: string; snippet: string }>;
    return rows.map((row) => ({ documentId: row.document_id, snippet: row.snippet }));
  }
}
