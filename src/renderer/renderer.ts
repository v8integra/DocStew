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

interface AiStatus {
  chatModel?: string;
  embedModel?: string;
  indexedCount: number;
}

interface ChatSource {
  documentId: string;
  filePath: string;
  fileName: string;
  score: number;
}

interface AiChatResult {
  success: boolean;
  answer?: string;
  sources?: ChatSource[];
  error?: string;
}

interface AiRunToolResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

interface RunOperationResult {
  success: boolean;
  result?: unknown;
  file?: DocumentRecord;
  newFiles?: DocumentRecord[];
  error?: string;
}

interface PdfData {
  pageCount: number;
}

interface WordData {
  html: string;
  warnings: string[];
}

interface WordRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

type WordBlock =
  | { type: "heading"; level: 1 | 2 | 3; runs: WordRun[] }
  | { type: "paragraph"; runs: WordRun[] }
  | { type: "bulletItem"; runs: WordRun[] }
  | { type: "numberItem"; runs: WordRun[] }
  | { type: "table"; rows: WordRun[][][] };

interface DocStewApi {
  openFolder: (folderPath?: string) => Promise<OpenFolderResult>;
  listFiles: () => Promise<DocumentRecord[]>;
  openFile: (id: string) => Promise<OpenFileResult>;
  saveFile: (id: string, content: unknown) => Promise<SaveFileResult>;
  createFile: (folderPath: string, fileName: string) => Promise<CreateFileResult>;
  runOperation: (fileId: string, opName: string, args?: Record<string, unknown>) => Promise<RunOperationResult>;
  exportFile: (fileId: string, format: string) => Promise<RunOperationResult>;
  listModules: () => Promise<Array<{ id: string; supportedExtensions: string[] }>>;
  renderMarkdownPreview: (markdown: string) => Promise<{ html: string }>;
  aiStatus: () => Promise<AiStatus>;
  aiChat: (question: string) => Promise<AiChatResult>;
  aiRunTool: (fileId: string, toolName: string, args?: Record<string, unknown>) => Promise<AiRunToolResult>;
  pdfReadBytes: (fileId: string) => Promise<Uint8Array>;
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
const notesSummarizeBtn = document.getElementById("notes-summarize") as HTMLButtonElement;
const notesSummaryEl = document.getElementById("notes-summary") as HTMLDivElement;
const notesSummaryTextEl = document.getElementById("notes-summary-text") as HTMLParagraphElement;
const notesSummaryCloseBtn = document.getElementById("notes-summary-close") as HTMLButtonElement;

const aiChatBtn = document.getElementById("ai-chat-btn") as HTMLButtonElement;
const aiChatPanel = document.getElementById("ai-chat-panel") as HTMLDivElement;
const aiChatCloseBtn = document.getElementById("ai-chat-close") as HTMLButtonElement;
const aiChatStatusEl = document.getElementById("ai-chat-status") as HTMLDivElement;
const aiChatMessagesEl = document.getElementById("ai-chat-messages") as HTMLDivElement;
const aiChatInputEl = document.getElementById("ai-chat-input") as HTMLInputElement;
const aiChatSendBtn = document.getElementById("ai-chat-send") as HTMLButtonElement;

const pdfViewerEl = document.getElementById("pdf-viewer") as HTMLDivElement;
const pdfCanvasEl = document.getElementById("pdf-canvas") as HTMLCanvasElement;
const pdfPageIndicatorEl = document.getElementById("pdf-page-indicator") as HTMLSpanElement;
const pdfPrevPageBtn = document.getElementById("pdf-prev-page") as HTMLButtonElement;
const pdfNextPageBtn = document.getElementById("pdf-next-page") as HTMLButtonElement;
const pdfRotateBtn = document.getElementById("pdf-rotate") as HTMLButtonElement;
const pdfMoveLeftBtn = document.getElementById("pdf-move-left") as HTMLButtonElement;
const pdfMoveRightBtn = document.getElementById("pdf-move-right") as HTMLButtonElement;
const pdfSplitBtn = document.getElementById("pdf-split") as HTMLButtonElement;
const pdfMergeBtn = document.getElementById("pdf-merge") as HTMLButtonElement;
const pdfSummarizeBtn = document.getElementById("pdf-summarize") as HTMLButtonElement;
const pdfExtractTableBtn = document.getElementById("pdf-extract-table") as HTMLButtonElement;
const pdfStatusEl = document.getElementById("pdf-status") as HTMLDivElement;
const pdfSummaryEl = document.getElementById("pdf-summary") as HTMLDivElement;
const pdfSummaryTitleEl = document.getElementById("pdf-summary-title") as HTMLElement;
const pdfSummaryTextEl = document.getElementById("pdf-summary-text") as HTMLParagraphElement;
const pdfSummaryCloseBtn = document.getElementById("pdf-summary-close") as HTMLButtonElement;
const pdfQaInputEl = document.getElementById("pdf-qa-input") as HTMLInputElement;
const pdfQaAskBtn = document.getElementById("pdf-qa-ask") as HTMLButtonElement;

const wordEditorEl = document.getElementById("word-editor") as HTMLDivElement;
const wordContentEl = document.getElementById("word-content") as HTMLDivElement;
const wordBlockTypeEl = document.getElementById("word-block-type") as HTMLSelectElement;
const wordBoldBtn = document.getElementById("word-bold") as HTMLButtonElement;
const wordItalicBtn = document.getElementById("word-italic") as HTMLButtonElement;
const wordUnderlineBtn = document.getElementById("word-underline") as HTMLButtonElement;
const wordBulletListBtn = document.getElementById("word-bullet-list") as HTMLButtonElement;
const wordNumberListBtn = document.getElementById("word-number-list") as HTMLButtonElement;
const wordInsertTableBtn = document.getElementById("word-insert-table") as HTMLButtonElement;
const wordSummarizeBtn = document.getElementById("word-summarize") as HTMLButtonElement;
const wordRewriteBtn = document.getElementById("word-rewrite") as HTMLButtonElement;
const wordToneBtn = document.getElementById("word-tone") as HTMLButtonElement;
const wordExportFormatEl = document.getElementById("word-export-format") as HTMLSelectElement;
const wordExportBtn = document.getElementById("word-export") as HTMLButtonElement;
const wordSaveBtn = document.getElementById("word-save") as HTMLButtonElement;
const wordSaveStatusEl = document.getElementById("word-save-status") as HTMLSpanElement;
const wordWarningsEl = document.getElementById("word-warnings") as HTMLDivElement;
const wordSummaryEl = document.getElementById("word-summary") as HTMLDivElement;
const wordSummaryTitleEl = document.getElementById("word-summary-title") as HTMLElement;
const wordSummaryTextEl = document.getElementById("word-summary-text") as HTMLParagraphElement;
const wordSummaryCloseBtn = document.getElementById("word-summary-close") as HTMLButtonElement;

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
  pdfViewerEl.hidden = true;
  wordEditorEl.hidden = true;
}

