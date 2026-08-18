import { app, BrowserWindow } from "electron";
import * as path from "path";
import { getLibraryDbPath } from "./appPaths";
import { openDatabase } from "./file-manager/db";
import { LibraryManager } from "./file-manager/libraryManager";
import { PluginRegistry } from "./plugin-registry/registry";
import { registerIpc } from "./ipc/registerIpc";
import { listModels } from "./ai-engine/ollamaClient";
import { selectModels } from "./ai-engine/modelSelection";
import { setModels } from "./ai-engine/config";
import { EmbeddingIndex } from "./ai-engine/embeddingIndex";

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
}

app.whenReady().then(async () => {
  const registry = new PluginRegistry();
  registry.loadFromDirectory(path.join(__dirname, "..", "..", "modules"));

  const db = openDatabase(getLibraryDbPath());
  const library = new LibraryManager(db, registry);

  // Ollama may not be installed/running — degrade gracefully rather than
  // failing app startup; the chat panel surfaces the "not available" state.
  const installedModels = await listModels().catch(() => []);
  const { chatModel, embedModel } = selectModels(installedModels);
  setModels({ chatModel, embedModel });
  const embeddingIndex = embedModel ? new EmbeddingIndex(db, embedModel) : undefined;

  registerIpc(library, registry, { embeddingIndex, chatModel, embedModel });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
