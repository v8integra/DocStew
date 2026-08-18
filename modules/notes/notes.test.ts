import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import notesModule from "./index";
import type { NotesRenderData } from "./index";
import { setModels } from "../../src/main/ai-engine/config";
import { withFakeOllamaServer, fakeChatHandler } from "../../src/main/ai-engine/testFixtures/fakeOllamaServer";

function tempNotePath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "docstew-notes-test-"));
  return path.join(dir, "my-note.md");
}

test("create() writes a blank note with a title derived from the filename", () => {
  const filePath = tempNotePath();
  notesModule.create!(filePath);
  assert.ok(fs.existsSync(filePath));
  const raw = fs.readFileSync(filePath, "utf-8");
  assert.match(raw, /title: my-note/);
});

test("create() refuses to overwrite an existing note", () => {
  const filePath = tempNotePath();
  notesModule.create!(filePath);
  assert.throws(() => notesModule.create!(filePath), /already exists/);
});

test("render() parses frontmatter and renders the body to HTML", async () => {
  const filePath = tempNotePath();
  fs.writeFileSync(filePath, "---\ntitle: My Note\ntags: [a, b]\n---\n# Heading\n\nSome *text*.");
  const handle = await notesModule.open(filePath);
  const rendered = await notesModule.render(handle);
  const data = rendered.data as NotesRenderData;
  assert.equal(rendered.kind, "notes");
  assert.equal(data.title, "My Note");
  assert.deepEqual(data.tags, ["a", "b"]);
  assert.match(data.html, /<h1>Heading<\/h1>/);
  assert.match(data.html, /<em>text<\/em>/);
});

test("render() escapes raw HTML embedded in the note body instead of passing it through", async () => {
  const filePath = tempNotePath();
  fs.writeFileSync(filePath, "---\ntitle: Untrusted\ntags: []\n---\n<img src=x onerror=\"alert(1)\">");
  const handle = await notesModule.open(filePath);
  const rendered = await notesModule.render(handle);
  const data = rendered.data as NotesRenderData;
  // The literal text "onerror=" legitimately still appears (as inert text) —
  // what matters is that the surrounding <, >, and " are escaped so it can
  // never be parsed back into a live attribute when injected via innerHTML.
  assert.ok(!/<img[^&]/.test(data.html), "a real <img> tag must not pass through unescaped");
  assert.match(data.html, /&lt;img/);
  assert.match(data.html, /&quot;alert\(1\)&quot;/);
});

test("save() round-trips edited content back to disk", async () => {
  const filePath = tempNotePath();
  notesModule.create!(filePath);
  const handle = await notesModule.open(filePath);
  await notesModule.save(handle, { title: "Renamed", tags: ["x"], body: "new body" });

  const reRendered = await notesModule.render(handle);
  const data = reRendered.data as NotesRenderData;
  assert.equal(data.title, "Renamed");
  assert.deepEqual(data.tags, ["x"]);
  assert.match(data.html, /new body/);
});

test("export() to txt returns the raw body", async () => {
  const filePath = tempNotePath();
  fs.writeFileSync(filePath, "---\ntitle: T\ntags: []\n---\nplain body text");
  const handle = await notesModule.open(filePath);
  const buf = await notesModule.export(handle, "txt");
  assert.equal(buf.toString("utf-8"), "plain body text");
});

test("export() to html wraps rendered markdown in a document", async () => {
  const filePath = tempNotePath();
  fs.writeFileSync(filePath, "---\ntitle: T\ntags: []\n---\n# Hi");
  const handle = await notesModule.open(filePath);
  const buf = await notesModule.export(handle, "html");
  assert.match(buf.toString("utf-8"), /<h1>Hi<\/h1>/);
});

test("export() rejects an unsupported format", async () => {
  const filePath = tempNotePath();
  fs.writeFileSync(filePath, "---\ntitle: T\ntags: []\n---\nbody");
  const handle = await notesModule.open(filePath);
  await assert.rejects(() => Promise.resolve(notesModule.export(handle, "docx")), /cannot export/);
});

test("index() includes title, tags, and body for full-text search", async () => {
  const filePath = tempNotePath();
  fs.writeFileSync(filePath, "---\ntitle: Searchable\ntags: [findme]\n---\nneedle in a haystack");
  const handle = await notesModule.open(filePath);
  const indexed = await notesModule.index(handle);
  assert.match(indexed.text, /Searchable/);
  assert.match(indexed.text, /findme/);
  assert.match(indexed.text, /needle in a haystack/);
});

test("peek() returns title and tags without a full render", async () => {
  const filePath = tempNotePath();
  fs.writeFileSync(filePath, "---\ntitle: Peekable\ntags: [quick]\n---\nbody");
  const info = await notesModule.peek!(filePath);
  assert.equal(info.title, "Peekable");
  assert.deepEqual(info.tags, ["quick"]);
});

test("summarize tool calls the configured chat model and returns its summary", async () => {
  const filePath = tempNotePath();
  fs.writeFileSync(filePath, "---\ntitle: Long\ntags: []\n---\nA very long note body about many things.");
  const handle = await notesModule.open(filePath);
  const summarizeTool = notesModule.aiTools.find((t) => t.name === "summarize")!;

  await withFakeOllamaServer(fakeChatHandler("A concise summary."), async () => {
    setModels({ chatModel: "fake-model" });
    const result = (await summarizeTool.handler(handle, {})) as { summary: string };
    assert.equal(result.summary, "A concise summary.");
  });
  setModels({});
});

test("summarize tool refuses with a clear error when no chat model is configured", async () => {
  const filePath = tempNotePath();
  fs.writeFileSync(filePath, "---\ntitle: T\ntags: []\n---\nsome body text");
  const handle = await notesModule.open(filePath);
  const summarizeTool = notesModule.aiTools.find((t) => t.name === "summarize")!;

  setModels({});
  await assert.rejects(() => summarizeTool.handler(handle, {}), /No local chat model is available/);
});

test("summarize tool short-circuits for an empty note without calling the model", async () => {
  const filePath = tempNotePath();
  fs.writeFileSync(filePath, "---\ntitle: Empty\ntags: []\n---\n");
  const handle = await notesModule.open(filePath);
  const summarizeTool = notesModule.aiTools.find((t) => t.name === "summarize")!;

  setModels({ chatModel: "fake-model" });
  const result = (await summarizeTool.handler(handle, {})) as { summary: string };
  assert.match(result.summary, /nothing to summarize/);
  setModels({});
});