function showGenericContent(text: string): void {
  emptyStateEl.hidden = true;
  contentViewEl.hidden = false;
  notesEditorEl.hidden = true;
  pdfViewerEl.hidden = true;
  wordEditorEl.hidden = true;
  contentViewEl.textContent = text;
}

function showNotesEditor(file: DocumentRecord, data: NotesData): void {
  emptyStateEl.hidden = true;
  contentViewEl.hidden = true;
  notesEditorEl.hidden = false;
  pdfViewerEl.hidden = true;
  wordEditorEl.hidden = true;

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
  notesSummaryEl.hidden = true;
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
  } else if (result.rendered.kind === "pdf") {
    await showPdfViewer(file, result.rendered.data as PdfData);
  } else if (result.rendered.kind === "word") {
    showWordEditor(file, result.rendered.data as WordData);
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

async function summarizeCurrentNote(): Promise<void> {
  if (!currentOpenFileId) return;
  notesSummarizeBtn.disabled = true;
  notesSummarizeBtn.textContent = "Summarizing...";
  const result = await window.docstew.aiRunTool(currentOpenFileId, "summarize");
  notesSummarizeBtn.disabled = false;
  notesSummarizeBtn.textContent = "Summarize";

  notesSummaryEl.hidden = false;
  if (result.success) {
    const { summary } = result.result as { summary: string };
    notesSummaryTextEl.textContent = summary;
  } else {
    notesSummaryTextEl.textContent = `Error: ${result.error}`;
  }
}

notesTogglePreviewBtn.addEventListener("click", () => void toggleNotesPreview());
notesSaveBtn.addEventListener("click", () => void saveCurrentNote());
notesSummarizeBtn.addEventListener("click", () => void summarizeCurrentNote());
notesSummaryCloseBtn.addEventListener("click", () => {
  notesSummaryEl.hidden = true;
});

// ---- PDF viewer ----

interface Window {
  pdfjsLib?: any;
}

// pdfjs-dist ships ESM-only, and this file is deliberately a classic
// (non-module) script (see the top of the file), so it can't `import` pdfjs
// directly. A `new Function("s", "return import(s)")` trick would work
// around TypeScript downleveling a literal import() back to require() — but
// `new Function` is itself blocked by this app's CSP (no 'unsafe-eval'),
// which would silently abort this entire script's execution at load time.
// pdfjs-loader.mjs (loaded via a real <script type="module"> tag in
// index.html) does the actual import and exposes the result here instead —
// a genuine static import needs no eval and is allowed under `default-src
// 'self'`. Module scripts execute after classic scripts have started, so
// this polls briefly rather than assuming it's already set.
async function getPdfjsLib(): Promise<any> {
  for (let i = 0; i < 100 && !window.pdfjsLib; i++) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (!window.pdfjsLib) throw new Error("pdf.js failed to load.");
  return window.pdfjsLib;
}

let currentPdfDoc: any = null;
let currentPdfPageNum = 1;
let currentPdfFileId: string | undefined;

async function loadAndRenderPdf(): Promise<void> {
  if (!currentPdfFileId) return;
  const bytes = await window.docstew.pdfReadBytes(currentPdfFileId);
  const lib = await getPdfjsLib();
  currentPdfDoc = await lib.getDocument({
    data: bytes,
    cMapUrl: "./pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "./pdfjs/standard_fonts/",
  }).promise;
  const maxPage = currentPdfDoc.numPages;
  if (currentPdfPageNum > maxPage) currentPdfPageNum = maxPage;
  await renderCurrentPdfPage();
}

async function renderCurrentPdfPage(): Promise<void> {
  if (!currentPdfDoc) return;
  const page = await currentPdfDoc.getPage(currentPdfPageNum);
  const viewport = page.getViewport({ scale: 1.3 });
  const context = pdfCanvasEl.getContext("2d")!;
  pdfCanvasEl.width = viewport.width;
  pdfCanvasEl.height = viewport.height;
  await page.render({ canvasContext: context, viewport }).promise;
  pdfPageIndicatorEl.textContent = `Page ${currentPdfPageNum} of ${currentPdfDoc.numPages}`;
}

async function showPdfViewer(file: DocumentRecord, data: PdfData): Promise<void> {
  emptyStateEl.hidden = true;
  contentViewEl.hidden = true;
  notesEditorEl.hidden = true;
  pdfViewerEl.hidden = false;
  wordEditorEl.hidden = true;

  currentPdfFileId = file.id;
  currentPdfPageNum = 1;
  currentPdfDoc = null;
  pdfSummaryEl.hidden = true;
  pdfStatusEl.textContent = `${data.pageCount} page(s)`;

  await loadAndRenderPdf();
}

async function runPdfOperation(opName: string, args: Record<string, unknown>): Promise<boolean> {
  if (!currentPdfFileId) return false;
  const result = await window.docstew.runOperation(currentPdfFileId, opName, args);
  if (!result.success) {
    pdfStatusEl.textContent = `Error: ${result.error}`;
    return false;
  }
  return true;
}

pdfPrevPageBtn.addEventListener("click", () => {
  if (currentPdfPageNum > 1) {
    currentPdfPageNum--;
    void renderCurrentPdfPage();
  }
});

pdfNextPageBtn.addEventListener("click", () => {
  if (currentPdfDoc && currentPdfPageNum < currentPdfDoc.numPages) {
    currentPdfPageNum++;
    void renderCurrentPdfPage();
  }
});

pdfRotateBtn.addEventListener("click", async () => {
  const ok = await runPdfOperation("rotatePage", { pageIndex: currentPdfPageNum - 1, degrees: 90 });
  if (ok) {
    pdfStatusEl.textContent = "Rotated.";
    await loadAndRenderPdf();
    await refreshFileList();
  }
});

pdfMoveLeftBtn.addEventListener("click", async () => {
  if (currentPdfPageNum <= 1) return;
  const ok = await runPdfOperation("swapPages", { indexA: currentPdfPageNum - 1, indexB: currentPdfPageNum - 2 });
  if (ok) {
    currentPdfPageNum--;
    pdfStatusEl.textContent = "Moved.";
    await loadAndRenderPdf();
    await refreshFileList();
  }
});

pdfMoveRightBtn.addEventListener("click", async () => {
  if (!currentPdfDoc || currentPdfPageNum >= currentPdfDoc.numPages) return;
  const ok = await runPdfOperation("swapPages", { indexA: currentPdfPageNum - 1, indexB: currentPdfPageNum });
  if (ok) {
    currentPdfPageNum++;
    pdfStatusEl.textContent = "Moved.";
    await loadAndRenderPdf();
    await refreshFileList();
  }
});

pdfSplitBtn.addEventListener("click", async () => {
  if (!currentPdfFileId) return;
  const result = await window.docstew.runOperation(currentPdfFileId, "split", { atPageIndex: currentPdfPageNum - 1 });
  if (result.success && result.newFiles) {
    pdfStatusEl.textContent = `Split into ${result.newFiles.map((f) => f.fileName).join(" and ")}.`;
    await refreshFileList();
  } else {
    pdfStatusEl.textContent = `Error: ${result.error}`;
  }
});

async function summarizeCurrentPdf(): Promise<void> {
  if (!currentPdfFileId) return;
  pdfSummarizeBtn.disabled = true;
  pdfSummarizeBtn.textContent = "Summarizing...";
  const result = await window.docstew.aiRunTool(currentPdfFileId, "summarize");
  pdfSummarizeBtn.disabled = false;
  pdfSummarizeBtn.textContent = "Summarize";

  pdfSummaryTitleEl.textContent = "Summary";
  pdfSummaryEl.hidden = false;
  if (result.success) {
    const { summary } = result.result as { summary: string };
    pdfSummaryTextEl.textContent = summary;
  } else {
    pdfSummaryTextEl.textContent = `Error: ${result.error}`;
  }
}

async function extractTableFromCurrentPdf(): Promise<void> {
  if (!currentPdfFileId) return;
  pdfExtractTableBtn.disabled = true;
  pdfExtractTableBtn.textContent = "Extracting...";
  const result = await window.docstew.aiRunTool(currentPdfFileId, "extractTable");
  pdfExtractTableBtn.disabled = false;
  pdfExtractTableBtn.textContent = "Extract Table";

  pdfSummaryTitleEl.textContent = "Extracted Table";
  pdfSummaryEl.hidden = false;
  if (result.success) {
    const { table } = result.result as { table: string };
    pdfSummaryTextEl.textContent = table;
  } else {
    pdfSummaryTextEl.textContent = `Error: ${result.error}`;
  }
}

async function askAboutCurrentPdf(): Promise<void> {
  if (!currentPdfFileId) return;
  const question = pdfQaInputEl.value.trim();
  if (!question) return;
  pdfQaAskBtn.disabled = true;
  pdfQaAskBtn.textContent = "Asking...";
  const result = await window.docstew.aiRunTool(currentPdfFileId, "qa", { question });
  pdfQaAskBtn.disabled = false;
  pdfQaAskBtn.textContent = "Ask";

  pdfSummaryTitleEl.textContent = `Q: ${question}`;
  pdfSummaryEl.hidden = false;
  if (result.success) {
    const { answer } = result.result as { answer: string };
    pdfSummaryTextEl.textContent = answer;
  } else {
    pdfSummaryTextEl.textContent = `Error: ${result.error}`;
  }
}

pdfMergeBtn.addEventListener("click", () => openPaletteInMode("pdf-merge-pick", "Pick a PDF to merge with..."));
pdfSummarizeBtn.addEventListener("click", () => void summarizeCurrentPdf());
pdfExtractTableBtn.addEventListener("click", () => void extractTableFromCurrentPdf());
pdfSummaryCloseBtn.addEventListener("click", () => {
  pdfSummaryEl.hidden = true;
});
pdfQaAskBtn.addEventListener("click", () => void askAboutCurrentPdf());
pdfQaInputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    void askAboutCurrentPdf();
  }
});

