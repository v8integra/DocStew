import { BrowserWindow } from "electron";

/** Renders arbitrary HTML to a PDF buffer using Electron's own Chromium print
 * engine — no extra rendering dependency needed. A hidden, offscreen window
 * is the standard way to do this from the main process. */
export async function htmlToPdfBuffer(html: string): Promise<Buffer> {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return await win.webContents.printToPDF({});
  } finally {
    win.destroy();
  }
}
