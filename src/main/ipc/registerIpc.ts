import { dialog, ipcMain, type IpcMainInvokeEvent } from "electron";
import * as path from "path";
import { IPC_CHANNELS } from "./channels";
import type { LibraryManager, DocumentRecord } from "../file-manager/libraryManager";
import type { PluginRegistry } from "../plugin-registry/registry";
import { renderMarkdownToHtml } from "../markdown";
import type { EmbeddingIndex } from "../ai-engine/embeddingIndex";
import { askAboutLibrary } from "../ai-engine/chatService";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function enrichWithPeek(
  record: DocumentRecord,
  registry: PluginRegistry
): Promise<DocumentRecord & { title?: string; tags?: string[] }> {
  const mod = record.moduleId ? registry.get(record.moduleId) : undefined;
  if (!mod?.peek) return record;
  try {
    const info = await mod.peek(record.filePath);
    return { ...record, title: info.title, tags: info.tags };
  } catch {
    return record;
  }
}

export interface AiEngineHandles {
  embeddingIndex?: EmbeddingIndex;
  chatModel?: string;
  embedModel?: string;
}

/** Best-effort: re-embeds a document's searchable text for "ask my notes".
 * Failures (Ollama momentarily unreachable, etc.) shouldn't break the file
 * operation that triggered them — the embedding index just falls behind. */
async function reindexForEmbeddings(
  record: DocumentRecord,
  registry: PluginRegistry,
  embeddingIndex: EmbeddingIndex | undefined
): Promise<void> {
  if (!embeddingIndex || !record.moduleId) return;
  const mod = registry.get(record.moduleId);
  if (!mod) return;
  try {
    const handle = await mod.open(record.filePath);
    const searchable = await mod.index(handle);
    await embeddingIndex.indexDocument(record.id, searchable.text);
  } catch {
    // deliberately swallowed — see comment above
  }
}