// ---- Word editor ----

let currentWordFileId: string | undefined;

function showWordEditor(file: DocumentRecord, data: WordData): void {
  emptyStateEl.hidden = true;
  contentViewEl.hidden = true;
  notesEditorEl.hidden = true;
  pdfViewerEl.hidden = true;
  wordEditorEl.hidden = false;

  currentWordFileId = file.id;
  wordContentEl.innerHTML = data.html;
  wordSaveStatusEl.textContent = "";
  wordSummaryEl.hidden = true;

  if (data.warnings.length > 0) {
    wordWarningsEl.hidden = false;
    wordWarningsEl.textContent = `Note: this document uses formatting mammoth flagged as unsupported — ${data.warnings.join("; ")}`;
  } else {
    wordWarningsEl.hidden = true;
  }
}

// Deliberately uses the deprecated-but-still-fully-functional document.execCommand
// rather than a rich-text editor library, matching this project's minimal-deps
// approach — Electron pins a known Chromium version, so execCommand's removal
// risk (a concern for web apps targeting arbitrary browsers) doesn't apply here.
function execWordCommand(command: string, value?: string): void {
  wordContentEl.focus();
  document.execCommand(command, false, value);
}

wordBlockTypeEl.addEventListener("change", () => {
  const tagByValue: Record<string, string> = { p: "P", h1: "H1", h2: "H2", h3: "H3" };
  execWordCommand("formatBlock", tagByValue[wordBlockTypeEl.value] ?? "P");
});
wordBoldBtn.addEventListener("click", () => execWordCommand("bold"));
wordItalicBtn.addEventListener("click", () => execWordCommand("italic"));
wordUnderlineBtn.addEventListener("click", () => execWordCommand("underline"));
wordBulletListBtn.addEventListener("click", () => execWordCommand("insertUnorderedList"));
wordNumberListBtn.addEventListener("click", () => execWordCommand("insertOrderedList"));
wordInsertTableBtn.addEventListener("click", () => {
  execWordCommand(
    "insertHTML",
    "<table><tr><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td></tr></table><p></p>"
  );
});

