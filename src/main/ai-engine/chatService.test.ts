import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../file-manager/db";
import { LibraryManager } from "../file-manager/libraryManager";
import { PluginRegistry } from "../plugin-registry/registry";
import { EmbeddingIndex } from "./embeddingIndex";
import { askAboutLibrary } from "./chatService";
import type { ChatMessage } from "./ollamaClient";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

function fakeEmbed(_model: string, _text: string): Promise<Float32Array> {
  return Promise.resolve(Float32Array.from([1, 0]));
}

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "docstew-chat-test-"));
  const filePath = path.join(dir, "cat-notes.md");
  fs.writeFileSync(filePath, "content");
  const db = openDatabase(":memory:");
  const registry = new PluginRegistry();
  const library = new LibraryManager(db, registry);
  const record = library.indexFile(filePath);
  const embeddingIndex = new EmbeddingIndex(db, "fake-model", fakeEmbed);
  return { library, embeddingIndex, record };
}

test("askAboutLibrary() grounds the chat prompt in retrieved excerpts and cites sources", async () => {
  const { library, embeddingIndex, record } = setup();
  await embeddingIndex.indexDocument(record.id, "My cat Whiskers loves tuna.");

  let capturedMessages: ChatMessage[] = [];
  const fakeChat = async (_model: string, messages: ChatMessage[]) => {
    capturedMessages = messages;
    return "Your cat likes tuna. [1]";
  };

  const result = await askAboutLibrary("What does my cat like?", "fake-chat-model", embeddingIndex, library, 5, fakeChat);

  assert.equal(result.answer, "Your cat likes tuna. [1]");
  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0].fileName, "cat-notes.md");
  assert.match(capturedMessages[0].content, /My cat Whiskers loves tuna\./);
  assert.equal(capturedMessages[1].role, "user");
  assert.equal(capturedMessages[1].content, "What does my cat like?");
});

test("askAboutLibrary() tells the model plainly when nothing relevant is indexed", async () => {
  const { library, embeddingIndex } = setup();

  let capturedMessages: ChatMessage[] = [];
  const fakeChat = async (_model: string, messages: ChatMessage[]) => {
    capturedMessages = messages;
    return "I don't have any documents about that.";
  };

  await askAboutLibrary("anything?", "fake-chat-model", embeddingIndex, library, 5, fakeChat);

  assert.match(capturedMessages[0].content, /no relevant documents found/);
});

test("askAboutLibrary() skips a stale embedding whose source file was removed from the library", async () => {
  const { library, embeddingIndex } = setup();
  // Indexed directly, without a corresponding documents row — simulates a
  // library record that was later deleted while its embedding lingered.
  await embeddingIndex.indexDocument("orphan-id", "some orphaned text");

  const fakeChat = async () => "answer";
  const result = await askAboutLibrary("question", "fake-chat-model", embeddingIndex, library, 5, fakeChat);

  assert.equal(result.sources.length, 0);
});