export function registerIpc(library: LibraryManager, registry: PluginRegistry, ai: AiEngineHandles = {}): void {
  ipcMain.handle(IPC_CHANNELS.LIBRARY_OPEN_FOLDER, async (_event: IpcMainInvokeEvent, folderPath?: string) => {
    try {
      let targetFolder = folderPath;
      if (!targetFolder) {
        const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
        if (result.canceled || result.filePaths.length === 0) return { success: false as const };
        targetFolder = result.filePaths[0];
      }
      const files = library.openFolder(targetFolder);
      await Promise.all(files.map((record) => reindexForEmbeddings(record, registry, ai.embeddingIndex)));
      return { success: true as const, folderPath: targetFolder, files };
    } catch (error) {
      return { success: false as const, error: errorMessage(error) };
    }
  });

  ipcMain.handle(IPC_CHANNELS.LIBRARY_LIST_FILES, async () => {
    const records = library.listFiles();
    return Promise.all(records.map((record) => enrichWithPeek(record, registry)));
  });

  ipcMain.handle(IPC_CHANNELS.LIBRARY_OPEN_FILE, async (_event: IpcMainInvokeEvent, id: string) => {
    const record = library.getFile(id);
    if (!record || !record.moduleId) {
      return { success: false as const, error: "No module registered for this file type yet." };
    }
    const mod = registry.get(record.moduleId);
    if (!mod) {
      return { success: false as const, error: `Module "${record.moduleId}" is not loaded.` };
    }
    try {
      const handle = await mod.open(record.filePath);
      const rendered = await mod.render(handle);
      return { success: true as const, rendered };
    } catch (error) {
      return { success: false as const, error: errorMessage(error) };
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.LIBRARY_SAVE_FILE,
    async (_event: IpcMainInvokeEvent, id: string, content: unknown) => {
      const record = library.getFile(id);
      if (!record || !record.moduleId) {
        return { success: false as const, error: "No module registered for this file type." };
      }
      const mod = registry.get(record.moduleId);
      if (!mod) {
        return { success: false as const, error: `Module "${record.moduleId}" is not loaded.` };
      }
      try {
        const handle = await mod.open(record.filePath);
        await mod.save(handle, content);
        const updated = library.indexFile(record.filePath);
        await reindexForEmbeddings(updated, registry, ai.embeddingIndex);
        return { success: true as const };
      } catch (error) {
        return { success: false as const, error: errorMessage(error) };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.LIBRARY_CREATE_FILE,
    async (_event: IpcMainInvokeEvent, folderPath: string, fileName: string) => {
      const filePath = path.join(folderPath, fileName);
      const mod = registry.findByExtension(filePath);
      if (!mod) {
        return { success: false as const, error: `No module supports files named "${fileName}".` };
      }
      if (!mod.create) {
        return { success: false as const, error: `The "${mod.id}" module doesn't support creating new files.` };
      }
      try {
        await mod.create(filePath);
        const record = library.indexFile(filePath);
        await reindexForEmbeddings(record, registry, ai.embeddingIndex);
        return { success: true as const, file: record };
      } catch (error) {
        return { success: false as const, error: errorMessage(error) };
      }
    }
  );

  ipcMain.handle(IPC_CHANNELS.REGISTRY_LIST_MODULES, async () => {
    return registry.list().map((mod) => ({ id: mod.id, supportedExtensions: mod.supportedExtensions }));
  });

  ipcMain.handle(IPC_CHANNELS.NOTES_RENDER_PREVIEW, async (_event: IpcMainInvokeEvent, markdown: string) => {
    return { html: await renderMarkdownToHtml(markdown) };
  });

  ipcMain.handle(IPC_CHANNELS.AI_STATUS, async () => {
    return {
      chatModel: ai.chatModel,
      embedModel: ai.embedModel,
      indexedCount: ai.embeddingIndex?.count() ?? 0,
    };
  });

  ipcMain.handle(IPC_CHANNELS.AI_CHAT, async (_event: IpcMainInvokeEvent, question: string) => {
    if (!ai.chatModel) {
      return {
        success: false as const,
        error: "No local chat model is available. Install Ollama and pull a model, e.g. `ollama pull llama3.2`.",
      };
    }
    if (!ai.embeddingIndex) {
      return {
        success: false as const,
        error:
          "No embedding model is available, so DocStew can't search your notes yet. Pull an embedding model, e.g. `ollama pull nomic-embed-text`.",
      };
    }
    try {
      const result = await askAboutLibrary(question, ai.chatModel, ai.embeddingIndex, library);
      return { success: true as const, ...result };
    } catch (error) {
      return { success: false as const, error: errorMessage(error) };
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.AI_RUN_TOOL,
    async (
      _event: IpcMainInvokeEvent,
      fileId: string,
      toolName: string,
      args: Record<string, unknown> = {}
    ) => {
      const record = library.getFile(fileId);
      if (!record || !record.moduleId) {
        return { success: false as const, error: "No module registered for this file type." };
      }
      const mod = registry.get(record.moduleId);
      if (!mod) {
        return { success: false as const, error: `Module "${record.moduleId}" is not loaded.` };
      }
      const tool = mod.aiTools.find((t) => t.name === toolName);
      if (!tool) {
        return { success: false as const, error: `Module "${mod.id}" has no AI tool named "${toolName}".` };
      }
      try {
        const handle = await mod.open(record.filePath);
        const result = await tool.handler(handle, args);
        return { success: true as const, result };
      } catch (error) {
        return { success: false as const, error: errorMessage(error) };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.LIBRARY_RUN_OPERATION,
    async (
      _event: IpcMainInvokeEvent,
      fileId: string,
      opName: string,
      args: Record<string, unknown> = {}
    ) => {
      const record = library.getFile(fileId);
      if (!record || !record.moduleId) {
        return { success: false as const, error: "No module registered for this file type." };
      }
      const mod = registry.get(record.moduleId);
      if (!mod) {
        return { success: false as const, error: `Module "${record.moduleId}" is not loaded.` };
      }
      const operation = mod.operations?.find((o) => o.name === opName);
      if (!operation) {
        return { success: false as const, error: `Module "${mod.id}" has no operation named "${opName}".` };
      }
      try {
        const handle = await mod.open(record.filePath);
        const result = await operation.handler(handle, args);

        const updated = library.indexFile(record.filePath);
        await reindexForEmbeddings(updated, registry, ai.embeddingIndex);

        const newFilePaths = (result as { newFiles?: string[] } | undefined)?.newFiles ?? [];
        const newFiles = [];
        for (const filePath of newFilePaths) {
          const newRecord = library.indexFile(filePath);
          await reindexForEmbeddings(newRecord, registry, ai.embeddingIndex);
          newFiles.push(newRecord);
        }

        return { success: true as const, result, file: updated, newFiles };
      } catch (error) {
        return { success: false as const, error: errorMessage(error) };
      }
    }
  );
}