// ---- Word DOM -> WordBlock[] (mirrors modules/word/wordBlocks.ts) ----

function extractWordRuns(el: HTMLElement): WordRun[] {
  const runs: WordRun[] = [];
  function walk(node: Node, bold: boolean, italic: boolean, underline: boolean): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? "";
      if (text.length > 0) {
        runs.push({ text, bold: bold || undefined, italic: italic || undefined, underline: underline || undefined });
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = (node as HTMLElement).tagName.toLowerCase();
    const nextBold = bold || tag === "b" || tag === "strong";
    const nextItalic = italic || tag === "i" || tag === "em";
    const nextUnderline = underline || tag === "u";
    for (const child of Array.from(node.childNodes)) {
      walk(child, nextBold, nextItalic, nextUnderline);
    }
  }
  walk(el, false, false, false);
  return runs;
}

function wordDomToBlocks(container: HTMLElement): WordBlock[] {
  const blocks: WordBlock[] = [];
  for (const child of Array.from(container.children)) {
    const tag = child.tagName.toLowerCase();
    if (tag === "h1" || tag === "h2" || tag === "h3") {
      blocks.push({ type: "heading", level: Number(tag[1]) as 1 | 2 | 3, runs: extractWordRuns(child as HTMLElement) });
    } else if (tag === "p") {
      blocks.push({ type: "paragraph", runs: extractWordRuns(child as HTMLElement) });
    } else if (tag === "ul") {
      for (const li of Array.from(child.children)) {
        blocks.push({ type: "bulletItem", runs: extractWordRuns(li as HTMLElement) });
      }
    } else if (tag === "ol") {
      for (const li of Array.from(child.children)) {
        blocks.push({ type: "numberItem", runs: extractWordRuns(li as HTMLElement) });
      }
    } else if (tag === "table") {
      const rows: WordRun[][][] = [];
      for (const tr of Array.from(child.querySelectorAll("tr"))) {
        rows.push(Array.from(tr.querySelectorAll("td, th")).map((cell) => extractWordRuns(cell as HTMLElement)));
      }
      blocks.push({ type: "table", rows });
    }
  }
  return blocks;
}

