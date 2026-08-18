import { test } from "node:test";
import assert from "node:assert/strict";
import wordModule from "./index";
import type { WordRenderData } from "./index";
import { makeTestDocx } from "./testFixtures/makeTestDocx";
import { setModels } from "../../src/main/ai-engine/config";
import { withFakeOllamaServer, fakeChatHandler } from "../../src/main/ai-engine/testFixtures/fakeOllamaServer";

test("open() returns a handle carrying the word module id", async () => {
  const filePath = await makeTestDocx({ title: "T" });
  const handle = await wordModule.open(filePath);
  assert.equal(handle.moduleId, "word");
});

test("render() converts the real document to HTML with no warnings for a simple doc", async () => {
  const filePath = await makeTestDocx({ title: "My Doc", paragraphs: ["Hello."] });
  const handle = await wordModule.open(filePath);
  const rendered = await wordModule.render(handle);
  const data = rendered.data as WordRenderData;
  assert.equal(rendered.kind, "word");
  assert.match(data.html, /<h1>My Doc<\/h1>/);
  assert.deepEqual(data.warnings, []);
});

test("save() writes real edited content back as a valid .docx", async () => {
  const filePath = await makeTestDocx({ title: "Original" });
  const handle = await wordModule.open(filePath);

  await wordModule.save(handle, {
    blocks: [
      { type: "heading", level: 1, runs: [{ text: "Edited Title" }] },
      { type: "paragraph", runs: [{ text: "New content." }] },
    ],
  });

  const reRendered = await wordModule.render(handle);
  const data = reRendered.data as WordRenderData;
  assert.match(data.html, /<h1>Edited Title<\/h1>/);
  assert.match(data.html, /New content\./);
});

test("export() to txt returns real extracted text", async () => {
  const filePath = await makeTestDocx({ title: "T", paragraphs: ["exportable body text"] });
  const handle = await wordModule.open(filePath);
  const buf = await wordModule.export(handle, "txt");
  assert.match(buf.toString("utf-8"), /exportable body text/);
});

test("export() to md returns real markdown", async () => {
  const filePath = await makeTestDocx({ title: "My Title", paragraphs: ["Some text."] });
  const handle = await wordModule.open(filePath);
  const buf = await wordModule.export(handle, "md");
  const markdown = buf.toString("utf-8");
  assert.match(markdown, /My Title/);
  assert.match(markdown, /Some text\./);
});

test("export() to docx returns the raw file bytes", async () => {
  const filePath = await makeTestDocx({ title: "T" });
  const handle = await wordModule.open(filePath);
  const buf = await wordModule.export(handle, "docx");
  assert.deepEqual(buf, await (await import("fs")).promises.readFile(filePath));
});

test("export() rejects an unsupported format", async () => {
  const filePath = await makeTestDocx({ title: "T" });
  const handle = await wordModule.open(filePath);
  await assert.rejects(() => Promise.resolve(wordModule.export(handle, "epub")), /cannot export/);
});

test("index() returns real extracted text for search", async () => {
  const filePath = await makeTestDocx({ title: "T", paragraphs: ["needle in a haystack"] });
  const handle = await wordModule.open(filePath);
  const indexed = await wordModule.index(handle);
  assert.match(indexed.text, /needle in a haystack/);
});

test("peek() derives a title from the first non-empty line of real text", async () => {
  const filePath = await makeTestDocx({ title: "The Real Title", paragraphs: ["body"] });
  const info = await wordModule.peek!(filePath);
  assert.equal(info.title, "The Real Title");
});

test("summarize aiTool calls the configured chat model", async () => {
  const filePath = await makeTestDocx({ title: "T", paragraphs: ["Long document body about sales."] });
  const handle = await wordModule.open(filePath);
  const tool = wordModule.aiTools.find((t) => t.name === "summarize")!;

  await withFakeOllamaServer(fakeChatHandler("A summary."), async () => {
    setModels({ chatModel: "fake-model" });
    const result = (await tool.handler(handle, {})) as { summary: string };
    assert.equal(result.summary, "A summary.");
  });
  setModels({});
});

test("rewrite aiTool uses a default instruction when none is given", async () => {
  const filePath = await makeTestDocx({ title: "T", paragraphs: ["Some text to rewrite."] });
  const handle = await wordModule.open(filePath);
  const tool = wordModule.aiTools.find((t) => t.name === "rewrite")!;

  let capturedSystemPrompt = "";
  await withFakeOllamaServer(
    (req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        capturedSystemPrompt = JSON.parse(body).messages[0].content;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ message: { role: "assistant", content: "Rewritten text." } }));
      });
    },
    async () => {
      setModels({ chatModel: "fake-model" });
      const result = (await tool.handler(handle, {})) as { rewritten: string };
      assert.equal(result.rewritten, "Rewritten text.");
    }
  );
  assert.match(capturedSystemPrompt, /Improve clarity and flow/);
  setModels({});
});

test("toneAdjust aiTool requires a tone", async () => {
  const filePath = await makeTestDocx({ title: "T", paragraphs: ["text"] });
  const handle = await wordModule.open(filePath);
  const tool = wordModule.aiTools.find((t) => t.name === "toneAdjust")!;
  setModels({ chatModel: "fake-model" });
  await assert.rejects(() => tool.handler(handle, {}), /target tone is required/);
  setModels({});
});

test("toneAdjust aiTool rewrites using the given tone", async () => {
  const filePath = await makeTestDocx({ title: "T", paragraphs: ["Hey what's up, quick update on the project."] });
  const handle = await wordModule.open(filePath);
  const tool = wordModule.aiTools.find((t) => t.name === "toneAdjust")!;

  await withFakeOllamaServer(fakeChatHandler("A formal update regarding the project."), async () => {
    setModels({ chatModel: "fake-model" });
    const result = (await tool.handler(handle, { tone: "formal" })) as { rewritten: string };
    assert.equal(result.rewritten, "A formal update regarding the project.");
  });
  setModels({});
});

test("translate aiTool translates the extracted document text", async () => {
  const filePath = await makeTestDocx({ title: "T", paragraphs: ["Hello world"] });
  const handle = await wordModule.open(filePath);
  const tool = wordModule.aiTools.find((t) => t.name === "translate")!;

  await withFakeOllamaServer(fakeChatHandler("Hola mundo"), async () => {
    setModels({ chatModel: "fake-model" });
    const result = (await tool.handler(handle, { targetLanguage: "es" })) as {
      translated: string;
      targetLanguage: string;
    };
    assert.equal(result.translated, "Hola mundo");
    assert.equal(result.targetLanguage, "Spanish");
  });
  setModels({});
});

test("aiTools refuse with a clear error when no chat model is configured", async () => {
  const filePath = await makeTestDocx({ title: "T" });
  const handle = await wordModule.open(filePath);
  setModels({});
  const summarize = wordModule.aiTools.find((t) => t.name === "summarize")!;
  await assert.rejects(() => summarize.handler(handle, {}), /No local chat model is available/);
});
