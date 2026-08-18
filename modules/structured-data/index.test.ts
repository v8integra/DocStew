import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import structuredDataModule from "./index";
import type { StructuredDataRenderData } from "./index";
import { setModels } from "../../src/main/ai-engine/config";
import { withFakeOllamaServer, fakeChatHandler } from "../../src/main/ai-engine/testFixtures/fakeOllamaServer";

function tempPath(fileName: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "docstew-structured-data-test-"));
  return path.join(dir, fileName);
}

test("open() returns a handle carrying the structured-data module id", () => {
  const filePath = tempPath("a.json");
  fs.writeFileSync(filePath, "{}");
  const handle = structuredDataModule.open(filePath);
  assert.equal((handle as { moduleId: string }).moduleId, "structured-data");
});

test("create() writes a blank valid JSON document", () => {
  const filePath = tempPath("new.json");
  structuredDataModule.create!(filePath);
  const raw = fs.readFileSync(filePath, "utf-8");
  assert.doesNotThrow(() => JSON.parse(raw));
});

test("create() refuses to overwrite an existing file", () => {
  const filePath = tempPath("existing.json");
  fs.writeFileSync(filePath, "{}");
  assert.throws(() => structuredDataModule.create!(filePath), /already exists/);
});

test("render() reports a real valid JSON file with highlighted html", async () => {
  const filePath = tempPath("valid.json");
  fs.writeFileSync(filePath, '{"a": 1}');
  const handle = await structuredDataModule.open(filePath);
  const rendered = await structuredDataModule.render(handle);
  const data = rendered.data as StructuredDataRenderData;
  assert.equal(rendered.kind, "structured-data");
  assert.equal(data.format, "json");
  assert.equal(data.valid, true);
  assert.equal(data.error, undefined);
  assert.match(data.html, /<span class="sd-key">/);
});

test("render() reports a real malformed file with an error instead of throwing", async () => {
  const filePath = tempPath("broken.json");
  fs.writeFileSync(filePath, "{not valid json");
  const handle = await structuredDataModule.open(filePath);
  const rendered = await structuredDataModule.render(handle);
  const data = rendered.data as StructuredDataRenderData;
  assert.equal(data.valid, false);
  assert.ok(data.error && data.error.length > 0);
});

test("save() writes the given raw text back to disk verbatim", async () => {
  const filePath = tempPath("edit.json");
  fs.writeFileSync(filePath, "{}");
  const handle = await structuredDataModule.open(filePath);
  await structuredDataModule.save(handle, { raw: '{"edited": true}' });
  assert.equal(fs.readFileSync(filePath, "utf-8"), '{"edited": true}');
});

test("export() to a different format really converts the content", async () => {
  const filePath = tempPath("convert.json");
  fs.writeFileSync(filePath, '{"a": 1}');
  const handle = await structuredDataModule.open(filePath);
  const buf = await structuredDataModule.export(handle, "yaml");
  assert.match(buf.toString("utf-8"), /a: 1/);
});

test("export() to csv converts a real array-of-records JSON file", async () => {
  const filePath = tempPath("records.json");
  fs.writeFileSync(filePath, JSON.stringify([{ x: 1 }, { x: 2 }]));
  const handle = await structuredDataModule.open(filePath);
  const buf = await structuredDataModule.export(handle, "csv");
  assert.match(buf.toString("utf-8"), /x/);
  assert.match(buf.toString("utf-8"), /1/);
});

test("export() to txt returns the raw file bytes unchanged", async () => {
  const filePath = tempPath("raw.json");
  fs.writeFileSync(filePath, '{"a": 1}');
  const handle = await structuredDataModule.open(filePath);
  const buf = await structuredDataModule.export(handle, "txt");
  assert.equal(buf.toString("utf-8"), '{"a": 1}');
});

test("export() rejects an unsupported format", async () => {
  const filePath = tempPath("a.json");
  fs.writeFileSync(filePath, "{}");
  const handle = await structuredDataModule.open(filePath);
  await assert.rejects(() => Promise.resolve(structuredDataModule.export(handle, "docx")), /cannot export/);
});

test("index() returns the raw file text for search", async () => {
  const filePath = tempPath("search.json");
  fs.writeFileSync(filePath, '{"needle": "haystack"}');
  const handle = await structuredDataModule.open(filePath);
  const indexed = await structuredDataModule.index(handle);
  assert.match(indexed.text, /needle/);
  assert.match(indexed.text, /haystack/);
});