async function saveCurrentWordDoc(): Promise<void> {
  if (!currentWordFileId) return;
  const blocks = wordDomToBlocks(wordContentEl);
  wordSaveStatusEl.textContent = "Saving...";
  const result = await window.docstew.saveFile(currentWordFileId, { blocks });
  if (result.success) {
    wordSaveStatusEl.textContent = "Saved";
    await refreshFileList();
  } else {
    wordSaveStatusEl.textContent = `Error: ${result.error}`;
  }
}

async function summarizeCurrentWordDoc(): Promise<void> {
  if (!currentWordFileId) return;
  wordSummarizeBtn.disabled = true;
  wordSummarizeBtn.textContent = "Summarizing...";
  const result = await window.docstew.aiRunTool(currentWordFileId, "summarize");
  wordSummarizeBtn.disabled = false;
  wordSummarizeBtn.textContent = "Summarize";

  wordSummaryTitleEl.textContent = "Summary";
  wordSummaryEl.hidden = false;
  wordSummaryTextEl.textContent = result.success
    ? (result.result as { summary: string }).summary
    : `Error: ${result.error}`;
}

async function rewriteCurrentWordDoc(): Promise<void> {
  if (!currentWordFileId) return;
  const instruction = window.prompt("Rewrite instruction (leave blank to just improve clarity):", "") ?? undefined;
  wordRewriteBtn.disabled = true;
  wordRewriteBtn.textContent = "Rewriting...";
  const result = await window.docstew.aiRunTool(currentWordFileId, "rewrite", { instruction });
  wordRewriteBtn.disabled = false;
  wordRewriteBtn.textContent = "Rewrite";

  wordSummaryTitleEl.textContent = "Rewrite Suggestion";
  wordSummaryEl.hidden = false;
  wordSummaryTextEl.textContent = result.success
    ? (result.result as { rewritten: string }).rewritten
    : `Error: ${result.error}`;
}

