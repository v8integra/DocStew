import { chat } from "../ai-engine/ollamaClient";
import { getChatModel } from "../ai-engine/config";

// A local general-purpose chat model via prompting, not a dedicated
// translation model (NLLB-200) — see docstew-plan.md §3a's "hybrid"
// recommendation. Deliberately simplified for this phase: NLLB isn't
// something Ollama serves, and standing up a real NLLB inference engine
// (Python subprocess, model download, IPC bridge) is a much bigger lift on
// the scale of the sibling LocalAI project's generation engines. Quality
// follows from this: solid for major pairs (EN<->ES/FR/DE/ZH/JA), degrades
// for lower-resource languages — a model-quality property to be upfront
// about, not a bug to chase.
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
  pl: "Polish",
  sv: "Swedish",
  ru: "Russian",
  uk: "Ukrainian",
  tr: "Turkish",
  ar: "Arabic",
  hi: "Hindi",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
  vi: "Vietnamese",
  th: "Thai",
  id: "Indonesian",
};

function resolveLanguageName(languageCodeOrName: string): string {
  return LANGUAGE_NAMES[languageCodeOrName.trim().toLowerCase()] ?? languageCodeOrName.trim();
}

function requireChatModel(): string {
  const model = getChatModel();
  if (!model) {
    throw new Error("No local chat model is available. Install Ollama and pull a model to use AI features.");
  }
  return model;
}

export interface TranslationResult {
  original: string;
  translated: string;
  targetLanguage: string;
  sourceLanguage?: string;
}

/** Translates text via the local chat model. Accepts either a language code
 * ("es") or a plain name ("Spanish") for target/source — both are passed
 * straight through to the model's prompt if not in the known code map,
 * since a capable chat model understands language names directly. */
export async function translateText(
  text: string,
  targetLanguage: string,
  sourceLanguage?: string
): Promise<TranslationResult> {
  const target = resolveLanguageName(targetLanguage);
  if (!target) throw new Error("A target language is required.");
  if (text.trim().length === 0) {
    return { original: text, translated: "", targetLanguage: target, sourceLanguage };
  }

  const source = sourceLanguage ? resolveLanguageName(sourceLanguage) : undefined;
  const instruction = source
    ? `Translate the user's text from ${source} to ${target}.`
    : `Translate the user's text to ${target}. Detect the source language automatically.`;

  const model = requireChatModel();
  const translated = await chat(model, [
    {
      role: "system",
      content: `${instruction} Respond with ONLY the translation — no explanation, no quotes, no preamble. Preserve paragraph breaks.`,
    },
    { role: "user", content: text },
  ]);

  return { original: text, translated: translated.trim(), targetLanguage: target, sourceLanguage: source };
}
