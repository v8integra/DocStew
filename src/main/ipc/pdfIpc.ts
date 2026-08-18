import { ipcMain, type IpcMainInvokeEvent } from "electron";
import * as fs from "fs";
import { IPC_CHANNELS } from "./channels";
import type { LibraryManager } from "../file-manager/libraryManager";

/** The only genuinely PDF-specific IPC channel: the renderer needs the raw
 * file bytes to render pages with pdfjs client-side (see docstew-plan.md's
 * module contract — everything else PDF needs goes through the generic
 * aiTools/operations mechanisms, not a bespoke channel). */
export function registerPdfIpc(library: LibraryManager): void {
  ipcMain.handle(IPC_CHANNELS.PDF_READ_BYTES, async (_event: IpcMainInvokeEvent, fileId: string) => {
    const record = library.getFile(fileId);
    if (!record) throw new Error("File not found.");
    return fs.readFileSync(record.filePath);
  });
}
