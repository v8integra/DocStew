import { dialog, ipcMain, type IpcMainInvokeEvent } from "electron";
import * as path from "path";
import { IPC_CHANNELS } from "./channels";
import type { LibraryManager, DocumentRecord } from "../file-manager/libraryManager";
import type { PluginRegistry } from "../plugin-registry/registry";
import { renderMarkdownToHtml } from "../markdown";

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

export function registerIpc(library: LibraryManager, registry: PluginRegistry): void {
  ipcMain.handle(IPC_CHANNELS.LIBRARY_OPEN_FOLDER, async (_event: IpcMainInvokeEvent, folderPath?: string) => {
    try {
      let targetFolder = folderPath;
      if (!targetFolder) {
        const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
        if (result.canceled || result.filePaths.length === 0) return { success: false as const };
        targetFolder = result.filePaths[0];
      }
      const files = library.openFolder(targetFolder);
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
        library.indexFile(record.filePath);
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
}
