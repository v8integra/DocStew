interface DocumentRecord {
  id: string;
  filePath: string;
  fileName: string;
  extension: string;
  moduleId: string | null;
  sizeBytes: number;
  mtimeMs: number;
  addedAt: number;
  title?: string;
  tags?: string[];
}

interface OpenFolderResult {
  success: boolean;
  folderPath?: string;
  files?: DocumentRecord[];
  error?: string;
}

interface OpenFileResult {
  success: boolean;
  rendered?: { kind: string; data: unknown };
  error?: string;
}

interface SaveFileResult {
  success: boolean;
  error?: string;
}

interface CreateFileResult {
  success: boolean;
  file?: DocumentRecord;
  error?: string;
}

interface NotesData {
  title: string;
  tags: string[];
  body: string;
  html: string;
}

interface DocStewApi {
  openFolder: (folderPath?: string) => Promise<OpenFolderResult>;
  listFiles: () => Promise<DocumentRecord[]>;
  openFile: (id: string) => Promise<OpenFileResult>;
  saveFile: (id: string, content: unknown) => Promise<SaveFileResult>;
  createFile: (folderPath: string, fileName: string) => Promise<CreateFileResult>;
  listModules: () => Promise<Array<{ id: string; supportedExtensions: string[] }>>;
  renderMarkdownPreview: (markdown: string) => Promise<{ html: string }>;
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
const paletteResultsEl = document.getElementById("palette-results") as HTMLUListElement;

const notesEditorEl = document.getElementById("notes-editor") as HTMLDivElement;
const notesTitleEl = document.getElementById("notes-title") as HTMLInputElement;
const notesTagsEl = document.getElementById("notes-tags") as HTMLInputElement;
const notesBodyEl = document.getElementById("notes-body") as HTMLTextAreaElement;
const notesPreviewEl = document.getElementById("notes-preview") as HTMLDivElement;
const notesTogglePreviewBtn = document.getElementById("notes-toggle-preview") as HTMLButtonElement;
const notesSaveBtn = document.getElementById("notes-save") as HTMLButtonElement;
const notesSaveStatusEl = document.getElementById("notes-save-status") as HTMLSpanElement;

let currentFolder: string | undefined;
let currentOpenFileId: string | undefined;
let notesPreviewMode = false;

// ---- Sidebar / library ----

function renderFileList(files: DocumentRecord[]): void {
  fileListEl.innerHTML = "";
  for (const file of files) {
    const li = document.createElement("li");
    li.dataset.id = file.id;

    const row = document.createElement("div");
    row.className = "file-row";

    const name = document.createElement("span");
    name.className = "file-name";
    name.textContent = file.title || file.fileName;
    row.appendChild(name);

    const tag = document.createElement("span");
    tag.className = "module-tag";
    tag.textContent = file.moduleId ?? "unsupported";
    row.appendChild(tag);

    li.appendChild(row);

    if (file.tags && file.tags.length > 0) {
      const tagsRow = document.createElement("div");
      tagsRow.className = "file-tags";
      for (const t of file.tags) {
        const pill = document.createElement("span");
        pill.className = "tag-pill";
        pill.textContent = t;
        tagsRow.appendChild(pill);
      }
      li.appendChild(tagsRow);
    }

    li.addEventListener("click", () => selectFile(file));
    fileListEl.appendChild(li);
  }
}

async function refreshFileList(): Promise<void> {
  const files = await window.docstew.listFiles();
  renderFileList(files);
}

// ---- Main pane ----

function showEmpty(message: string): void {
  emptyStateEl.hidden = false;
  emptyStateEl.textContent = message;
  contentViewEl.hidden = true;
  notesEditorEl.hidden = true;
}

function showGenericContent(text: string): void {
  emptyStateEl.hidden = true;
  contentViewEl.hidden = false;
  notesEditorEl.hidden = true;
  contentViewEl.textContent = text;
}

function showNotesEditor(file: DocumentRecord, data: NotesData): void {
  emptyStateEl.hidden = true;
  contentViewEl.hidden = true;
  notesEditorEl.hidden = false;

  currentOpenFileId = file.id;
  notesTitleEl.value = data.title;
  notesTagsEl.value = data.tags.join(", ");
  notesBodyEl.value = data.body;
  notesPreviewEl.innerHTML = data.html;
  notesPreviewMode = false;
  notesBodyEl.hidden = false;
  notesPreviewEl.hidden = true;
  notesTogglePreviewBtn.textContent = "Preview";
  notesSaveStatusEl.textContent = "";
}

async function selectFile(file: DocumentRecord): Promise<void> {
  for (const li of fileListEl.querySelectorAll("li")) {
    li.classList.toggle("selected", li.dataset.id === file.id);
  }

  if (!file.moduleId) {
    showEmpty(`No module can open "${file.fileName}" yet.`);
    return;
  }

  const result = await window.docstew.openFile(file.id);
  if (!result.success || !result.rendered) {
    showEmpty(`Could not open "${file.fileName}": ${result.error}`);
    return;
  }

  if (result.rendered.kind === "notes") {
    showNotesEditor(file, result.rendered.data as NotesData);
  } else {
    showGenericContent(JSON.stringify(result.rendered, null, 2));
  }
}

// ---- Notes editor behavior ----

async function toggleNotesPreview(): Promise<void> {
  notesPreviewMode = !notesPreviewMode;
  if (notesPreviewMode) {
    const { html } = await window.docstew.renderMarkdownPreview(notesBodyEl.value);
    notesPreviewEl.innerHTML = html;
    notesBodyEl.hidden = true;
    notesPreviewEl.hidden = false;
    notesTogglePreviewBtn.textContent = "Edit Source";
  } else {
    notesBodyEl.hidden = false;
    notesPreviewEl.hidden = true;
    notesTogglePreviewBtn.textContent = "Preview";
  }
}

async function saveCurrentNote(): Promise<void> {
  if (!currentOpenFileId) return;
  const content = {
    title: notesTitleEl.value.trim() || "Untitled",
    tags: notesTagsEl.value
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0),
    body: notesBodyEl.value,
  };
  notesSaveStatusEl.textContent = "Saving...";
  const result = await window.docstew.saveFile(currentOpenFileId, content);
  if (result.success) {
    notesSaveStatusEl.textContent = "Saved";
    await refreshFileList();
  } else {
    notesSaveStatusEl.textContent = `Error: ${result.error}`;
  }
}

