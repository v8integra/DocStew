import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { openDatabase } from "./db";
import { LibraryManager } from "./libraryManager";
import { PluginRegistry } from "../plugin-registry/registry";
import type { DocStewModule } from "../../shared/module-contract";

function fakeModule(id: string, extensions: string[]): DocStewModule {
  return {
    id,
    supportedExtensions: extensions,
    open: (filePath) => ({ id: filePath, filePath, moduleId: id }),
    render: () => ({ kind: "test", data: null }),
    save: () => {},
    export: () => Buffer.from(""),
    index: (handle) => ({ documentId: handle.id, text: "" }),
    aiTools: [],
  };
}

function makeTempFolder(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "docstew-test-"));
  fs.writeFileSync(path.join(dir, "notes.txt"), "hello world");
  fs.writeFileSync(path.join(dir, "report.pdf"), "%PDF-fake");
  fs.mkdirSync(path.join(dir, "a-subfolder"));
  return dir;
}

test("openFolder() indexes top-level files and resolves module ids by extension", () => {
  const dir = makeTempFolder();
  const registry = new PluginRegistry();
  registry.register(fakeModule("dummy", [".txt"]));
  const library = new LibraryManager(openDatabase(":memory:"), registry);

  const records = library.openFolder(dir);

  assert.equal(records.length, 2, "the subfolder is empty, so only the two top-level files are indexed");
  const notes = records.find((r) => r.fileName === "notes.txt");
  const report = records.find((r) => r.fileName === "report.pdf");
  assert.equal(notes?.moduleId, "dummy");
  assert.equal(report?.moduleId, null);
  assert.equal(notes?.sizeBytes, "hello world".length);
});

test("openFolder() recurses into nested subfolders", () => {
  const dir = makeTempFolder();
  fs.writeFileSync(path.join(dir, "a-subfolder", "nested.txt"), "deep");
  fs.mkdirSync(path.join(dir, "a-subfolder", "deeper"));
  fs.writeFileSync(path.join(dir, "a-subfolder", "deeper", "deepest.txt"), "deepest");
  const registry = new PluginRegistry();
  const library = new LibraryManager(openDatabase(":memory:"), registry);

  const records = library.openFolder(dir);

  assert.deepEqual(
    records.map((r) => r.fileName).sort(),
    ["deepest.txt", "nested.txt", "notes.txt", "report.pdf"]
  );
});

test("openFolder() skips dotfolders and node_modules", () => {
  const dir = makeTempFolder();
  fs.mkdirSync(path.join(dir, ".git"));
  fs.writeFileSync(path.join(dir, ".git", "config"), "should not be indexed");
  fs.mkdirSync(path.join(dir, "node_modules"));
  fs.writeFileSync(path.join(dir, "node_modules", "pkg.json"), "should not be indexed");
  const registry = new PluginRegistry();
  const library = new LibraryManager(openDatabase(":memory:"), registry);

  const records = library.openFolder(dir);

  assert.deepEqual(records.map((r) => r.fileName).sort(), ["notes.txt", "report.pdf"]);
});

test("indexFile() indexes a single file without a full folder scan", () => {
  const dir = makeTempFolder();
  const newFile = path.join(dir, "fresh.txt");
  fs.writeFileSync(newFile, "brand new");
  const registry = new PluginRegistry();
  registry.register(fakeModule("dummy", [".txt"]));
  const library = new LibraryManager(openDatabase(":memory:"), registry);

  const record = library.indexFile(newFile);

  assert.equal(record.fileName, "fresh.txt");
  assert.equal(record.moduleId, "dummy");
  assert.equal(library.listFiles().length, 1);
});

test("listFiles() returns everything indexed so far", () => {
  const dir = makeTempFolder();
  const registry = new PluginRegistry();
  const library = new LibraryManager(openDatabase(":memory:"), registry);

  library.openFolder(dir);
  const listed = library.listFiles();

  assert.equal(listed.length, 2);
  assert.deepEqual(listed.map((f) => f.fileName).sort(), ["notes.txt", "report.pdf"]);
});

test("openFolder() re-scanning the same folder upserts instead of duplicating", () => {
  const dir = makeTempFolder();
  const registry = new PluginRegistry();
  const library = new LibraryManager(openDatabase(":memory:"), registry);

  library.openFolder(dir);
  library.openFolder(dir);

  assert.equal(library.listFiles().length, 2);
});

test("getFile() retrieves a single record by id", () => {
  const dir = makeTempFolder();
  const registry = new PluginRegistry();
  const library = new LibraryManager(openDatabase(":memory:"), registry);

  const [first] = library.openFolder(dir);
  const fetched = library.getFile(first.id);

  assert.equal(fetched?.filePath, first.filePath);
});
