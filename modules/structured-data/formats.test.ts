import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectFormat,
  parseStructuredText,
  stringifyPretty,
  stringifyMinified,
  toCsvBuffer,
} from "./formats";

test("detectFormat() maps extensions to formats", () => {
  assert.equal(detectFormat("a/b.json"), "json");
  assert.equal(detectFormat("a/b.xml"), "xml");
  assert.equal(detectFormat("a/b.yaml"), "yaml");
  assert.equal(detectFormat("a/b.yml"), "yaml");
});

test("detectFormat() rejects an unrecognized extension", () => {
  assert.throws(() => detectFormat("a/b.txt"), /Unrecognized/);
});

test("parseStructuredText() parses real JSON", () => {
  const value = parseStructuredText('{"a": 1, "b": [2, 3]}', "json");
  assert.deepEqual(value, { a: 1, b: [2, 3] });
});

test("parseStructuredText() parses real YAML", () => {
  const value = parseStructuredText("a: 1\nb:\n  - 2\n  - 3\n", "yaml");
  assert.deepEqual(value, { a: 1, b: [2, 3] });
});

test("parseStructuredText() parses real XML including attributes", () => {
  const value = parseStructuredText('<root id="5"><name>Hi</name></root>', "xml") as {
    root: { "@_id": string; name: string };
  };
  assert.equal(value.root["@_id"], "5");
  assert.equal(value.root.name, "Hi");
});

test("parseStructuredText() throws on real malformed JSON", () => {
  assert.throws(() => parseStructuredText("{not valid json", "json"));
});

test("stringifyPretty() JSON round-trips and is human-readable", () => {
  const pretty = stringifyPretty({ a: 1, b: 2 }, "json");
  assert.match(pretty, /\n {2}"a": 1/);
  assert.deepEqual(JSON.parse(pretty), { a: 1, b: 2 });
});

test("stringifyPretty() YAML round-trips", () => {
  const pretty = stringifyPretty({ a: 1, b: [2, 3] }, "yaml");
  const reparsed = parseStructuredText(pretty, "yaml");
  assert.deepEqual(reparsed, { a: 1, b: [2, 3] });
});

test("stringifyPretty() XML round-trips", () => {
  const value = parseStructuredText('<root id="5"><name>Hi</name></root>', "xml");
  const pretty = stringifyPretty(value, "xml");
  const reparsed = parseStructuredText(pretty, "xml");
  assert.deepEqual(reparsed, value);
});

test("stringifyMinified() JSON has no extra whitespace", () => {
  assert.equal(stringifyMinified({ a: 1, b: 2 }, "json"), '{"a":1,"b":2}');
});

test("toCsvBuffer() converts a real array of flat records to CSV", async () => {
  const buf = await toCsvBuffer([
    { name: "Alice", age: 30 },
    { name: "Bob", age: 25 },
  ]);
  const text = buf.toString("utf-8");
  assert.match(text, /name,age/);
  assert.match(text, /Alice,30/);
  assert.match(text, /Bob,25/);
});

test("toCsvBuffer() rejects data that isn't an array of records", async () => {
  await assert.rejects(() => toCsvBuffer({ a: 1 }), /array of objects/);
  await assert.rejects(() => toCsvBuffer([1, 2, 3]), /array of objects/);
});