notesTogglePreviewBtn.addEventListener("click", () => void toggleNotesPreview());
notesSaveBtn.addEventListener("click", () => void saveCurrentNote());

// ---- Folder open ----

openFolderBtn.addEventListener("click", async () => {
  const result = await window.docstew.openFolder();
  if (result.success && result.folderPath) {
    currentFolder = result.folderPath;
    await refreshFileList();
  }
});

// ---- Command palette ----

type PaletteMode = "command" | "new-note";
let paletteMode: PaletteMode = "command";

interface Command {
  id: string;
  label: string;
  run: () => void;
}

function getCommands(): Command[] {
  return [{ id: "new-note", label: "New Note", run: enterNewNoteMode }];
}

function slugifyFileName(title: string): string {
  const cleaned = title.trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, "-");
  return cleaned.length > 0 ? cleaned : "untitled";
}

function renderPaletteResults(filterText: string): void {
  paletteResultsEl.innerHTML = "";

  if (paletteMode === "new-note") {
    const hint = document.createElement("li");
    hint.textContent = currentFolder
      ? "Press Enter to create this note in the open library folder."
      : "Open a folder first — there's nowhere to save this note yet.";
    paletteResultsEl.appendChild(hint);
    return;
  }

  const commands = getCommands().filter((c) => c.label.toLowerCase().includes(filterText.toLowerCase()));
  if (commands.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No matching commands.";
    paletteResultsEl.appendChild(li);
    return;
  }
  for (const command of commands) {
    const li = document.createElement("li");
    li.textContent = command.label;
    li.addEventListener("click", () => command.run());
    paletteResultsEl.appendChild(li);
  }
}

function enterNewNoteMode(): void {
  paletteMode = "new-note";
  paletteInput.value = "";
  paletteInput.placeholder = "Note title...";
  paletteInput.focus();
  renderPaletteResults("");
}

function showPaletteError(message: string): void {
  paletteResultsEl.innerHTML = "";
  const li = document.createElement("li");
  li.textContent = message;
  paletteResultsEl.appendChild(li);
}

async function createNoteFromPaletteInput(): Promise<void> {
  const title = paletteInput.value.trim();
  if (!title) return;
  if (!currentFolder) {
    showPaletteError("Open a folder first.");
    return;
  }
  const fileName = `${slugifyFileName(title)}.md`;
  const result = await window.docstew.createFile(currentFolder, fileName);
  if (!result.success) {
    showPaletteError(result.error ?? "Could not create the note.");
    return;
  }
  togglePalette(false);
  await refreshFileList();
  if (result.file) await selectFile(result.file);
}

function togglePalette(show: boolean): void {
  palette.hidden = !show;
  if (show) {
    paletteMode = "command";
    paletteInput.value = "";
    paletteInput.placeholder = "Type a command...";
    paletteInput.focus();
    renderPaletteResults("");
  }
}

paletteBtn.addEventListener("click", () => togglePalette(palette.hidden));

paletteInput.addEventListener("input", () => renderPaletteResults(paletteInput.value));

paletteInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  if (paletteMode === "command") {
    const filterText = paletteInput.value;
    const [first] = getCommands().filter((c) => c.label.toLowerCase().includes(filterText.toLowerCase()));
    if (first) first.run();
  } else {
    void createNoteFromPaletteInput();
  }
});

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    togglePalette(palette.hidden);
  } else if (event.key === "Escape" && !palette.hidden) {
    togglePalette(false);
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && !notesEditorEl.hidden) {
    event.preventDefault();
    void saveCurrentNote();
  }
});

refreshFileList();
