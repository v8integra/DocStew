interface DocumentRecord {
  id: string;
  filePath: string;
  fileName: string;
  extension: string;
  moduleId: string | null;
  sizeBytes: number;
  mtimeMs: number;
  addedAt: number;
}

interface DocStewApi {
  openFolder: (folderPath?: string) => Promise<{ success: boolean; files?: DocumentRecord[]; error?: string }>;
  listFiles: () => Promise<DocumentRecord[]>;
  openFile: (id: string) => Promise<{ success: boolean; rendered?: { kind: string; data: unknown }; error?: string }>;
  listModules: () => Promise<Array<{ id: string; supportedExtensions: string[] }>>;
}

interface Window {
  docstew: DocStewApi;
}

const fileListEl = document.getElementById("file-list") as HTMLUListElement;
const emptyStateEl = document.getElementById("empty-state") as HTMLParagraphElement;
const contentViewEl = document.getElementById("content-view") as HTMLPreElement;
const openFolderBtn = document.getElementById("open-folder-btn") as HTMLButtonElement;
const paletteBtn = document.getElementById("palette-btn") as HTMLButtonElement;
const palette = document.getElementById("command-palette") as HTMLDivElement;
const paletteInput = document.getElementById("palette-input") as HTMLInputElement;

function renderFileList(files: DocumentRecord[]): void {
  fileListEl.innerHTML = "";
  for (const file of files) {
    const li = document.createElement("li");
    li.dataset.id = file.id;

    const name = document.createElement("span");
    name.textContent = file.fileName;
    li.appendChild(name);

    const tag = document.createElement("span");
    tag.className = "module-tag";
    tag.textContent = file.moduleId ?? "unsupported";
    li.appendChild(tag);

    li.addEventListener("click", () => selectFile(file));
    fileListEl.appendChild(li);
  }
}

async function selectFile(file: DocumentRecord): Promise<void> {
  for (const li of fileListEl.querySelectorAll("li")) {
    li.classList.toggle("selected", li.dataset.id === file.id);
  }

  if (!file.moduleId) {
    showContent(`No module can open "${file.fileName}" yet.`);
    return;
  }

  const result = await window.docstew.openFile(file.id);
  if (!result.success) {
    showContent(`Could not open "${file.fileName}": ${result.error}`);
    return;
  }
  showContent(JSON.stringify(result.rendered, null, 2));
}

function showContent(text: string): void {
  emptyStateEl.hidden = true;
  contentViewEl.hidden = false;
  contentViewEl.textContent = text;
}

async function refreshFileList(): Promise<void> {
  const files = await window.docstew.listFiles();
  renderFileList(files);
}

openFolderBtn.addEventListener("click", async () => {
  const result = await window.docstew.openFolder();
  if (result.success) {
    await refreshFileList();
  }
});

function togglePalette(show: boolean): void {
  palette.hidden = !show;
  if (show) {
    paletteInput.value = "";
    paletteInput.focus();
  }
}

paletteBtn.addEventListener("click", () => togglePalette(palette.hidden));

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    togglePalette(palette.hidden);
  } else if (event.key === "Escape" && !palette.hidden) {
    togglePalette(false);
  }
});

refreshFileList();