async function adjustToneOfCurrentWordDoc(): Promise<void> {
  if (!currentWordFileId) return;
  const tone = window.prompt("Adjust tone to:", "more formal");
  if (!tone) return;
  wordToneBtn.disabled = true;
  wordToneBtn.textContent = "Adjusting...";
  const result = await window.docstew.aiRunTool(currentWordFileId, "toneAdjust", { tone });
  wordToneBtn.disabled = false;
  wordToneBtn.textContent = "Adjust Tone";

  wordSummaryTitleEl.textContent = `Tone: ${tone}`;
  wordSummaryEl.hidden = false;
  wordSummaryTextEl.textContent = result.success
    ? (result.result as { rewritten: string }).rewritten
    : `Error: ${result.error}`;
}

async function exportCurrentWordDoc(): Promise<void> {
  if (!currentWordFileId) return;
  const format = wordExportFormatEl.value;
  wordExportBtn.disabled = true;
  wordExportBtn.textContent = "Exporting...";
  const result = await window.docstew.exportFile(currentWordFileId, format);
  wordExportBtn.disabled = false;
  wordExportBtn.textContent = "Export";
  if (result.success && result.file) {
    wordSaveStatusEl.textContent = `Exported to ${result.file.fileName}`;
    await refreshFileList();
  } else {
    wordSaveStatusEl.textContent = `Export error: ${result.error}`;
  }
}

