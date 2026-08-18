import { test } from "node:test";
import assert from "node:assert/strict";
import { OllamaUnavailableError, listModels, chat, embed } from "./ollamaClient";
import { withFakeOllamaServer } from "./testFixtures/fakeOllamaServer";

test("listModels() parses the real /api/tags response shape", async () => {
  await withFakeOllamaServer(
    (req, res) => {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ models: [{ name: "llama3.2:3b", size: 123 }] }));
    },
    async () => {
      const models = await listModels();
      assert.deepEqual(models, [{ name: "llama3.2:3b", size: 123 }]);
    }
  );
});

test("chat() returns the message content from /api/chat", async () => {
  await withFakeOllamaServer(
    (req, res) => {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ message: { role: "assistant", content: "hello there" } }));
    },
    async () => {
      const reply = await chat("llama3.2:3b", [{ role: "user", content: "hi" }]);
      assert.equal(reply, "hello there");
    }
  );
});

test("embed() returns a Float32Array from /api/embeddings", async () => {
  await withFakeOllamaServer(
    (req, res) => {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ embedding: [0.1, 0.2, 0.3] }));
    },
    async () => {
      const vector = await embed("nomic-embed-text", "hello");
      assert.ok(vector instanceof Float32Array);
      assert.equal(vector.length, 3);
      assert.ok(Math.abs(vector[1] - 0.2) < 1e-6);
    }
  );
});

test("a non-OK response surfaces a real error with the status code", async () => {
  await withFakeOllamaServer(
    (req, res) => {
      res.statusCode = 500;
      res.end("model not found");
    },
    async () => {
      await assert.rejects(() => listModels(), /failed \(500\)/);
    }
  );
});

test("an unreachable server raises OllamaUnavailableError, not a generic fetch failure", async () => {
  const realFetch = global.fetch;
  global.fetch = (() => Promise.reject(new TypeError("fetch failed"))) as typeof fetch;
  try {
    await assert.rejects(() => listModels(), OllamaUnavailableError);
  } finally {
    global.fetch = realFetch;
  }
});
