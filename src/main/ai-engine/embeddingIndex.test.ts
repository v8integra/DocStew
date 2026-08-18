import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../file-manager/db";
import { EmbeddingIndex } from "./embeddingIndex";

/** A tiny deterministic "embedding" for tests: maps each known word to a fixed
 * direction in a small vector space, so semantically related fake documents
 * score higher without needing a real model. */
function fakeEmbed(_model: string, text: string): Promise<Float32Array> {
  const lower = text.toLowerCase();
  const dims = ["cat", "dog", "database", "sql"];
  const vector = dims.map((word) => (lower.includes(word) ? 1 : 0));
  return Promise.resolve(Float32Array.from(vector.length > 0 && vector.some((v) => v > 0) ? vector : [0.1, 0.1, 0.1, 0.1]));
}

function makeIndex() {
  const db = openDatabase(":memory:");
  return new EmbeddingIndex(db, "fake-model", fakeEmbed);
}

test("indexDocument() stores a vector, count() reflects it", async () => {
  const index = makeIndex();
  assert.equal(index.count(), 0);
  await index.indexDocument("doc-1", "I have a pet cat named Whiskers.");
  assert.equal(index.count(), 1);
});

test("indexDocument() with empty text removes rather than stores", async () => {
  const index = makeIndex();
  await index.indexDocument("doc-1", "some content about a dog");
  assert.equal(index.count(), 1);
  await index.indexDocument("doc-1", "   ");
  assert.equal(index.count(), 0);
});

test("indexDocument() upserts — re-indexing the same id doesn't duplicate", async () => {
  const index = makeIndex();
  await index.indexDocument("doc-1", "a cat");
  await index.indexDocument("doc-1", "a different cat description");
  assert.equal(index.count(), 1);
});

test("search() ranks semantically closer documents higher", async () => {
  const index = makeIndex();
  await index.indexDocument("cat-doc", "Notes about my cat's vet visit.");
  await index.indexDocument("dog-doc", "Notes about walking the dog.");
  await index.indexDocument("sql-doc", "How to write a SQL database query.");

  const results = await index.search("Tell me about my cat", 3);

  assert.equal(results[0].documentId, "cat-doc");
  assert.ok(results[0].score > (results.find((r) => r.documentId === "dog-doc")?.score ?? 1));
});

test("search() respects topK", async () => {
  const index = makeIndex();
  await index.indexDocument("a", "cat");
  await index.indexDocument("b", "dog");
  await index.indexDocument("c", "database");

  const results = await index.search("cat", 2);

  assert.equal(results.length, 2);
});

test("removeDocument() deletes a stored vector", async () => {
  const index = makeIndex();
  await index.indexDocument("doc-1", "a cat");
  index.removeDocument("doc-1");
  assert.equal(index.count(), 0);
});
