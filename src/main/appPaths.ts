import { app } from "electron";
import * as path from "path";

/** Every file this app writes under one root, so uninstall cleanup and backups are simple. */
export function getUserDataRoot(): string {
  return app.getPath("userData");
}

export function getLibraryDbPath(): string {
  return path.join(getUserDataRoot(), "library.db");
}
