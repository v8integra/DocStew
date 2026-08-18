import { dialog, ipcMain, type IpcMainInvokeEvent } from "electron";
import { IPC_CHANNELS } from "./channels";
import type { LibraryManager } from "../file-manager/libraryManager";
import type { PluginRegistry } from "../plugin-registry/registry";

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
      return { success: false as const, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle(IPC_CHANNELS.LIBRARY_LIST_FILES, async () => {
    return library.listFiles();
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
    const handle = await mod.open(record.filePath);
    const rendered = await mod.render(handle);
    return { success: true as const, rendered };
  });

  ipcMain.handle(IPC_CHANNELS.REGISTRY_LIST_MODULES, async () => {
    return registry.list().map((mod) => ({ id: mod.id, supportedExtensions: mod.supportedExtensions }));
  });
}
