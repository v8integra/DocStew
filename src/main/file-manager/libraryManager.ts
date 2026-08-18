import type { Database } from "better-sqlite3";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import type { PluginRegistry } from "../plugin-registry/registry";

export interface DocumentRecord {
  id: string;
  filePath: string;
  fileName: string;
  extension: string;
  moduleId: string | null;
  sizeBytes: number;
  mtimeMs: number;
  addedAt: number;
}

interface DocumentRow {
  id: string;
  file_path: string;
  file_name: string;
  extension: string;
  module_id: string | null;
  size_bytes: number;
  mtime_ms: number;
  added_at: number;
}

function rowToRecord(row: DocumentRow): DocumentRecord {
  return {
    id: row.id,
    filePath: row.file_path,
    fileName: row.file_name,
    extension: row.extension,
    moduleId: row.module_id,
    sizeBytes: row.size_bytes,
    mtimeMs: row.mtime_ms,
    addedAt: row.added_at,
  };
}

/**
 * The File/Library Manager (docstew-plan.md §4): tracks which folders the
 * user has opened, indexes the files in them into SQLite, and resolves each
 * file to the module (if any) that can handle it via the Plugin Registry.
 */
export class LibraryManager {
  constructor(private db: Database, private registry: PluginRegistry) {}

  /** Scans a folder (top-level only, in Phase 0) and upserts each file's metadata. */
  openFolder(folderPath: string): DocumentRecord[] {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    const upsert = this.db.prepare(`
      INSERT INTO documents (id, file_path, file_name, extension, module_id, size_bytes, mtime_ms, added_at)
      VALUES (@id, @file_path, @file_name, @extension, @module_id, @size_bytes, @mtime_ms, @added_at)
      ON CONFLICT(file_path) DO UPDATE SET
        module_id = excluded.module_id,
        size_bytes = excluded.size_bytes,
        mtime_ms = excluded.mtime_ms
    `);

    const now = Date.now();
    const records: DocumentRecord[] = [];

    const transaction = this.db.transaction(() => {
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const filePath = path.join(folderPath, entry.name);
        const stat = fs.statSync(filePath);
        const moduleId = this.registry.findByExtension(filePath)?.id ?? null;
        const record: DocumentRecord = {
          id: crypto.createHash("sha1").update(filePath).digest("hex"),
          filePath,
          fileName: entry.name,
          extension: path.extname(entry.name).toLowerCase(),
          moduleId,
          sizeBytes: stat.size,
          mtimeMs: stat.mtimeMs,
          addedAt: now,
        };
        upsert.run({
          id: record.id,
          file_path: record.filePath,
          file_name: record.fileName,
          extension: record.extension,
          module_id: record.moduleId,
          size_bytes: record.sizeBytes,
          mtime_ms: record.mtimeMs,
          added_at: record.addedAt,
        });
        records.push(record);
      }
    });
    transaction();

    return records;
  }

  listFiles(): DocumentRecord[] {
    const rows = this.db.prepare("SELECT * FROM documents ORDER BY file_name").all() as DocumentRow[];
    return rows.map(rowToRecord);
  }

  getFile(id: string): DocumentRecord | undefined {
    const row = this.db.prepare("SELECT * FROM documents WHERE id = ?").get(id) as DocumentRow | undefined;
    return row ? rowToRecord(row) : undefined;
  }
}
