import { test } from "node:test";
import assert from "node:assert/strict";
import * as path from "path";
import { PluginRegistry } from "./registry";
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

test("register() adds a module and get() retrieves it", () => {
  const registry = new PluginRegistry();
  registry.register(fakeModule("notes", [".md"]));
  assert.equal(registry.get("notes")?.id, "notes");
});

test("register() rejects a duplicate id", () => {
  const registry = new PluginRegistry();
  registry.register(fakeModule("notes", [".md"]));
  assert.throws(() => registry.register(fakeModule("notes", [".txt"])), /already registered/);
});

test("findByExtension() matches a registered module by file extension", () => {
  const registry = new PluginRegistry();
  registry.register(fakeModule("notes", [".md", ".markdown"]));
  registry.register(fakeModule("pdf", [".pdf"]));
  assert.equal(registry.findByExtension("report.PDF")?.id, "pdf");
  assert.equal(registry.findByExtension("todo.md")?.id, "notes");
  assert.equal(registry.findByExtension("photo.png"), undefined);
});

test("list() returns every registered module", () => {
  const registry = new PluginRegistry();
  registry.register(fakeModule("a", []));
  registry.register(fakeModule("b", []));
  assert.deepEqual(
    registry.list().map((m) => m.id).sort(),
    ["a", "b"]
  );
});

test("loadFromDirectory() discovers and registers the real compiled dummy module", () => {
  const registry = new PluginRegistry();
  const modulesDir = path.join(__dirname, "../../../modules");
  const loaded = registry.loadFromDirectory(modulesDir);
  assert.ok(loaded.includes("dummy"), `expected "dummy" among loaded modules, got: ${loaded.join(", ")}`);
  const dummy = registry.get("dummy");
  assert.ok(dummy);
  assert.deepEqual(dummy!.supportedExtensions, [".txt", ".dummy"]);
});

test("loadFromDirectory() returns an empty list for a nonexistent directory", () => {
  const registry = new PluginRegistry();
  const loaded = registry.loadFromDirectory(path.join(__dirname, "does-not-exist"));
  assert.deepEqual(loaded, []);
});
