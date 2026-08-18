import type { OllamaModel } from "./ollamaClient";

const PREFERRED_CHAT_MODELS = ["llama3.2", "llama3.1", "qwen2.5", "mistral"];
const PREFERRED_EMBED_MODELS = ["nomic-embed-text", "mxbai-embed-large", "all-minilm"];

const EMBED_NAME_PATTERN = /embed/i;

function findPreferred(names: string[], preferred: string[]): string | undefined {
  for (const pref of preferred) {
    const match = names.find((n) => n === pref || n.startsWith(`${pref}:`));
    if (match) return match;
  }
  return undefined;
}

export interface SelectedModels {
  chatModel?: string;
  embedModel?: string;
}

/** Picks a default chat model and embedding model out of whatever's actually
 * installed, preferring well-known names but falling back to whatever's there
 * so the app is usable with any model the user happens to have pulled. */
export function selectModels(installed: OllamaModel[]): SelectedModels {
  const names = installed.map((m) => m.name);
  const embedCandidates = names.filter((n) => EMBED_NAME_PATTERN.test(n));
  const chatCandidates = names.filter((n) => !EMBED_NAME_PATTERN.test(n));

  const embedModel = findPreferred(embedCandidates, PREFERRED_EMBED_MODELS) ?? embedCandidates[0];
  const chatModel = findPreferred(chatCandidates, PREFERRED_CHAT_MODELS) ?? chatCandidates[0];

  return { chatModel, embedModel };
}
