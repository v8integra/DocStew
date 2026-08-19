import type BetterSqlite3 from "better-sqlite3";
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

const SKIPPED_DIRECTORY_NAMES = new Set(["node_modules"]);

function shouldSkipDirectory(name: string): boolean {
  return name.startsWith(".") || SKIPPED_DIRECTORY_NAMES.has(name);
}

/** Walks a folder recursively, yielding every regular file's full path.
 * Skips dotfolders/node_modules and doesn't follow symlinked directories
 * (fs.Dirent.isDirectory() is false for a symlink, so they're naturally excluded). */
function* walkFiles(rootDir: string): Generator<string> {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (shouldSkipDirectory(entry.name)) continue;
      yield* walkFiles(path.join(rootDir, entry.name));
    } else if (entry.isFile()) {
      yield path.join(rootDir, entry.name);
    }
  }
}

/** A folder "contains" a path if the path equals the folder or sits under it
 * — comparing with a trailing separator avoids a bare string-prefix match
 * wrongly treating sibling folders that share a prefix (e.g. "Notes" vs
 * "Notes2") as nested. */
function isUnderFolder(filePath: string, folderPath: string): boolean {
  const withSep = folderPath.endsWith(path.sep) ? folderPath : folderPath + path.sep;
  return filePath === folderPath || filePath.startsWith(withSep);
}

/**
 * The File/Library Manager (docstew-plan.md §4): tracks which folders the
 * user has opened, indexes the files in them (recursively) into SQLite, and
 * resolves each file to the module (if any) that can handle it via the
 * Plugin Registry. The library can span multiple opened folders at once —
 * `listOpenFolders()`/`closeFolder()` let the UI show which folders are
 * currently contributing to it and remove one without touching the others.
 */
export class LibraryManager {
  private upsertStmt: BetterSqlite3.Statement<Record<string, unknown>>;
  private getStmt: BetterSqlite3.Statement<[string]>;
  private listStmt: BetterSqlite3.Statement<[]>;
  private addOpenFolderStmt: BetterSqlite3.Statement<Record<string, unknown>>;
  private removeOpenFolderStmt: BetterSqlite3.Statement<[string]>;
  private listOpenFoldersStmt: BetterSqlite3.Statement<[]>;

  constructor(private db: BetterSqlite3.Database, private registry: PluginRegistry) {
    this.upsertStmt = this.db.prepare(`
      INSERT INTO documents (id, file_path, file_name, extension, module_id, size_bytes, mtime_ms, added_at)
      VALUES (@id, @file_path, @file_name, @extension, @module_id, @size_bytes, @mtime_ms, @added_at)
      ON CONFLICT(file_path) DO UPDATE SET
        module_id = excluded.module_id,
        size_bytes = excluded.size_bytes,
        mtime_ms = excluded.mtime_ms
    `);
    this.getStmt = this.db.prepare("SELECT * FROM documents WHERE id = ?");
    this.listStmt = this.db.prepare("SELECT * FROM documents ORDER BY file_name");
    this.addOpenFolderStmt = this.db.prepare(`
      INSERT INTO open_folders (path, opened_at) VALUES (@path, @opened_at)
      ON CONFLICT(path) DO UPDATE SET opened_at = excluded.opened_at
    `);
    this.removeOpenFolderStmt = this.db.prepare("DELETE FROM open_folders WHERE path = ?");
    this.listOpenFoldersStmt = this.db.prepare("SELECT path FROM open_folders ORDER BY opened_at");
  }

  /** Indexes (or re-indexes) a single file's metadata. Used both by openFolder()'s
   * scan and by flows like note-creation that add one new file at a time. */
  indexFile(filePath: string): DocumentRecord {
    const stat = fs.statSync(filePath);
    const moduleId = this.registry.findByExtension(filePath)?.id ?? null;
    const record: DocumentRecord = {
      id: crypto.createHash("sha1").update(filePath).digest("hex"),
      filePath,
      fileName: path.basename(filePath),
      extension: path.extname(filePath).toLowerCase(),
      moduleId,
      sizeBytes: stat.size,
      mtimeMs: stat.mtimeMs,
      addedAt: Date.now(),
    };
    this.upsertStmt.run({
      id: record.id,
      file_path: record.filePath,
      file_name: record.fileName,
      extension: record.extension,
      module_id: record.moduleId,
      size_bytes: record.sizeBytes,
      mtime_ms: record.mtimeMs,
      added_at: record.addedAt,
    });
    return record;
  }

  /** Recursively scans a folder and upserts every file's metadata, and marks
   * the folder as "open" so the library remembers it contributed these files
   * (until closeFolder() says otherwise). Calling this again on an
   * already-open folder just rescans it. */
  openFolder(folderPath: string): DocumentRecord[] {
    const records: DocumentRecord[] = [];
    const transaction = this.db.transaction(() => {
      this.addOpenFolderStmt.run({ path: folderPath, opened_at: Date.now() });
      for (const filePath of walkFiles(folderPath)) {
        records.push(this.indexFile(filePath));
      }
    });
    transaction();
    return records;
  }

  /** Removes a folder from the library: forgets it was ever opened and
   * prunes every document indexed from under it. Returns the removed
   * records so the caller can also clean them out of the full-text/embedding/
   * version-history indexes, which LibraryManager doesn't own. Files on disk
   * are never touched — this only affects the library's index of them. */
  closeFolder(folderPath: string): DocumentRecord[] {
    const removed: DocumentRecord[] = [];
    const transaction = this.db.transaction(() => {
      const all = this.listStmt.all() as DocumentRow[];
      for (const row of all) {
        if (isUnderFolder(row.file_path, folderPath)) {
          removed.push(rowToRecord(row));
        }
      }
      const deleteStmt = this.db.prepare("DELETE FROM documents WHERE id = ?");
      for (const record of removed) deleteStmt.run(record.id);
      this.removeOpenFolderStmt.run(folderPath);
    });
    transaction();
    return removed;
  }

  listOpenFolders(): string[] {
    return (this.listOpenFoldersStmt.all() as Array<{ path: string }>).map((row) => row.path);
  }

  listFiles(): DocumentRecord[] {
    return (this.listStmt.all() as DocumentRow[]).map(rowToRecord);
  }

  getFile(id: string): DocumentRecord | undefined {
    const row = this.getStmt.get(id) as DocumentRow | undefined;
    return row ? rowToRecord(row) : undefined;
  }
}
