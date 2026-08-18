import * as fs from "fs";
import * as path from "path";
import type { DocStewModule } from "../../shared/module-contract";

const REQUIRED_KEYS: Array<keyof DocStewModule> = [
  "id",
  "supportedExtensions",
  "open",
  "render",
  "save",
  "export",
  "index",
  "aiTools",
];

function isDocStewModule(candidate: unknown): candidate is DocStewModule {
  if (typeof candidate !== "object" || candidate === null) return false;
  const obj = candidate as Record<string, unknown>;
  return REQUIRED_KEYS.every((key) => key in obj);
}

export class PluginRegistry {
  private modules = new Map<string, DocStewModule>();

  register(mod: DocStewModule): void {
    if (this.modules.has(mod.id)) {
      throw new Error(`A module with id "${mod.id}" is already registered.`);
    }
    this.modules.set(mod.id, mod);
  }

  get(id: string): DocStewModule | undefined {
    return this.modules.get(id);
  }

  /** Finds the module that claims a given file extension (e.g. ".pdf"), if any. */
  findByExtension(filePath: string): DocStewModule | undefined {
    const ext = path.extname(filePath).toLowerCase();
    for (const mod of this.modules.values()) {
      if (mod.supportedExtensions.includes(ext)) return mod;
    }
    return undefined;
  }

  list(): DocStewModule[] {
    return [...this.modules.values()];
  }

  /**
   * Discovers modules under a directory (one subfolder per module, each with
   * a compiled index.js default-exporting a DocStewModule) and registers them.
   * Returns the ids that were loaded.
   */
  loadFromDirectory(modulesDir: string): string[] {
    if (!fs.existsSync(modulesDir)) return [];
    const loaded: string[] = [];
    for (const entry of fs.readdirSync(modulesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const indexPath = path.join(modulesDir, entry.name, "index.js");
      if (!fs.existsSync(indexPath)) continue;

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const loadedModule = require(indexPath);
      const candidate = loadedModule?.default ?? loadedModule;
      if (!isDocStewModule(candidate)) {
        throw new Error(`Module at "${indexPath}" does not satisfy the DocStewModule contract.`);
      }
      this.register(candidate);
      loaded.push(candidate.id);
    }
    return loaded;
  }
}
