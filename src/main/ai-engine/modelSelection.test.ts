import { test } from "node:test";
import assert from "node:assert/strict";
import { selectModels } from "./modelSelection";

test("selectModels() picks a preferred chat model and preferred embed model when both installed", () => {
  const result = selectModels([
    { name: "llama3.2:3b", size: 1 },
    { name: "nomic-embed-text:latest", size: 1 },
  ]);
  assert.equal(result.chatModel, "llama3.2:3b");
  assert.equal(result.embedModel, "nomic-embed-text:latest");
});

test("selectModels() falls back to any installed model when no preferred name matches", () => {
  const result = selectModels([{ name: "some-custom-model:latest", size: 1 }]);
  assert.equal(result.chatModel, "some-custom-model:latest");
  assert.equal(result.embedModel, undefined);
});

test("selectModels() returns undefined for both when nothing is installed", () => {
  const result = selectModels([]);
  assert.equal(result.chatModel, undefined);
  assert.equal(result.embedModel, undefined);
});

test("selectModels() never picks an embed-named model as the chat model", () => {
  const result = selectModels([{ name: "mxbai-embed-large:latest", size: 1 }]);
  assert.equal(result.chatModel, undefined);
  assert.equal(result.embedModel, "mxbai-embed-large:latest");
});
