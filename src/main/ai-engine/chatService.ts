import type { LibraryManager } from "../file-manager/libraryManager";
import { chat, type ChatMessage } from "./ollamaClient";
import type { EmbeddingIndex } from "./embeddingIndex";

export interface ChatSource {
  documentId: string;
  filePath: string;
  fileName: string;
  score: number;
}

export interface ChatAnswer {
  answer: string;
  sources: ChatSource[];
}

const SYSTEM_PROMPT_PREFIX =
  "You are DocStew's local assistant. Answer the user's question using ONLY the excerpts below " +
  "from their own documents. If the excerpts don't contain the answer, say so plainly instead of " +
  "guessing or using outside knowledge. Cite sources by their [n] number when you use them.\n\n";

/** "Ask my notes" (docstew-plan.md §5 Phase 2): embeds the question, retrieves
 * the most relevant indexed documents, and asks the chat model to answer
 * grounded in those excerpts only. */
export async function askAboutLibrary(
  question: string,
  chatModel: string,
  embeddingIndex: EmbeddingIndex,
  library: LibraryManager,
  topK = 5,
  chatFn: typeof chat = chat
): Promise<ChatAnswer> {
  const matches = await embeddingIndex.search(question, topK);
  const withFiles = matches
    .map((match) => ({ match, file: library.getFile(match.documentId) }))
    .filter((entry): entry is typeof entry & { file: NonNullable<typeof entry.file> } => entry.file !== undefined);

  const context = withFiles
    .map((entry, i) => `[${i + 1}] ${entry.file.fileName}\n${entry.match.text}`)
    .join("\n\n---\n\n");

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT_PREFIX + (context || "(no relevant documents found)") },
    { role: "user", content: question },
  ];

  const answer = await chatFn(chatModel, messages);

  return {
    answer,
    sources: withFiles.map(({ match, file }) => ({
      documentId: match.documentId,
      filePath: file.filePath,
      fileName: file.fileName,
      score: match.score,
    })),
  };
}
