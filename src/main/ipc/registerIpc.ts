import { dialog, ipcMain, type IpcMainInvokeEvent } from "electron";
import * as fs from "fs";
import * as path from "path";
import { IPC_CHANNELS } from "./channels";
import type { LibraryManager, DocumentRecord } from "../file-manager/libraryManager";
import type { PluginRegistry } from "../plugin-registry/registry";
import { renderMarkdownToHtml } from "../markdown";
import type { EmbeddingIndex } from "../ai-engine/embeddingIndex";
import { askAboutLibrary } from "../ai-engine/chatService";
import type { FullTextIndex } from "../search/fullTextIndex";
import type { VersionHistory } from "../file-manager/versionHistory";

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

/** Best-effort: re-indexes a document's searchable text into both the
 * full-text index (always, no dependency on Ollama) and the semantic
 * embedding index (only when Ollama's embedding model is available).
 * Failures shouldn't break the file operation that triggered them — the
 * indexes just fall behind. */
async function reindexDocument(
  record: DocumentRecord,
  registry: PluginRegistry,
  fullTextIndex: FullTextIndex,
  embeddingIndex: EmbeddingIndex | undefined
): Promise<void> {
  if (!record.moduleId) return;
  const mod = registry.get(record.moduleId);
  if (!mod) return;
  try {
    const handle = await mod.open(record.filePath);
    const searchable = await mod.index(handle);
    fullTextIndex.indexDocument(record.id, record.fileName, searchable.text);
    if (embeddingIndex) await embeddingIndex.indexDocument(record.id, searchable.text);
  } catch {
    // deliberately swallowed — see comment above
  }
}

function uniqueOutputPath(dir: string, baseName: string, extension: string): string {
  let candidate = path.join(dir, `${baseName}.${extension}`);
  let n = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${baseName}-${n}.${extension}`);
    n++;
  }
  return candidate;
}

export function registerIpc(
  library: LibraryManager,
  registry: PluginRegistry,
  fullTextIndex: FullTextIndex,
  versionHistory: VersionHistory,
  ai: AiEngineHandles = {}
): void {
  ipcMain.handle(IPC_CHANNELS.LIBRARY_OPEN_FOLDER, async (_event: IpcMainInvokeEvent, folderPath?: string) => {
    try {
      let targetFolder = folderPath;
      if (!targetFolder) {
        const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
        if (result.canceled || result.filePaths.length === 0) return { success: false as const };
        targetFolder = result.filePaths[0];
      }
      const files = library.openFolder(targetFolder);
      await Promise.all(files.map((record) => reindexDocument(record, registry, fullTextIndex, ai.embeddingIndex)));
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
        versionHistory.snapshot(record.id, record.filePath);
        const handle = await mod.open(record.filePath);
        await mod.save(handle, content);
        const updated = library.indexFile(record.filePath);
        await reindexDocument(updated, registry, fullTextIndex, ai.embeddingIndex);
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
        await reindexDocument(record, registry, fullTextIndex, ai.embeddingIndex);
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
        versionHistory.snapshot(record.id, record.filePath);
        const handle = await mod.open(record.filePath);
        const result = await operation.handler(handle, args);

        const updated = library.indexFile(record.filePath);
        await reindexDocument(updated, registry, fullTextIndex, ai.embeddingIndex);

        const newFilePaths = (result as { newFiles?: string[] } | undefined)?.newFiles ?? [];
        const newFiles = [];
        for (const filePath of newFilePaths) {
          const newRecord = library.indexFile(filePath);
          await reindexDocument(newRecord, registry, fullTextIndex, ai.embeddingIndex);
          newFiles.push(newRecord);
        }

        return { success: true as const, result, file: updated, newFiles };
      } catch (error) {
        return { success: false as const, error: errorMessage(error) };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.LIBRARY_RUN_QUERY,
    async (
      _event: IpcMainInvokeEvent,
      fileId: string,
      queryName: string,
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
      const query = mod.queries?.find((q) => q.name === queryName);
      if (!query) {
        return { success: false as const, error: `Module "${mod.id}" has no query named "${queryName}".` };
      }
      try {
        const handle = await mod.open(record.filePath);
        const result = await query.handler(handle, args);
        return { success: true as const, result };
      } catch (error) {
        return { success: false as const, error: errorMessage(error) };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.LIBRARY_EXPORT_FILE,
    async (_event: IpcMainInvokeEvent, fileId: string, format: string) => {
      const record = library.getFile(fileId);
      if (!record || !record.moduleId) {
        return { success: false as const, error: "No module registered for this file type." };
      }
      const mod = registry.get(record.moduleId);
      if (!mod) {
        return { success: false as const, error: `Module "${record.moduleId}" is not loaded.` };
      }
      try {
        const handle = await mod.open(record.filePath);
        const buffer = await mod.export(handle, format);
        const dir = path.dirname(record.filePath);
        const baseName = path.basename(record.filePath, path.extname(record.filePath));
        const outputPath = uniqueOutputPath(dir, baseName, format);
        fs.writeFileSync(outputPath, buffer);
        const newRecord = library.indexFile(outputPath);
        await reindexDocument(newRecord, registry, fullTextIndex, ai.embeddingIndex);
        return { success: true as const, file: newRecord };
      } catch (error) {
        return { success: false as const, error: errorMessage(error) };
      }
    }
  );

  ipcMain.handle(IPC_CHANNELS.LIBRARY_SEARCH, async (_event: IpcMainInvokeEvent, query: string) => {
    const matches = fullTextIndex.search(query, 30);
    const results = matches
      .map((match) => {
        const record = library.getFile(match.documentId);
        return record ? { ...record, snippet: match.snippet } : undefined;
      })
      .filter((r): r is DocumentRecord & { snippet: string } => r !== undefined);
    return { results };
  });

  ipcMain.handle(IPC_CHANNELS.LIBRARY_LIST_VERSIONS, async (_event: IpcMainInvokeEvent, fileId: string) => {
    return versionHistory.list(fileId);
  });

  ipcMain.handle(
    IPC_CHANNELS.LIBRARY_RESTORE_VERSION,
    async (_event: IpcMainInvokeEvent, fileId: string, versionId: number) => {
      const record = library.getFile(fileId);
      if (!record) {
        return { success: false as const, error: "File not found." };
      }
      try {
        versionHistory.restore(versionId, record.filePath);
        const updated = library.indexFile(record.filePath);
        await reindexDocument(updated, registry, fullTextIndex, ai.embeddingIndex);
        return { success: true as const };
      } catch (error) {
        return { success: false as const, error: errorMessage(error) };
      }
    }
  );
}
