import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../file-manager/db";
import { FullTextIndex } from "./fullTextIndex";

function makeIndex(): FullTextIndex {
  return new FullTextIndex(openDatabase(":memory:"));
}

test("indexDocument() + search() finds a document by real content", () => {
  const index = makeIndex();
  index.indexDocument("doc1", "recipe.md", "a simple recipe for chocolate cake");
  const results = index.search("chocolate");
  assert.equal(results.length, 1);
  assert.equal(results[0].documentId, "doc1");
});

test("search() finds a document by file name too", () => {
  const index = makeIndex();
  index.indexDocument("doc1", "budget-report.xlsx", "revenue and expenses for the quarter");
  const results = index.search("budget");
  assert.equal(results.length, 1);
});

test("search() ranks documents with more matches higher", () => {
  const index = makeIndex();
  index.indexDocument("rare", "a.md", "mentions apples exactly once");
  index.indexDocument("frequent", "b.md", "apples apples apples apples everywhere apples");
  const results = index.search("apples");
  assert.equal(results[0].documentId, "frequent");
});

test("search() returns an excerpt snippet with the match highlighted", () => {
  const index = makeIndex();
  index.indexDocument("doc1", "notes.md", "the quick brown fox jumps over the lazy dog");
  const results = index.search("fox");
  assert.match(results[0].snippet, /‹fox›/);
});

test("search() sanitizes special characters instead of throwing", () => {
  const index = makeIndex();
  index.indexDocument("doc1", "notes.md", "a test-case about C++ programming");
  assert.doesNotThrow(() => index.search("test-case"));
  assert.doesNotThrow(() => index.search("C++"));
  assert.doesNotThrow(() => index.search("(unbalanced"));
  assert.doesNotThrow(() => index.search('unterminated "quote'));
});

test("search() returns an empty array for a query with no searchable tokens", () => {
  const index = makeIndex();
  index.indexDocument("doc1", "notes.md", "content");
  assert.deepEqual(index.search("   "), []);
  assert.deepEqual(index.search("***"), []);
});

test("search() respects the limit", () => {
  const index = makeIndex();
  for (let i = 0; i < 5; i++) index.indexDocument(`doc${i}`, `file${i}.md`, "shared keyword");
  assert.equal(index.search("shared", 2).length, 2);
});

test("indexDocument() re-indexing the same id replaces rather than duplicates", () => {
  const index = makeIndex();
  index.indexDocument("doc1", "notes.md", "first version");
  index.indexDocument("doc1", "notes.md", "second version");
  const results = index.search("second");
  assert.equal(results.length, 1);
  assert.deepEqual(index.search("first"), []);
});

test("indexDocument() with empty content removes any existing entry", () => {
  const index = makeIndex();
  index.indexDocument("doc1", "notes.md", "some content");
  index.indexDocument("doc1", "", "");
  assert.deepEqual(index.search("content"), []);
});

test("removeDocument() deletes an indexed document", () => {
  const index = makeIndex();
  index.indexDocument("doc1", "notes.md", "findable content");
  index.removeDocument("doc1");
  assert.deepEqual(index.search("findable"), []);
});
