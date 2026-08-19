import { ipcMain, type IpcMainInvokeEvent } from "electron";
import * as fs from "fs";
import { IPC_CHANNELS } from "./channels";
import type { LibraryManager } from "../file-manager/libraryManager";

/** The only genuinely Images-specific IPC channel: the renderer needs the
 * raw file bytes to display the image (as an object URL), same reasoning
 * as pdfIpc.ts's PDF_READ_BYTES — everything else Images needs goes
 * through the generic operations mechanism. */
export function registerImagesIpc(library: LibraryManager): void {
  ipcMain.handle(IPC_CHANNELS.IMAGE_READ_BYTES, async (_event: IpcMainInvokeEvent, fileId: string) => {
    const record = library.getFile(fileId);
    if (!record) throw new Error("File not found.");
    return fs.readFileSync(record.filePath);
  });
}
