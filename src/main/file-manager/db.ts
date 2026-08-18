import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  extension TEXT NOT NULL,
  module_id TEXT,
  size_bytes INTEGER NOT NULL,
  mtime_ms INTEGER NOT NULL,
  added_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_file_path ON documents(file_path);

CREATE TABLE IF NOT EXISTS embeddings (
  document_id TEXT PRIMARY KEY,
  model TEXT NOT NULL,
  vector BLOB NOT NULL,
  text TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Full-text index, independent of the AI engine — works even without Ollama
-- installed. document_id is UNINDEXED (not searched itself, just carried
-- through so results can be joined back to the documents table).
CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
  document_id UNINDEXED,
  file_name,
  text
);
`;

export function openDatabase(dbPath: string): Database.Database {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);
  return db;
}
