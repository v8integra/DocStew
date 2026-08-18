import type BetterSqlite3 from "better-sqlite3";
import { embed } from "./ollamaClient";
import { vectorToBuffer, bufferToVector, cosineSimilarity } from "./vectorCodec";

export interface EmbeddingSearchResult {
  documentId: string;
  text: string;
  score: number;
}

interface EmbeddingRow {
  document_id: string;
  vector: Buffer;
  text: string;
}

/**
 * A brute-force, in-process vector store: cosine similarity computed in JS
 * over every stored embedding, no native SQLite vector extension. Deliberately
 * simple for a personal document library (hundreds to low thousands of notes,
 * not millions) — see docstew-plan.md §4's "sqlite-vec or a lightweight local
 * vector DB"; this is the lightweight option, avoiding a native-extension
 * dependency for what's still a "basic" Phase 2 embedding index.
 */
export class EmbeddingIndex {
  private upsertStmt: BetterSqlite3.Statement<Record<string, unknown>>;
  private deleteStmt: BetterSqlite3.Statement<[string]>;
  private allStmt: BetterSqlite3.Statement<[]>;
  private countStmt: BetterSqlite3.Statement<[]>;

  constructor(
    private db: BetterSqlite3.Database,
    private embedModel: string,
    private embedFn: typeof embed = embed
  ) {
    this.upsertStmt = this.db.prepare(`
      INSERT INTO embeddings (document_id, model, vector, text, updated_at)
      VALUES (@document_id, @model, @vector, @text, @updated_at)
      ON CONFLICT(document_id) DO UPDATE SET
        model = excluded.model,
        vector = excluded.vector,
        text = excluded.text,
        updated_at = excluded.updated_at
    `);
    this.deleteStmt = this.db.prepare(`DELETE FROM embeddings WHERE document_id = ?`);
    this.allStmt = this.db.prepare(`SELECT document_id, vector, text FROM embeddings`);
    this.countStmt = this.db.prepare(`SELECT COUNT(*) AS count FROM embeddings`);
  }

  /** Embeds and stores (or re-embeds and updates) a document's searchable text.
   * An empty text removes any existing entry rather than storing a meaningless vector. */
  async indexDocument(documentId: string, text: string): Promise<void> {
    if (text.trim().length === 0) {
      this.deleteStmt.run(documentId);
      return;
    }
    const vector = await this.embedFn(this.embedModel, text);
    this.upsertStmt.run({
      document_id: documentId,
      model: this.embedModel,
      vector: vectorToBuffer(vector),
      text,
      updated_at: Date.now(),
    });
  }

  removeDocument(documentId: string): void {
    this.deleteStmt.run(documentId);
  }

  count(): number {
    return (this.countStmt.get() as { count: number }).count;
  }

  async search(query: string, topK = 5): Promise<EmbeddingSearchResult[]> {
    const queryVector = await this.embedFn(this.embedModel, query);
    const rows = this.allStmt.all() as EmbeddingRow[];
    const scored = rows.map((row) => ({
      documentId: row.document_id,
      text: row.text,
      score: cosineSimilarity(queryVector, bufferToVector(row.vector)),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }
}
