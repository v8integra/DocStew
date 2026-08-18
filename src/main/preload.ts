import { contextBridge, ipcRenderer } from "electron";

// Duplicated from ipc/channels.ts rather than imported: a sandboxed preload
// (sandbox: true, the default) can only require() its own bundled file, not
// sibling project modules. Keep these in sync with channels.ts by hand.
const IPC_CHANNELS = {
  LIBRARY_OPEN_FOLDER: "library:openFolder",
  LIBRARY_LIST_FILES: "library:listFiles",
  LIBRARY_OPEN_FILE: "library:openFile",
  LIBRARY_SAVE_FILE: "library:saveFile",
  LIBRARY_CREATE_FILE: "library:createFile",
  REGISTRY_LIST_MODULES: "registry:listModules",
  NOTES_RENDER_PREVIEW: "notes:renderPreview",
} as const;

contextBridge.exposeInMainWorld("docstew", {
  openFolder: (folderPath?: string) => ipcRenderer.invoke(IPC_CHANNELS.LIBRARY_OPEN_FOLDER, folderPath),
  listFiles: () => ipcRenderer.invoke(IPC_CHANNELS.LIBRARY_LIST_FILES),
  openFile: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.LIBRARY_OPEN_FILE, id),
  saveFile: (id: string, content: unknown) => ipcRenderer.invoke(IPC_CHANNELS.LIBRARY_SAVE_FILE, id, content),
  createFile: (folderPath: string, fileName: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.LIBRARY_CREATE_FILE, folderPath, fileName),
  listModules: () => ipcRenderer.invoke(IPC_CHANNELS.REGISTRY_LIST_MODULES),
  renderMarkdownPreview: (markdown: string) => ipcRenderer.invoke(IPC_CHANNELS.NOTES_RENDER_PREVIEW, markdown),
});
