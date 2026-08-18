import type BetterSqlite3 from "better-sqlite3";
import * as fs from "fs";

export interface FileVersion {
  id: number;
  documentId: string;
  sizeBytes: number;
  createdAt: number;
}

interface FileVersionRow {
  id: number;
  document_id: string;
  size_bytes: number;
  created_at: number;
}

// Whole-file snapshots are simple but not free — cap how many a single
// document accumulates rather than growing the database unboundedly.
const MAX_VERSIONS_PER_DOCUMENT = 20;

function rowToVersion(row: FileVersionRow): FileVersion {
  return { id: row.id, documentId: row.document_id, sizeBytes: row.size_bytes, createdAt: row.created_at };
}

/** Save-time version snapshots, independent of the AI engine and full-text
 * index. A snapshot is taken of a file's CURRENT on-disk bytes right before
 * an edit is about to overwrite it — so the version list represents past
 * states, and "what's on disk right now" is simply the current state,
 * needing no snapshot of its own. */
export class VersionHistory {
  private insertStmt: BetterSqlite3.Statement<Record<string, unknown>>;
  private pruneStmt: BetterSqlite3.Statement<[string, string, number]>;
  private listStmt: BetterSqlite3.Statement<[string]>;
  private getContentStmt: BetterSqlite3.Statement<[number]>;
  private getVersionStmt: BetterSqlite3.Statement<[number]>;

  constructor(private db: BetterSqlite3.Database) {
    this.insertStmt = this.db.prepare(`
      INSERT INTO file_versions (document_id, content, size_bytes, created_at)
      VALUES (@document_id, @content, @size_bytes, @created_at)
    `);
    this.pruneStmt = this.db.prepare(`
      DELETE FROM file_versions WHERE document_id = ? AND id NOT IN (
        SELECT id FROM file_versions WHERE document_id = ? ORDER BY created_at DESC LIMIT ?
      )
    `);
    this.listStmt = this.db.prepare(`
      SELECT id, document_id, size_bytes, created_at FROM file_versions
      WHERE document_id = ? ORDER BY created_at DESC
    `);
    this.getContentStmt = this.db.prepare(`SELECT content FROM file_versions WHERE id = ?`);
    this.getVersionStmt = this.db.prepare(
      `SELECT id, document_id, size_bytes, created_at FROM file_versions WHERE id = ?`
    );
  }

  /** Snapshots a file's current on-disk content. A no-op for a file that
   * doesn't exist yet (nothing to preserve before its first-ever write). */
  snapshot(documentId: string, filePath: string): void {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath);
    this.insertStmt.run({
      document_id: documentId,
      content,
      size_bytes: content.length,
      created_at: Date.now(),
    });
    this.pruneStmt.run(documentId, documentId, MAX_VERSIONS_PER_DOCUMENT);
  }

  list(documentId: string): FileVersion[] {
    return (this.listStmt.all(documentId) as FileVersionRow[]).map(rowToVersion);
  }

  /** Restores a version's content to disk — snapshotting the pre-restore
   * state first, so restoring doesn't destroy the ability to go back to
   * what was there a moment ago (restoring is itself just another edit). */
  restore(versionId: number, filePath: string): void {
    const versionRow = this.getVersionStmt.get(versionId) as FileVersionRow | undefined;
    if (!versionRow) throw new Error("That version no longer exists.");
    const contentRow = this.getContentStmt.get(versionId) as { content: Buffer } | undefined;
    if (!contentRow) throw new Error("That version no longer exists.");
    this.snapshot(versionRow.document_id, filePath);
    fs.writeFileSync(filePath, contentRow.content);
  }
}