wordSaveBtn.addEventListener("click", () => void saveCurrentWordDoc());
wordExportBtn.addEventListener("click", () => void exportCurrentWordDoc());
wordSummarizeBtn.addEventListener("click", () => void summarizeCurrentWordDoc());
wordRewriteBtn.addEventListener("click", () => void rewriteCurrentWordDoc());
wordToneBtn.addEventListener("click", () => void adjustToneOfCurrentWordDoc());
wordSummaryCloseBtn.addEventListener("click", () => {
  wordSummaryEl.hidden = true;
});

// ---- Folder open ----

openFolderBtn.addEventListener("click", async () => {
  const result = await window.docstew.openFolder();
  if (result.success && result.folderPath) {
    currentFolder = result.folderPath;
    await refreshFileList();
  }
});

// ---- Command palette ----

type PaletteMode = "command" | "new-note" | "pdf-merge-pick";
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

  if (paletteMode === "pdf-merge-pick") {
    void renderPdfMergeCandidates(filterText);
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

function openPaletteInMode(mode: PaletteMode, placeholder: string): void {
  palette.hidden = false;
  paletteMode = mode;
  paletteInput.value = "";
  paletteInput.placeholder = placeholder;
  paletteInput.focus();
  renderPaletteResults("");
}

async function renderPdfMergeCandidates(filterText: string): Promise<void> {
  const files = await window.docstew.listFiles();
  const candidates = files.filter(
    (f) =>
      f.extension === ".pdf" &&
      f.id !== currentPdfFileId &&
      (f.title || f.fileName).toLowerCase().includes(filterText.toLowerCase())
  );
  if (paletteMode !== "pdf-merge-pick") return; // mode changed while listFiles() was in flight

  paletteResultsEl.innerHTML = "";
  if (candidates.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No other PDFs found in this library.";
    paletteResultsEl.appendChild(li);
    return;
  }
  for (const candidate of candidates) {
    const li = document.createElement("li");
    li.textContent = candidate.title || candidate.fileName;
    li.addEventListener("click", () => void mergeWithCandidate(candidate));
    paletteResultsEl.appendChild(li);
  }
}

async function mergeWithCandidate(candidate: DocumentRecord): Promise<void> {
  if (!currentPdfFileId) return;
  const result = await window.docstew.runOperation(currentPdfFileId, "merge", { otherFilePath: candidate.filePath });
  togglePalette(false);
  if (result.success && result.newFiles && result.newFiles.length > 0) {
    pdfStatusEl.textContent = `Merged into ${result.newFiles[0].fileName}.`;
    await refreshFileList();
  } else {
    pdfStatusEl.textContent = `Error: ${result.error}`;
  }
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
  } else if (paletteMode === "new-note") {
    void createNoteFromPaletteInput();
  } else if (paletteMode === "pdf-merge-pick") {
    // Reuses the click handler already attached to each rendered candidate —
    // no separate selection-tracking state needed for "pick the first match".
    const first = paletteResultsEl.querySelector("li");
    if (first) (first as HTMLLIElement).click();
  }
});

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    togglePalette(palette.hidden);
  } else if (event.key === "Escape" && !palette.hidden) {
    togglePalette(false);
  } else if (event.key === "Escape" && !aiChatPanel.hidden) {
    toggleAiChat(false);
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && !notesEditorEl.hidden) {
    event.preventDefault();
    void saveCurrentNote();
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && !wordEditorEl.hidden) {
    event.preventDefault();
    void saveCurrentWordDoc();
  }
});

