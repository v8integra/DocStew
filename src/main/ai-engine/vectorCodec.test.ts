import { test } from "node:test";
import assert from "node:assert/strict";
import { vectorToBuffer, bufferToVector, cosineSimilarity } from "./vectorCodec";

test("vectorToBuffer/bufferToVector round-trip preserves values", () => {
  const original = Float32Array.from([0.1, -0.5, 3.25, 0, -1234.5]);
  const buf = vectorToBuffer(original);
  const restored = bufferToVector(buf);
  assert.equal(restored.length, original.length);
  for (let i = 0; i < original.length; i++) {
    assert.ok(Math.abs(restored[i] - original[i]) < 1e-6, `index ${i}: ${restored[i]} !== ${original[i]}`);
  }
});

test("bufferToVector works on a misaligned sub-buffer (not just offset 0)", () => {
  const original = Float32Array.from([1, 2, 3, 4]);
  const inner = vectorToBuffer(original);
  // Simulate a Buffer that's a view into a larger pooled ArrayBuffer at a
  // non-4-byte-aligned offset — the exact scenario vectorToBuffer/bufferToVector
  // must survive, since better-sqlite3's BLOB reads aren't guaranteed aligned.
  const padded = Buffer.alloc(inner.length + 3);
  inner.copy(padded, 3);
  const sub = padded.subarray(3);
  const restored = bufferToVector(sub);
  assert.deepEqual(Array.from(restored), Array.from(original));
});

test("cosineSimilarity is 1 for identical vectors", () => {
  const v = Float32Array.from([1, 2, 3]);
  assert.ok(Math.abs(cosineSimilarity(v, v) - 1) < 1e-6);
});

test("cosineSimilarity is 0 for orthogonal vectors", () => {
  const a = Float32Array.from([1, 0]);
  const b = Float32Array.from([0, 1]);
  assert.ok(Math.abs(cosineSimilarity(a, b)) < 1e-6);
});

test("cosineSimilarity is -1 for opposite vectors", () => {
  const a = Float32Array.from([1, 2, 3]);
  const b = Float32Array.from([-1, -2, -3]);
  assert.ok(Math.abs(cosineSimilarity(a, b) + 1) < 1e-6);
});

test("cosineSimilarity handles a zero vector without dividing by zero", () => {
  const a = Float32Array.from([0, 0, 0]);
  const b = Float32Array.from([1, 2, 3]);
  assert.equal(cosineSimilarity(a, b), 0);
});