test("prettyPrint query reformats real minified JSON", async () => {
  const filePath = tempPath("min.json");
  fs.writeFileSync(filePath, "{}");
  const handle = await structuredDataModule.open(filePath);
  const op = structuredDataModule.queries!.find((o) => o.name === "prettyPrint")!;
  const result = (await op.handler(handle, { raw: '{"a":1,"b":2}' })) as { raw: string };
  assert.match(result.raw, /\n {2}"a": 1/);
});

test("minify query collapses real pretty-printed JSON", async () => {
  const filePath = tempPath("pretty.json");
  fs.writeFileSync(filePath, "{}");
  const handle = await structuredDataModule.open(filePath);
  const op = structuredDataModule.queries!.find((o) => o.name === "minify")!;
  const result = (await op.handler(handle, { raw: '{\n  "a": 1\n}' })) as { raw: string };
  assert.equal(result.raw, '{"a":1}');
});

test("highlight query syntax-highlights the given text regardless of validity", async () => {
  const filePath = tempPath("a.json");
  fs.writeFileSync(filePath, "{}");
  const handle = await structuredDataModule.open(filePath);
  const op = structuredDataModule.queries!.find((o) => o.name === "highlight")!;
  const result = (await op.handler(handle, { raw: '{"a": 1' })) as { html: string };
  assert.match(result.html, /<span class="sd-key">/);
});

test("prettyPrint query rejects real malformed input", async () => {
  const filePath = tempPath("a.json");
  fs.writeFileSync(filePath, "{}");
  const handle = await structuredDataModule.open(filePath);
  const op = structuredDataModule.queries!.find((o) => o.name === "prettyPrint")!;
  await assert.rejects(() => op.handler(handle, { raw: "{not valid" }));
});

test("explainStructure aiTool calls the configured chat model", async () => {
  const filePath = tempPath("explain.json");
  fs.writeFileSync(filePath, '{"users": [{"name": "Alice"}]}');
  const handle = await structuredDataModule.open(filePath);
  const tool = structuredDataModule.aiTools.find((t) => t.name === "explainStructure")!;

  await withFakeOllamaServer(fakeChatHandler("A list of users."), async () => {
    setModels({ chatModel: "fake-model" });
    const result = (await tool.handler(handle, {})) as { explanation: string };
    assert.equal(result.explanation, "A list of users.");
  });
  setModels({});
});

test("explainStructure aiTool short-circuits for an empty file without calling the model", async () => {
  const filePath = tempPath("empty.json");
  fs.writeFileSync(filePath, "");
  const handle = await structuredDataModule.open(filePath);
  const tool = structuredDataModule.aiTools.find((t) => t.name === "explainStructure")!;

  setModels({ chatModel: "fake-model" });
  const result = (await tool.handler(handle, {})) as { explanation: string };
  assert.match(result.explanation, /nothing to explain/);
  setModels({});
});

test("fixMalformed aiTool short-circuits for already-valid content without calling the model", async () => {
  const filePath = tempPath("valid.json");
  fs.writeFileSync(filePath, '{"a": 1}');
  const handle = await structuredDataModule.open(filePath);
  const tool = structuredDataModule.aiTools.find((t) => t.name === "fixMalformed")!;

  setModels({});
  const result = (await tool.handler(handle, {})) as { fixed: string; alreadyValid: boolean };
  assert.equal(result.alreadyValid, true);
  assert.equal(result.fixed, '{"a": 1}');
});

test("fixMalformed aiTool asks the model to repair real malformed content", async () => {
  const filePath = tempPath("broken.json");
  fs.writeFileSync(filePath, '{"a": 1');
  const handle = await structuredDataModule.open(filePath);
  const tool = structuredDataModule.aiTools.find((t) => t.name === "fixMalformed")!;

  await withFakeOllamaServer(fakeChatHandler('{"a": 1}'), async () => {
    setModels({ chatModel: "fake-model" });
    const result = (await tool.handler(handle, {})) as { fixed: string; alreadyValid: boolean };
    assert.equal(result.alreadyValid, false);
    assert.equal(result.fixed, '{"a": 1}');
  });
  setModels({});
});

test("aiTools refuse with a clear error when no chat model is configured", async () => {
  const filePath = tempPath("a.json");
  fs.writeFileSync(filePath, '{"a": 1}');
  const handle = await structuredDataModule.open(filePath);
  setModels({});
  const tool = structuredDataModule.aiTools.find((t) => t.name === "explainStructure")!;
  await assert.rejects(() => tool.handler(handle, {}), /No local chat model is available/);
});
