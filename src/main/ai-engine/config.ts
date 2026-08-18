import type { SelectedModels } from "./modelSelection";

/** The currently active model selection, set once at startup after
 * modelSelection.selectModels() runs. Modules' aiTool handlers read this
 * (rather than the contract threading AI-engine config through every call)
 * to call the local chat model — the same pattern Notes' render() already
 * uses to import src/main/markdown.ts directly. */
let current: SelectedModels = {};

export function setModels(models: SelectedModels): void {
  current = models;
}

export function getChatModel(): string | undefined {
  return current.chatModel;
}

export function getEmbedModel(): string | undefined {
  return current.embedModel;
}