// ---- Ask My Notes (chat panel) ----

async function openSourceFile(documentId: string): Promise<void> {
  const files = await window.docstew.listFiles();
  const match = files.find((f) => f.id === documentId);
  if (match) await selectFile(match);
}

function appendChatMessage(role: "user" | "assistant", text: string, sources?: ChatSource[]): void {
  const bubble = document.createElement("div");
  bubble.className = `chat-message ${role}`;

  const textEl = document.createElement("div");
  textEl.textContent = text;
  bubble.appendChild(textEl);

  if (sources && sources.length > 0) {
    const sourcesEl = document.createElement("div");
    sourcesEl.className = "chat-sources";
    sourcesEl.textContent = "Sources: ";
    sources.forEach((source, i) => {
      const link = document.createElement("a");
      link.href = "#";
      link.textContent = `[${i + 1}] ${source.fileName}`;
      link.style.color = "inherit";
      link.addEventListener("click", (event) => {
        event.preventDefault();
        void openSourceFile(source.documentId);
      });
      sourcesEl.appendChild(link);
      if (i < sources.length - 1) sourcesEl.appendChild(document.createTextNode(", "));
    });
    bubble.appendChild(sourcesEl);
  }

  aiChatMessagesEl.appendChild(bubble);
  aiChatMessagesEl.scrollTop = aiChatMessagesEl.scrollHeight;
}

async function refreshAiStatus(): Promise<void> {
  const status = await window.docstew.aiStatus();
  if (!status.chatModel) {
    aiChatStatusEl.textContent = "No local chat model found. Install Ollama and run: ollama pull llama3.2";
  } else if (!status.embedModel) {
    aiChatStatusEl.textContent = `Chat model: ${status.chatModel}. No embedding model found — run: ollama pull nomic-embed-text`;
  } else {
    aiChatStatusEl.textContent = `Chat: ${status.chatModel} · Embeddings: ${status.embedModel} · ${status.indexedCount} document(s) indexed`;
  }
}

async function sendChatMessage(): Promise<void> {
  const question = aiChatInputEl.value.trim();
  if (!question) return;

  appendChatMessage("user", question);
  aiChatInputEl.value = "";
  aiChatInputEl.disabled = true;
  aiChatSendBtn.disabled = true;

  const result = await window.docstew.aiChat(question);
  if (result.success && result.answer !== undefined) {
    appendChatMessage("assistant", result.answer, result.sources);
  } else {
    appendChatMessage("assistant", `Error: ${result.error}`);
  }

  aiChatInputEl.disabled = false;
  aiChatSendBtn.disabled = false;
  aiChatInputEl.focus();
}

function toggleAiChat(show: boolean): void {
  aiChatPanel.hidden = !show;
  if (show) {
    void refreshAiStatus();
    aiChatInputEl.focus();
  }
}

aiChatBtn.addEventListener("click", () => toggleAiChat(aiChatPanel.hidden));
aiChatCloseBtn.addEventListener("click", () => toggleAiChat(false));
aiChatSendBtn.addEventListener("click", () => void sendChatMessage());
aiChatInputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    void sendChatMessage();
  }
});

refreshFileList();
