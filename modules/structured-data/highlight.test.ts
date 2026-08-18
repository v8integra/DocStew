import { test } from "node:test";
import assert from "node:assert/strict";
import { highlightStructuredText } from "./highlight";

test("highlightStructuredText() wraps JSON keys, strings, numbers, and booleans", () => {
  const html = highlightStructuredText('{"name": "Alice", "age": 30, "active": true}', "json");
  assert.match(html, /<span class="sd-key">&quot;name&quot;:<\/span>/);
  assert.match(html, /<span class="sd-string">&quot;Alice&quot;<\/span>/);
  assert.match(html, /<span class="sd-number">30<\/span>/);
  assert.match(html, /<span class="sd-boolean">true<\/span>/);
});

test("highlightStructuredText() escapes embedded HTML-like content instead of passing it through", () => {
  const html = highlightStructuredText('{"note": "<img src=x onerror=alert(1)>"}', "json");
  assert.ok(!/<img[^&]/.test(html), "a real <img> tag must not pass through unescaped");
  assert.match(html, /&lt;img/);
});

test("highlightStructuredText() wraps XML tags", () => {
  const html = highlightStructuredText('<root id="5"><name>Hi</name></root>', "xml");
  assert.match(html, /<span class="sd-tag">/);
  assert.match(html, /<span class="sd-string">5<\/span>/);
});

test("highlightStructuredText() wraps YAML keys and comments", () => {
  const html = highlightStructuredText("# a comment\nname: Alice\n", "yaml");
  assert.match(html, /<span class="sd-comment"># a comment<\/span>/);
  assert.match(html, /<span class="sd-key">name<\/span>/);
});
