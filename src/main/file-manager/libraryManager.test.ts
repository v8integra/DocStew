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

test("openFolder() tracks the folder as open", () => {
  const dir = makeTempFolder();
  const registry = new PluginRegistry();
  const library = new LibraryManager(openDatabase(":memory:"), registry);

  library.openFolder(dir);

  assert.deepEqual(library.listOpenFolders(), [dir]);
});

test("openFolder() on multiple folders tracks each and merges their files into one library", () => {
  const dirA = makeTempFolder();
  const dirB = makeTempFolder();
  const registry = new PluginRegistry();
  const library = new LibraryManager(openDatabase(":memory:"), registry);

  library.openFolder(dirA);
  library.openFolder(dirB);

  assert.deepEqual(library.listOpenFolders().sort(), [dirA, dirB].sort());
  assert.equal(library.listFiles().length, 4);
});

test("closeFolder() removes only that folder's files and un-tracks it", () => {
  const dirA = makeTempFolder();
  const dirB = makeTempFolder();
  const registry = new PluginRegistry();
  const library = new LibraryManager(openDatabase(":memory:"), registry);
  library.openFolder(dirA);
  library.openFolder(dirB);

  const removed = library.closeFolder(dirA);

  assert.equal(removed.length, 2);
  assert.ok(removed.every((r) => r.filePath.startsWith(dirA)));
  assert.deepEqual(library.listOpenFolders(), [dirB]);
  assert.equal(library.listFiles().length, 2);
  assert.ok(library.listFiles().every((r) => r.filePath.startsWith(dirB)));
});

test("closeFolder() doesn't remove a sibling folder that merely shares a name prefix", () => {
  const dir = makeTempFolder();
  const siblingDir = `${dir}2`;
  fs.mkdirSync(siblingDir);
  fs.writeFileSync(path.join(siblingDir, "other.txt"), "unrelated");
  const registry = new PluginRegistry();
  const library = new LibraryManager(openDatabase(":memory:"), registry);
  library.openFolder(dir);
  library.openFolder(siblingDir);

  library.closeFolder(dir);

  assert.deepEqual(library.listOpenFolders(), [siblingDir]);
  assert.deepEqual(library.listFiles().map((f) => f.fileName), ["other.txt"]);
});

test("closeFolder() on a folder that was never opened is a harmless no-op", () => {
  const dir = makeTempFolder();
  const registry = new PluginRegistry();
  const library = new LibraryManager(openDatabase(":memory:"), registry);
  library.openFolder(dir);

  const removed = library.closeFolder(path.join(os.tmpdir(), "never-opened"));

  assert.deepEqual(removed, []);
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
