import { test } from "node:test";
import assert from "node:assert/strict";
import { translateText } from "./translationService";
import { setModels } from "../ai-engine/config";
import { withFakeOllamaServer, fakeChatHandler } from "../ai-engine/testFixtures/fakeOllamaServer";

test("translateText() calls the configured chat model and returns the translation", async () => {
  await withFakeOllamaServer(fakeChatHandler("Hola mundo"), async () => {
    setModels({ chatModel: "fake-model" });
    const result = await translateText("Hello world", "es");
    assert.equal(result.translated, "Hola mundo");
    assert.equal(result.original, "Hello world");
    assert.equal(result.targetLanguage, "Spanish");
  });
  setModels({});
});

test("translateText() resolves a known language code to its name in the prompt", async () => {
  let capturedSystemPrompt = "";
  await withFakeOllamaServer(
    (req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        capturedSystemPrompt = JSON.parse(body).messages[0].content;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ message: { role: "assistant", content: "translated" } }));
      });
    },
    async () => {
      setModels({ chatModel: "fake-model" });
      await translateText("hello", "fr");
    }
  );
  assert.match(capturedSystemPrompt, /French/);
  setModels({});
});

test("translateText() passes through an unrecognized language string as-is", async () => {
  let capturedSystemPrompt = "";
  await withFakeOllamaServer(
    (req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        capturedSystemPrompt = JSON.parse(body).messages[0].content;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ message: { role: "assistant", content: "translated" } }));
      });
    },
    async () => {
      setModels({ chatModel: "fake-model" });
      await translateText("hello", "Klingon");
    }
  );
  assert.match(capturedSystemPrompt, /Klingon/);
  setModels({});
});

test("translateText() includes the source language when given", async () => {
  let capturedSystemPrompt = "";
  await withFakeOllamaServer(
    (req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        capturedSystemPrompt = JSON.parse(body).messages[0].content;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ message: { role: "assistant", content: "translated" } }));
      });
    },
    async () => {
      setModels({ chatModel: "fake-model" });
      await translateText("hello", "es", "en");
    }
  );
  assert.match(capturedSystemPrompt, /from English to Spanish/);
  setModels({});
});

test("translateText() short-circuits for empty text without calling the model", async () => {
  setModels({ chatModel: "fake-model" });
  const result = await translateText("   ", "es");
  assert.equal(result.translated, "");
  setModels({});
});

test("translateText() rejects an empty target language", async () => {
  setModels({ chatModel: "fake-model" });
  await assert.rejects(() => translateText("hello", "  "), /target language is required/);
  setModels({});
});

test("translateText() refuses with a clear error when no chat model is configured", async () => {
  setModels({});
  await assert.rejects(() => translateText("hello", "es"), /No local chat model is available/);
});
