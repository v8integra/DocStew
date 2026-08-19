import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { openDatabase } from "./db";
import { VersionHistory } from "./versionHistory";

function tempFile(content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "docstew-version-test-"));
  const filePath = path.join(dir, "file.txt");
  fs.writeFileSync(filePath, content);
  return filePath;
}

function makeHistory(): VersionHistory {
  return new VersionHistory(openDatabase(":memory:"));
}

test("snapshot() captures the file's current real content", () => {
  const history = makeHistory();
  const filePath = tempFile("version one");
  history.snapshot("doc1", filePath);

  const versions = history.list("doc1");
  assert.equal(versions.length, 1);
  assert.equal(versions[0].sizeBytes, "version one".length);
});

test("snapshot() on a file that doesn't exist yet is a safe no-op", () => {
  const history = makeHistory();
  history.snapshot("doc1", "C:\\nonexistent\\path\\file.txt");
  assert.deepEqual(history.list("doc1"), []);
});

test("list() returns versions newest first", () => {
  const history = makeHistory();
  const filePath = tempFile("v1");
  history.snapshot("doc1", filePath);
  fs.writeFileSync(filePath, "v2");
  history.snapshot("doc1", filePath);
  fs.writeFileSync(filePath, "v3");
  history.snapshot("doc1", filePath);

  const versions = history.list("doc1");
  assert.equal(versions.length, 3);
  assert.ok(versions[0].createdAt >= versions[1].createdAt);
  assert.ok(versions[1].createdAt >= versions[2].createdAt);
});

test("list() only returns versions for the requested document", () => {
  const history = makeHistory();
  const fileA = tempFile("a content");
  const fileB = tempFile("b content");
  history.snapshot("docA", fileA);
  history.snapshot("docB", fileB);

  assert.equal(history.list("docA").length, 1);
  assert.equal(history.list("docB").length, 1);
});

test("snapshot() prunes beyond the retention limit, keeping the most recent", () => {
  const history = makeHistory();
  const filePath = tempFile("v0");
  for (let i = 1; i <= 25; i++) {
    fs.writeFileSync(filePath, `v${i}`);
    history.snapshot("doc1", filePath);
  }
  const versions = history.list("doc1");
  assert.equal(versions.length, 20);
});

test("restore() writes a real past version's content back to disk", () => {
  const history = makeHistory();
  const filePath = tempFile("original content");
  history.snapshot("doc1", filePath);
  fs.writeFileSync(filePath, "changed content");

  const [version] = history.list("doc1");
  history.restore(version.id, filePath);

  assert.equal(fs.readFileSync(filePath, "utf-8"), "original content");
});

test("restore() snapshots the pre-restore state, so it can itself be undone", () => {
  const history = makeHistory();
  const filePath = tempFile("v1");
  history.snapshot("doc1", filePath);
  fs.writeFileSync(filePath, "v2");
  const [v1] = history.list("doc1");

  history.restore(v1.id, filePath);
  assert.equal(fs.readFileSync(filePath, "utf-8"), "v1");

  // The state right before the restore ("v2") should now be a version too.
  const versions = history.list("doc1");
  assert.equal(versions.length, 2);
  const [mostRecent] = versions;
  history.restore(mostRecent.id, filePath);
  assert.equal(fs.readFileSync(filePath, "utf-8"), "v2");
});

test("restore() rejects a version id that doesn't exist", () => {
  const history = makeHistory();
  const filePath = tempFile("content");
  assert.throws(() => history.restore(99999, filePath), /no longer exists/);
});

test("removeDocument() deletes all of a document's real versions", () => {
  const history = makeHistory();
  const filePath = tempFile("v1");
  history.snapshot("doc1", filePath);
  fs.writeFileSync(filePath, "v2");
  history.snapshot("doc1", filePath);

  history.removeDocument("doc1");

  assert.deepEqual(history.list("doc1"), []);
});

test("removeDocument() leaves other documents' versions untouched", () => {
  const history = makeHistory();
  const fileA = tempFile("a");
  const fileB = tempFile("b");
  history.snapshot("docA", fileA);
  history.snapshot("docB", fileB);

  history.removeDocument("docA");

  assert.deepEqual(history.list("docA"), []);
  assert.equal(history.list("docB").length, 1);
});
