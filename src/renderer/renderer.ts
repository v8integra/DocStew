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

interface PdfFormFieldInfo {
  name: string;
  type: "text" | "checkbox" | "unsupported";
  value: string | boolean;
  pageIndex: number;
  rect: { x: number; y: number; width: number; height: number };
}

interface PdfData {
  pageCount: number;
  formFields: PdfFormFieldInfo[];
  pageSizes: Array<{ width: number; height: number }>;
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

interface SheetCell {
  value: string | number | boolean | null;
  formula?: string;
  display: string;
}

interface SheetData {
  sheetNames: string[];
  activeSheetIndex: number;
  activeSheet: {
    name: string;
    rowCount: number;
    colCount: number;
    cells: Record<string, SheetCell>;
  };
}

interface StructuredDataData {
  format: "json" | "xml" | "yaml";
  raw: string;
  valid: boolean;
  error?: string;
  html: string;
}

interface ImageFileData {
  width: number;
  height: number;
  format: string;
  mimeType: string;
  sizeBytes: number;
}

type DiagramShapeType = "rectangle" | "ellipse" | "diamond";

interface DiagramShapeData {
  id: string;
  type: DiagramShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  color: string;
}

interface DiagramConnectorData {
  id: string;
  fromId: string;
  toId: string;
  label: string;
}

interface DiagramDocumentData {
  shapes: DiagramShapeData[];
  connectors: DiagramConnectorData[];
}

interface PresentationSlideData {
  title: string;
  bullets: string[];
}

interface PresentationDocumentData {
  slides: PresentationSlideData[];
}

interface FileVersion {
  id: number;
  documentId: string;
  sizeBytes: number;
  createdAt: number;
}

interface DocStewApi {
  openFolder: (folderPath?: string) => Promise<OpenFolderResult>;
  listFiles: () => Promise<DocumentRecord[]>;
  openFile: (id: string) => Promise<OpenFileResult>;
  saveFile: (id: string, content: unknown) => Promise<SaveFileResult>;
  createFile: (folderPath: string, fileName: string) => Promise<CreateFileResult>;
  runOperation: (fileId: string, opName: string, args?: Record<string, unknown>) => Promise<RunOperationResult>;
  runQuery: (fileId: string, queryName: string, args?: Record<string, unknown>) => Promise<AiRunToolResult>;
  exportFile: (fileId: string, format: string) => Promise<RunOperationResult>;
  listModules: () => Promise<Array<{ id: string; supportedExtensions: string[] }>>;
  renderMarkdownPreview: (markdown: string) => Promise<{ html: string }>;
  aiStatus: () => Promise<AiStatus>;
  aiChat: (question: string) => Promise<AiChatResult>;
  aiRunTool: (fileId: string, toolName: string, args?: Record<string, unknown>) => Promise<AiRunToolResult>;
  pdfReadBytes: (fileId: string) => Promise<Uint8Array>;
  imageReadBytes: (fileId: string) => Promise<Uint8Array>;
  search: (query: string) => Promise<{ results: Array<DocumentRecord & { snippet: string }> }>;
  listVersions: (fileId: string) => Promise<FileVersion[]>;
  restoreVersion: (fileId: string, versionId: number) => Promise<SaveFileResult>;
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
const notesExportFormatEl = document.getElementById("notes-export-format") as HTMLSelectElement;
const notesExportBtn = document.getElementById("notes-export") as HTMLButtonElement;

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
const pdfExportFormatEl = document.getElementById("pdf-export-format") as HTMLSelectElement;
const pdfExportBtn = document.getElementById("pdf-export") as HTMLButtonElement;
const pdfFormOverlayEl = document.getElementById("pdf-form-overlay") as HTMLDivElement;
const pdfFormHintEl = document.getElementById("pdf-form-hint") as HTMLParagraphElement;
const pdfSaveFormBtn = document.getElementById("pdf-save-form") as HTMLButtonElement;

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

const sheetViewerEl = document.getElementById("sheet-viewer") as HTMLDivElement;
const sheetInfoEl = document.getElementById("sheet-info") as HTMLSpanElement;
const sheetGridEl = document.getElementById("sheet-grid") as HTMLTableElement;
const sheetCellRefEl = document.getElementById("sheet-cell-ref") as HTMLSpanElement;
const sheetFormulaBarEl = document.getElementById("sheet-formula-bar") as HTMLInputElement;
const sheetGenerateFormulaBtn = document.getElementById("sheet-generate-formula") as HTMLButtonElement;
const sheetCleanDataBtn = document.getElementById("sheet-clean-data") as HTMLButtonElement;
const sheetExportFormatEl = document.getElementById("sheet-export-format") as HTMLSelectElement;
const sheetExportBtn = document.getElementById("sheet-export") as HTMLButtonElement;
const sheetSummaryEl = document.getElementById("sheet-summary") as HTMLDivElement;
const sheetSummaryTitleEl = document.getElementById("sheet-summary-title") as HTMLElement;
const sheetSummaryTextEl = document.getElementById("sheet-summary-text") as HTMLParagraphElement;
const sheetSummaryCloseBtn = document.getElementById("sheet-summary-close") as HTMLButtonElement;

const sdataEditorEl = document.getElementById("sdata-editor") as HTMLDivElement;
const sdataFormatBadgeEl = document.getElementById("sdata-format-badge") as HTMLSpanElement;
const sdataValidityEl = document.getElementById("sdata-validity") as HTMLSpanElement;
const sdataTogglePreviewBtn = document.getElementById("sdata-toggle-preview") as HTMLButtonElement;
const sdataPrettyPrintBtn = document.getElementById("sdata-pretty-print") as HTMLButtonElement;
const sdataMinifyBtn = document.getElementById("sdata-minify") as HTMLButtonElement;
const sdataExplainBtn = document.getElementById("sdata-explain") as HTMLButtonElement;
const sdataFixBtn = document.getElementById("sdata-fix") as HTMLButtonElement;
const sdataExportFormatEl = document.getElementById("sdata-export-format") as HTMLSelectElement;
const sdataExportBtn = document.getElementById("sdata-export") as HTMLButtonElement;
const sdataHistoryBtn = document.getElementById("sdata-history") as HTMLButtonElement;
const sdataSaveBtn = document.getElementById("sdata-save") as HTMLButtonElement;
const sdataSaveStatusEl = document.getElementById("sdata-save-status") as HTMLSpanElement;
const sdataSummaryEl = document.getElementById("sdata-summary") as HTMLDivElement;
const sdataSummaryTitleEl = document.getElementById("sdata-summary-title") as HTMLElement;
const sdataSummaryTextEl = document.getElementById("sdata-summary-text") as HTMLParagraphElement;
const sdataSummaryCloseBtn = document.getElementById("sdata-summary-close") as HTMLButtonElement;
const sdataRawEl = document.getElementById("sdata-raw") as HTMLTextAreaElement;
const sdataPreviewEl = document.getElementById("sdata-preview") as HTMLDivElement;

const imageViewerEl = document.getElementById("image-viewer") as HTMLDivElement;
const imageInfoEl = document.getElementById("image-info") as HTMLSpanElement;
const imageCanvasEl = document.getElementById("image-canvas") as HTMLImageElement;
const imageCropBtn = document.getElementById("image-crop") as HTMLButtonElement;
const imageResizeBtn = document.getElementById("image-resize") as HTMLButtonElement;
const imageRotateBtn = document.getElementById("image-rotate") as HTMLButtonElement;
const imageAdjustColorBtn = document.getElementById("image-adjust-color") as HTMLButtonElement;
const imageExportFormatEl = document.getElementById("image-export-format") as HTMLSelectElement;
const imageExportBtn = document.getElementById("image-export") as HTMLButtonElement;
const imageHistoryBtn = document.getElementById("image-history") as HTMLButtonElement;

const diagramEditorEl = document.getElementById("diagram-editor") as HTMLDivElement;
const diagramCanvasEl = document.getElementById("diagram-canvas") as unknown as SVGSVGElement;
const diagramAddRectangleBtn = document.getElementById("diagram-add-rectangle") as HTMLButtonElement;
const diagramAddEllipseBtn = document.getElementById("diagram-add-ellipse") as HTMLButtonElement;
const diagramAddDiamondBtn = document.getElementById("diagram-add-diamond") as HTMLButtonElement;
const diagramConnectModeBtn = document.getElementById("diagram-connect-mode") as HTMLButtonElement;
const diagramDeleteSelectedBtn = document.getElementById("diagram-delete-selected") as HTMLButtonElement;
const diagramExportFormatEl = document.getElementById("diagram-export-format") as HTMLSelectElement;
const diagramExportBtn = document.getElementById("diagram-export") as HTMLButtonElement;
const diagramHistoryBtn = document.getElementById("diagram-history") as HTMLButtonElement;
const diagramSaveBtn = document.getElementById("diagram-save") as HTMLButtonElement;
const diagramSaveStatusEl = document.getElementById("diagram-save-status") as HTMLSpanElement;
const diagramHintEl = document.getElementById("diagram-hint") as HTMLParagraphElement;

const presentationEditorEl = document.getElementById("presentation-editor") as HTMLDivElement;
const presentationSlideListEl = document.getElementById("presentation-slide-list") as HTMLDivElement;
const presentationAddSlideBtn = document.getElementById("presentation-add-slide") as HTMLButtonElement;
const presentationExportFormatEl = document.getElementById("presentation-export-format") as HTMLSelectElement;
const presentationExportBtn = document.getElementById("presentation-export") as HTMLButtonElement;
const presentationHistoryBtn = document.getElementById("presentation-history") as HTMLButtonElement;
const presentationSaveBtn = document.getElementById("presentation-save") as HTMLButtonElement;
const presentationSaveStatusEl = document.getElementById("presentation-save-status") as HTMLSpanElement;

const batchHintEl = document.getElementById("batch-hint") as HTMLParagraphElement;
const batchBarEl = document.getElementById("batch-bar") as HTMLDivElement;
const batchCountEl = document.getElementById("batch-count") as HTMLSpanElement;
const batchExportFormatEl = document.getElementById("batch-export-format") as HTMLSelectElement;
const batchExportBtn = document.getElementById("batch-export-btn") as HTMLButtonElement;
const batchClearBtn = document.getElementById("batch-clear-btn") as HTMLButtonElement;

const searchBtn = document.getElementById("search-btn") as HTMLButtonElement;
const searchPanelEl = document.getElementById("search-panel") as HTMLDivElement;
const searchCloseBtn = document.getElementById("search-close") as HTMLButtonElement;
const searchInputEl = document.getElementById("search-input") as HTMLInputElement;
const searchResultsEl = document.getElementById("search-results") as HTMLUListElement;

const historyPanelEl = document.getElementById("history-panel") as HTMLDivElement;
const historyCloseBtn = document.getElementById("history-close") as HTMLButtonElement;
const historyListEl = document.getElementById("history-list") as HTMLUListElement;
const notesHistoryBtn = document.getElementById("notes-history") as HTMLButtonElement;
const pdfHistoryBtn = document.getElementById("pdf-history") as HTMLButtonElement;
const wordHistoryBtn = document.getElementById("word-history") as HTMLButtonElement;
const sheetHistoryBtn = document.getElementById("sheet-history") as HTMLButtonElement;

const translationBackdropEl = document.getElementById("translation-backdrop") as HTMLDivElement;
const translationPanelEl = document.getElementById("translation-panel") as HTMLDivElement;
const translationCloseBtn = document.getElementById("translation-close") as HTMLButtonElement;
const translationTitleEl = document.getElementById("translation-title") as HTMLElement;
const translationTargetLabelEl = document.getElementById("translation-target-label") as HTMLElement;
const translationOriginalEl = document.getElementById("translation-original") as HTMLDivElement;
const translationTranslatedEl = document.getElementById("translation-translated") as HTMLDivElement;
const notesTranslateBtn = document.getElementById("notes-translate") as HTMLButtonElement;
const wordTranslateBtn = document.getElementById("word-translate") as HTMLButtonElement;
const sheetTranslateBtn = document.getElementById("sheet-translate") as HTMLButtonElement;

let currentFolder: string | undefined;
let currentOpenFileId: string | undefined;
// Set by every show*Viewer/Editor function alongside its own type-specific
// variable (currentPdfFileId, currentWordFileId, etc.) — History is a
// cross-cutting feature that needs to know "whatever's open right now"
// without caring which viewer that is.
let currentViewedFileId: string | undefined;
let notesPreviewMode = false;

// ---- Sidebar / library ----

let lastRenderedFiles: DocumentRecord[] = [];
const batchSelectedIds = new Set<string>();

function renderFileList(files: DocumentRecord[]): void {
  lastRenderedFiles = files;
  fileListEl.innerHTML = "";
  for (const file of files) {
    const li = document.createElement("li");
    li.dataset.id = file.id;
    li.classList.toggle("batch-selected", batchSelectedIds.has(file.id));

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

    li.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey) {
        toggleBatchSelect(file.id);
      } else {
        void selectFile(file);
      }
    });
    fileListEl.appendChild(li);
  }
}

// ---- Batch selection / batch export ----

function toggleBatchSelect(fileId: string): void {
  if (batchSelectedIds.has(fileId)) {
    batchSelectedIds.delete(fileId);
  } else {
    batchSelectedIds.add(fileId);
  }
  renderFileList(lastRenderedFiles);
  updateBatchBar();
}

function updateBatchBar(): void {
  const count = batchSelectedIds.size;
  batchBarEl.hidden = count === 0;
  batchHintEl.hidden = count > 0;
  batchCountEl.textContent = `${count} file${count === 1 ? "" : "s"} selected`;
}

function clearBatchSelection(): void {
  batchSelectedIds.clear();
  renderFileList(lastRenderedFiles);
  updateBatchBar();
}

async function batchExportSelected(): Promise<void> {
  const format = batchExportFormatEl.value;
  const ids = Array.from(batchSelectedIds);
  batchExportBtn.disabled = true;
  batchExportBtn.textContent = "Exporting...";

  let succeeded = 0;
  const failures: string[] = [];
  for (const id of ids) {
    const file = lastRenderedFiles.find((f) => f.id === id);
    const result = await window.docstew.exportFile(id, format);
    if (result.success) {
      succeeded++;
    } else {
      failures.push(`${file?.fileName ?? id}: ${result.error}`);
    }
  }

  batchExportBtn.disabled = false;
  batchExportBtn.textContent = "Export";
  batchCountEl.textContent =
    failures.length === 0
      ? `Exported ${succeeded} file${succeeded === 1 ? "" : "s"}.`
      : `Exported ${succeeded}, failed ${failures.length}: ${failures.join("; ")}`;

  await refreshFileList();
}

searchBtn.addEventListener("click", () => toggleSearchPanel(searchPanelEl.hidden));
batchClearBtn.addEventListener("click", () => clearBatchSelection());
batchExportBtn.addEventListener("click", () => void batchExportSelected());

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
  sheetViewerEl.hidden = true;
  sdataEditorEl.hidden = true;
  imageViewerEl.hidden = true;
  diagramEditorEl.hidden = true;
  presentationEditorEl.hidden = true;
}

function showGenericContent(text: string): void {
  emptyStateEl.hidden = true;
  contentViewEl.hidden = false;
  notesEditorEl.hidden = true;
  pdfViewerEl.hidden = true;
  wordEditorEl.hidden = true;
  sheetViewerEl.hidden = true;
  sdataEditorEl.hidden = true;
  imageViewerEl.hidden = true;
  diagramEditorEl.hidden = true;
  presentationEditorEl.hidden = true;
  contentViewEl.textContent = text;
}

function showNotesEditor(file: DocumentRecord, data: NotesData): void {
  emptyStateEl.hidden = true;
  contentViewEl.hidden = true;
  notesEditorEl.hidden = false;
  pdfViewerEl.hidden = true;
  wordEditorEl.hidden = true;
  sheetViewerEl.hidden = true;
  sdataEditorEl.hidden = true;
  imageViewerEl.hidden = true;
  diagramEditorEl.hidden = true;
  presentationEditorEl.hidden = true;

  currentOpenFileId = file.id;
  currentViewedFileId = file.id;
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
  } else if (result.rendered.kind === "spreadsheet") {
    showSheetViewer(file, result.rendered.data as SheetData);
  } else if (result.rendered.kind === "structured-data") {
    showSdataEditor(file, result.rendered.data as StructuredDataData);
  } else if (result.rendered.kind === "image") {
    await showImageViewer(file, result.rendered.data as ImageFileData);
  } else if (result.rendered.kind === "diagram") {
    showDiagramEditor(file, result.rendered.data as DiagramDocumentData);
  } else if (result.rendered.kind === "presentation") {
    showPresentationEditor(file, result.rendered.data as PresentationDocumentData);
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

async function exportCurrentNote(): Promise<void> {
  if (!currentOpenFileId) return;
  const format = notesExportFormatEl.value;
  notesExportBtn.disabled = true;
  notesExportBtn.textContent = "Exporting...";
  const result = await window.docstew.exportFile(currentOpenFileId, format);
  notesExportBtn.disabled = false;
  notesExportBtn.textContent = "Export";
  if (result.success && result.file) {
    notesSaveStatusEl.textContent = `Exported to ${result.file.fileName}`;
    await refreshFileList();
  } else {
    notesSaveStatusEl.textContent = `Export error: ${result.error}`;
  }
}

notesTogglePreviewBtn.addEventListener("click", () => void toggleNotesPreview());
notesSaveBtn.addEventListener("click", () => void saveCurrentNote());
notesExportBtn.addEventListener("click", () => void exportCurrentNote());
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
let currentPdfFormFields: PdfFormFieldInfo[] = [];
let currentPdfFieldValues: Record<string, string | boolean> = {};

// pdf-lib's field rects are in PDF user-space (origin bottom-left, points).
// pdfjs's viewport knows how to correctly map that into canvas pixel-space
// while accounting for page rotation and the render scale — reimplementing
// that math by hand (flipping y against page height) would silently break
// on any rotated page, so this defers to pdfjs's own conversion instead.
function pdfRectToOverlayBox(
  rect: { x: number; y: number; width: number; height: number },
  viewport: any
): { left: number; top: number; width: number; height: number } {
  const [vx1, vy1] = viewport.convertToViewportPoint(rect.x, rect.y);
  const [vx2, vy2] = viewport.convertToViewportPoint(rect.x + rect.width, rect.y + rect.height);
  return {
    left: Math.min(vx1, vx2),
    top: Math.min(vy1, vy2),
    width: Math.abs(vx2 - vx1),
    height: Math.abs(vy2 - vy1),
  };
}

function renderPdfFormOverlay(viewport: any): void {
  pdfFormOverlayEl.innerHTML = "";
  const fieldsOnPage = currentPdfFormFields.filter((f) => f.pageIndex === currentPdfPageNum - 1);
  for (const field of fieldsOnPage) {
    if (field.type === "unsupported") continue;
    const box = pdfRectToOverlayBox(field.rect, viewport);
    const input = document.createElement("input");
    input.className = `pdf-form-field pdf-form-field-${field.type}`;
    input.style.left = `${box.left}px`;
    input.style.top = `${box.top}px`;
    input.style.width = `${box.width}px`;
    input.style.height = `${box.height}px`;

    if (field.type === "checkbox") {
      input.type = "checkbox";
      input.checked = Boolean(currentPdfFieldValues[field.name] ?? field.value);
      input.addEventListener("change", () => {
        currentPdfFieldValues[field.name] = input.checked;
      });
    } else {
      input.type = "text";
      input.value = String(currentPdfFieldValues[field.name] ?? field.value ?? "");
      input.addEventListener("input", () => {
        currentPdfFieldValues[field.name] = input.value;
      });
    }
    pdfFormOverlayEl.appendChild(input);
  }
}

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
  renderPdfFormOverlay(viewport);
}

async function showPdfViewer(file: DocumentRecord, data: PdfData): Promise<void> {
  emptyStateEl.hidden = true;
  contentViewEl.hidden = true;
  notesEditorEl.hidden = true;
  pdfViewerEl.hidden = false;
  wordEditorEl.hidden = true;
  sheetViewerEl.hidden = true;
  sdataEditorEl.hidden = true;
  imageViewerEl.hidden = true;
  diagramEditorEl.hidden = true;
  presentationEditorEl.hidden = true;

  currentPdfFileId = file.id;
  currentViewedFileId = file.id;
  currentPdfPageNum = 1;
  currentPdfDoc = null;
  currentPdfFormFields = data.formFields;
  currentPdfFieldValues = {};
  pdfSummaryEl.hidden = true;
  pdfStatusEl.textContent = `${data.pageCount} page(s)`;
  pdfFormHintEl.hidden = data.formFields.length === 0;
  pdfSaveFormBtn.hidden = data.formFields.length === 0;

  await loadAndRenderPdf();
}

async function saveCurrentPdfForm(): Promise<void> {
  if (!currentPdfFileId) return;
  pdfSaveFormBtn.disabled = true;
  pdfSaveFormBtn.textContent = "Saving...";
  const result = await window.docstew.runOperation(currentPdfFileId, "fillForm", { values: currentPdfFieldValues });
  pdfSaveFormBtn.disabled = false;
  pdfSaveFormBtn.textContent = "Save Form";
  if (result.success) {
    const renderData = (result.result as { renderData: PdfData }).renderData;
    currentPdfFormFields = renderData.formFields;
    pdfStatusEl.textContent = "Form saved.";
    await renderCurrentPdfPage();
    await refreshFileList();
  } else {
    pdfStatusEl.textContent = `Error: ${result.error}`;
  }
}

pdfSaveFormBtn.addEventListener("click", () => void saveCurrentPdfForm());

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

async function exportCurrentPdf(): Promise<void> {
  if (!currentPdfFileId) return;
  const format = pdfExportFormatEl.value;
  pdfExportBtn.disabled = true;
  pdfExportBtn.textContent = "Exporting...";
  const result = await window.docstew.exportFile(currentPdfFileId, format);
  pdfExportBtn.disabled = false;
  pdfExportBtn.textContent = "Export";
  if (result.success && result.file) {
    pdfStatusEl.textContent = `Exported to ${result.file.fileName}`;
    await refreshFileList();
  } else {
    pdfStatusEl.textContent = `Export error: ${result.error}`;
  }
}

pdfMergeBtn.addEventListener("click", () => openPaletteInMode("pdf-merge-pick", "Pick a PDF to merge with..."));
pdfExportBtn.addEventListener("click", () => void exportCurrentPdf());
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
  sheetViewerEl.hidden = true;
  sdataEditorEl.hidden = true;
  imageViewerEl.hidden = true;
  diagramEditorEl.hidden = true;
  presentationEditorEl.hidden = true;

  currentWordFileId = file.id;
  currentViewedFileId = file.id;
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

// ---- Spreadsheet viewer ----

let currentSheetFileId: string | undefined;
let currentSheetData: SheetData | undefined;
let selectedCellRef: string | undefined;

function colLetter(col: number): string {
  let letters = "";
  let n = col;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function renderSheetGrid(data: SheetData): void {
  const { activeSheet } = data;
  sheetGridEl.innerHTML = "";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const corner = document.createElement("th");
  corner.className = "corner-header";
  headerRow.appendChild(corner);
  for (let col = 1; col <= activeSheet.colCount; col++) {
    const th = document.createElement("th");
    th.textContent = colLetter(col);
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  sheetGridEl.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (let row = 1; row <= activeSheet.rowCount; row++) {
    const tr = document.createElement("tr");
    const rowHeader = document.createElement("th");
    rowHeader.className = "row-header";
    rowHeader.textContent = String(row);
    tr.appendChild(rowHeader);
    for (let col = 1; col <= activeSheet.colCount; col++) {
      const ref = `${colLetter(col)}${row}`;
      const td = document.createElement("td");
      td.dataset.ref = ref;
      const cell = activeSheet.cells[ref];
      td.textContent = cell ? cell.display : "";
      if (ref === selectedCellRef) td.classList.add("selected");
      td.addEventListener("click", () => selectCell(ref));
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  sheetGridEl.appendChild(tbody);
}

function selectCell(ref: string): void {
  selectedCellRef = ref;
  sheetCellRefEl.textContent = ref;
  sheetFormulaBarEl.disabled = false;
  const cell = currentSheetData?.activeSheet.cells[ref];
  sheetFormulaBarEl.value = cell ? (cell.formula !== undefined ? `=${cell.formula}` : String(cell.value ?? "")) : "";
  sheetFormulaBarEl.focus();
  for (const td of sheetGridEl.querySelectorAll("td")) {
    (td as HTMLElement).classList.toggle("selected", (td as HTMLElement).dataset.ref === ref);
  }
}

function showSheetViewer(file: DocumentRecord, data: SheetData): void {
  emptyStateEl.hidden = true;
  contentViewEl.hidden = true;
  notesEditorEl.hidden = true;
  pdfViewerEl.hidden = true;
  wordEditorEl.hidden = true;
  sheetViewerEl.hidden = false;
  sdataEditorEl.hidden = true;
  imageViewerEl.hidden = true;
  diagramEditorEl.hidden = true;
  presentationEditorEl.hidden = true;

  currentSheetFileId = file.id;
  currentViewedFileId = file.id;
  currentSheetData = data;
  selectedCellRef = undefined;
  sheetCellRefEl.textContent = "—";
  sheetFormulaBarEl.value = "";
  sheetFormulaBarEl.disabled = true;
  sheetSummaryEl.hidden = true;
  sheetInfoEl.textContent =
    data.sheetNames.length > 1
      ? `Showing "${data.activeSheet.name}" (1 of ${data.sheetNames.length} sheets in this workbook)`
      : `Sheet: ${data.activeSheet.name}`;

  renderSheetGrid(data);
}

async function commitFormulaBar(): Promise<void> {
  if (!currentSheetFileId || !selectedCellRef) return;
  const ref = selectedCellRef;
  const result = await window.docstew.runOperation(currentSheetFileId, "setCell", {
    ref,
    input: sheetFormulaBarEl.value,
  });
  if (result.success && result.result) {
    currentSheetData = (result.result as { renderData: SheetData }).renderData;
    renderSheetGrid(currentSheetData);
    selectCell(ref);
  } else {
    sheetInfoEl.textContent = `Error: ${result.error}`;
  }
}

sheetFormulaBarEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    void commitFormulaBar();
  } else if (event.key === "Escape" && selectedCellRef) {
    selectCell(selectedCellRef);
  }
});

async function generateFormulaForSheet(): Promise<void> {
  if (!currentSheetFileId) return;
  const instruction = window.prompt("Describe the formula you want (plain English):", "");
  if (!instruction) return;
  sheetGenerateFormulaBtn.disabled = true;
  sheetGenerateFormulaBtn.textContent = "Generating...";
  const result = await window.docstew.aiRunTool(currentSheetFileId, "generateFormula", { instruction });
  sheetGenerateFormulaBtn.disabled = false;
  sheetGenerateFormulaBtn.textContent = "Generate Formula";

  sheetSummaryTitleEl.textContent = "Generated Formula";
  sheetSummaryEl.hidden = false;
  sheetSummaryTextEl.textContent = result.success
    ? (result.result as { formula: string }).formula
    : `Error: ${result.error}`;
}

async function cleanSheetData(): Promise<void> {
  if (!currentSheetFileId) return;
  sheetCleanDataBtn.disabled = true;
  sheetCleanDataBtn.textContent = "Analyzing...";
  const result = await window.docstew.aiRunTool(currentSheetFileId, "cleanData");
  sheetCleanDataBtn.disabled = false;
  sheetCleanDataBtn.textContent = "Clean Data";

  sheetSummaryTitleEl.textContent = "Data Cleanup Report";
  sheetSummaryEl.hidden = false;
  sheetSummaryTextEl.textContent = result.success
    ? (result.result as { report: string }).report
    : `Error: ${result.error}`;
}

async function exportCurrentSheet(): Promise<void> {
  if (!currentSheetFileId) return;
  const format = sheetExportFormatEl.value;
  sheetExportBtn.disabled = true;
  sheetExportBtn.textContent = "Exporting...";
  const result = await window.docstew.exportFile(currentSheetFileId, format);
  sheetExportBtn.disabled = false;
  sheetExportBtn.textContent = "Export";
  if (result.success && result.file) {
    sheetInfoEl.textContent = `Exported to ${result.file.fileName}`;
    await refreshFileList();
  } else {
    sheetInfoEl.textContent = `Export error: ${result.error}`;
  }
}

sheetGenerateFormulaBtn.addEventListener("click", () => void generateFormulaForSheet());
sheetCleanDataBtn.addEventListener("click", () => void cleanSheetData());
sheetExportBtn.addEventListener("click", () => void exportCurrentSheet());
sheetSummaryCloseBtn.addEventListener("click", () => {
  sheetSummaryEl.hidden = true;
});

// ---- Structured Data editor ----

let currentSdataFileId: string | undefined;
let sdataPreviewMode = false;

function showSdataEditor(file: DocumentRecord, data: StructuredDataData): void {
  emptyStateEl.hidden = true;
  contentViewEl.hidden = true;
  notesEditorEl.hidden = true;
  pdfViewerEl.hidden = true;
  wordEditorEl.hidden = true;
  sheetViewerEl.hidden = true;
  sdataEditorEl.hidden = false;

  currentSdataFileId = file.id;
  currentViewedFileId = file.id;
  sdataFormatBadgeEl.textContent = data.format.toUpperCase();
  updateSdataValidity(data.valid, data.error);
  sdataRawEl.value = data.raw;
  sdataPreviewEl.innerHTML = data.html;
  sdataPreviewMode = false;
  sdataRawEl.hidden = false;
  sdataPreviewEl.hidden = true;
  sdataTogglePreviewBtn.textContent = "Preview";
  sdataSaveStatusEl.textContent = "";
  sdataSummaryEl.hidden = true;
}

function updateSdataValidity(valid: boolean, error?: string): void {
  sdataValidityEl.textContent = valid ? "Valid" : `Invalid: ${error}`;
  sdataValidityEl.classList.toggle("sdata-valid", valid);
  sdataValidityEl.classList.toggle("sdata-invalid", !valid);
}

async function validateSdataRaw(): Promise<void> {
  if (!currentSdataFileId) return;
  const result = await window.docstew.runQuery(currentSdataFileId, "prettyPrint", { raw: sdataRawEl.value });
  updateSdataValidity(result.success, result.success ? undefined : result.error);
}

async function toggleSdataPreview(): Promise<void> {
  if (!currentSdataFileId) return;
  sdataPreviewMode = !sdataPreviewMode;
  if (sdataPreviewMode) {
    const result = await window.docstew.runQuery(currentSdataFileId, "highlight", { raw: sdataRawEl.value });
    if (result.success) {
      sdataPreviewEl.innerHTML = (result.result as { html: string }).html;
    }
    sdataRawEl.hidden = true;
    sdataPreviewEl.hidden = false;
    sdataTogglePreviewBtn.textContent = "Edit Source";
  } else {
    sdataRawEl.hidden = false;
    sdataPreviewEl.hidden = true;
    sdataTogglePreviewBtn.textContent = "Preview";
  }
}

async function saveCurrentSdata(): Promise<void> {
  if (!currentSdataFileId) return;
  sdataSaveStatusEl.textContent = "Saving...";
  const result = await window.docstew.saveFile(currentSdataFileId, { raw: sdataRawEl.value });
  if (result.success) {
    sdataSaveStatusEl.textContent = "Saved";
    await validateSdataRaw();
    await refreshFileList();
  } else {
    sdataSaveStatusEl.textContent = `Error: ${result.error}`;
  }
}

async function refreshSdataPreviewIfActive(): Promise<void> {
  if (!currentSdataFileId || !sdataPreviewMode) return;
  const result = await window.docstew.runQuery(currentSdataFileId, "highlight", { raw: sdataRawEl.value });
  if (result.success) sdataPreviewEl.innerHTML = (result.result as { html: string }).html;
}

async function prettyPrintCurrentSdata(): Promise<void> {
  if (!currentSdataFileId) return;
  const result = await window.docstew.runQuery(currentSdataFileId, "prettyPrint", { raw: sdataRawEl.value });
  if (result.success) {
    sdataRawEl.value = (result.result as { raw: string }).raw;
    updateSdataValidity(true);
    await refreshSdataPreviewIfActive();
  } else {
    window.alert(`Could not pretty-print: ${result.error}`);
  }
}

async function minifyCurrentSdata(): Promise<void> {
  if (!currentSdataFileId) return;
  const result = await window.docstew.runQuery(currentSdataFileId, "minify", { raw: sdataRawEl.value });
  if (result.success) {
    sdataRawEl.value = (result.result as { raw: string }).raw;
    updateSdataValidity(true);
    await refreshSdataPreviewIfActive();
  } else {
    window.alert(`Could not minify: ${result.error}`);
  }
}

async function explainCurrentSdataStructure(): Promise<void> {
  if (!currentSdataFileId) return;
  sdataExplainBtn.disabled = true;
  sdataExplainBtn.textContent = "Explaining...";
  const result = await window.docstew.aiRunTool(currentSdataFileId, "explainStructure");
  sdataExplainBtn.disabled = false;
  sdataExplainBtn.textContent = "Explain Structure";

  sdataSummaryTitleEl.textContent = "Structure Explanation";
  sdataSummaryEl.hidden = false;
  sdataSummaryTextEl.textContent = result.success
    ? (result.result as { explanation: string }).explanation
    : `Error: ${result.error}`;
}

async function fixCurrentSdataMalformed(): Promise<void> {
  if (!currentSdataFileId) return;
  sdataFixBtn.disabled = true;
  sdataFixBtn.textContent = "Fixing...";
  const result = await window.docstew.aiRunTool(currentSdataFileId, "fixMalformed");
  sdataFixBtn.disabled = false;
  sdataFixBtn.textContent = "Fix Malformed";

  if (!result.success) {
    window.alert(`Could not fix: ${result.error}`);
    return;
  }
  const { fixed, alreadyValid } = result.result as { fixed: string; alreadyValid: boolean };
  sdataSummaryTitleEl.textContent = alreadyValid ? "Already Valid" : "Suggested Fix";
  sdataSummaryEl.hidden = false;
  sdataSummaryTextEl.textContent = alreadyValid
    ? "This file already parses without errors — nothing to fix."
    : fixed;
}

async function exportCurrentSdata(): Promise<void> {
  if (!currentSdataFileId) return;
  const format = sdataExportFormatEl.value;
  sdataExportBtn.disabled = true;
  sdataExportBtn.textContent = "Exporting...";
  const result = await window.docstew.exportFile(currentSdataFileId, format);
  sdataExportBtn.disabled = false;
  sdataExportBtn.textContent = "Export";
  if (result.success && result.file) {
    sdataSaveStatusEl.textContent = `Exported to ${result.file.fileName}`;
    await refreshFileList();
  } else {
    sdataSaveStatusEl.textContent = `Export error: ${result.error}`;
  }
}

sdataTogglePreviewBtn.addEventListener("click", () => void toggleSdataPreview());
sdataPrettyPrintBtn.addEventListener("click", () => void prettyPrintCurrentSdata());
sdataMinifyBtn.addEventListener("click", () => void minifyCurrentSdata());
sdataExplainBtn.addEventListener("click", () => void explainCurrentSdataStructure());
sdataFixBtn.addEventListener("click", () => void fixCurrentSdataMalformed());
sdataExportBtn.addEventListener("click", () => void exportCurrentSdata());
sdataSaveBtn.addEventListener("click", () => void saveCurrentSdata());
sdataSummaryCloseBtn.addEventListener("click", () => {
  sdataSummaryEl.hidden = true;
});
let sdataValidateDebounce: ReturnType<typeof setTimeout> | undefined;
sdataRawEl.addEventListener("input", () => {
  clearTimeout(sdataValidateDebounce);
  sdataValidateDebounce = setTimeout(() => void validateSdataRaw(), 400);
});

// ---- Image viewer ----

let currentImageFileId: string | undefined;
let currentImageObjectUrl: string | undefined;

async function refreshImageDisplay(): Promise<void> {
  if (!currentImageFileId) return;
  const [bytes, openResult] = await Promise.all([
    window.docstew.imageReadBytes(currentImageFileId),
    window.docstew.openFile(currentImageFileId),
  ]);
  const data = openResult.rendered?.data as ImageFileData | undefined;
  const mimeType = data?.mimeType ?? "application/octet-stream";

  if (currentImageObjectUrl) URL.revokeObjectURL(currentImageObjectUrl);
  currentImageObjectUrl = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeType }));
  imageCanvasEl.src = currentImageObjectUrl;

  if (data) {
    imageInfoEl.textContent = `${data.width} × ${data.height} px · ${data.format.toUpperCase()} · ${formatBytes(data.sizeBytes)}`;
  }
}

async function showImageViewer(file: DocumentRecord, data: ImageFileData): Promise<void> {
  emptyStateEl.hidden = true;
  contentViewEl.hidden = true;
  notesEditorEl.hidden = true;
  pdfViewerEl.hidden = true;
  wordEditorEl.hidden = true;
  sheetViewerEl.hidden = true;
  sdataEditorEl.hidden = true;
  imageViewerEl.hidden = false;

  currentImageFileId = file.id;
  currentViewedFileId = file.id;
  imageInfoEl.textContent = `${data.width} × ${data.height} px · ${data.format.toUpperCase()} · ${formatBytes(data.sizeBytes)}`;
  await refreshImageDisplay();
}

async function cropCurrentImage(): Promise<void> {
  if (!currentImageFileId) return;
  const input = window.prompt("Crop rectangle as x,y,width,height (pixels):", "0,0,100,100");
  if (!input) return;
  const parts = input.split(",").map((s) => Number(s.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    window.alert("Enter four numbers separated by commas: x,y,width,height");
    return;
  }
  const [x, y, width, height] = parts;
  const result = await window.docstew.runOperation(currentImageFileId, "crop", { x, y, width, height });
  if (result.success) {
    await refreshImageDisplay();
    await refreshFileList();
  } else {
    window.alert(`Could not crop: ${result.error}`);
  }
}

async function resizeCurrentImage(): Promise<void> {
  if (!currentImageFileId) return;
  const input = window.prompt(
    "Resize to width,height in pixels (leave one blank to preserve aspect ratio, e.g. '400,'):",
    ""
  );
  if (!input) return;
  const [widthStr, heightStr] = input.split(",");
  const args: Record<string, unknown> = {};
  if (widthStr && widthStr.trim()) args.width = Number(widthStr.trim());
  if (heightStr && heightStr.trim()) args.height = Number(heightStr.trim());
  const result = await window.docstew.runOperation(currentImageFileId, "resize", args);
  if (result.success) {
    await refreshImageDisplay();
    await refreshFileList();
  } else {
    window.alert(`Could not resize: ${result.error}`);
  }
}

async function rotateCurrentImage(): Promise<void> {
  if (!currentImageFileId) return;
  const input = window.prompt("Rotate clockwise by how many degrees?", "90");
  if (!input) return;
  const degrees = Number(input.trim());
  if (!Number.isFinite(degrees)) {
    window.alert("Enter a number.");
    return;
  }
  const result = await window.docstew.runOperation(currentImageFileId, "rotate", { degrees });
  if (result.success) {
    await refreshImageDisplay();
    await refreshFileList();
  } else {
    window.alert(`Could not rotate: ${result.error}`);
  }
}

async function adjustColorOfCurrentImage(): Promise<void> {
  if (!currentImageFileId) return;
  const input = window.prompt("Brightness,Contrast,Saturation multipliers (1 = unchanged):", "1,1,1");
  if (!input) return;
  const parts = input.split(",").map((s) => Number(s.trim()));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    window.alert("Enter three numbers separated by commas: brightness,contrast,saturation");
    return;
  }
  const [brightness, contrast, saturation] = parts;
  const result = await window.docstew.runOperation(currentImageFileId, "adjustColor", {
    brightness,
    contrast,
    saturation,
  });
  if (result.success) {
    await refreshImageDisplay();
    await refreshFileList();
  } else {
    window.alert(`Could not adjust color: ${result.error}`);
  }
}

async function exportCurrentImage(): Promise<void> {
  if (!currentImageFileId) return;
  const format = imageExportFormatEl.value;
  imageExportBtn.disabled = true;
  imageExportBtn.textContent = "Exporting...";
  const result = await window.docstew.exportFile(currentImageFileId, format);
  imageExportBtn.disabled = false;
  imageExportBtn.textContent = "Export";
  if (result.success && result.file) {
    imageInfoEl.textContent = `Exported to ${result.file.fileName}`;
    await refreshFileList();
  } else {
    window.alert(`Export error: ${result.error}`);
  }
}

imageCropBtn.addEventListener("click", () => void cropCurrentImage());
imageResizeBtn.addEventListener("click", () => void resizeCurrentImage());
imageRotateBtn.addEventListener("click", () => void rotateCurrentImage());
imageAdjustColorBtn.addEventListener("click", () => void adjustColorOfCurrentImage());
imageExportBtn.addEventListener("click", () => void exportCurrentImage());

// ---- Diagram editor ----

const DIAGRAM_CANVAS_WIDTH = 1600;
const DIAGRAM_CANVAS_HEIGHT = 1000;
const DIAGRAM_DEFAULT_HINT = diagramHintEl.textContent ?? "";
const SVG_NS = "http://www.w3.org/2000/svg";

let currentDiagramFileId: string | undefined;
let currentDiagramDoc: DiagramDocumentData = { shapes: [], connectors: [] };
let diagramSelectedShapeId: string | undefined;
let diagramSelectedConnectorId: string | undefined;
let diagramConnectMode = false;
let diagramConnectFirstShapeId: string | undefined;

interface DiagramDragState {
  shapeId: string;
  mode: "move" | "resize";
  startPoint: { x: number; y: number };
  origShape: DiagramShapeData;
}
let diagramDragState: DiagramDragState | undefined;

function diagramShapeCenter(shape: DiagramShapeData): { x: number; y: number } {
  return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
}

// Same boundary-point math as modules/diagrams/diagramSvg.ts's server-side
// export renderer — duplicated rather than shared, since the renderer is a
// classic (non-module) script with no import access to main-process code,
// the same reason Word's DOM->block conversion has its own renderer-side
// implementation instead of importing modules/word/wordBlocks.ts.
function diagramBoundaryPoint(shape: DiagramShapeData, dirX: number, dirY: number): { x: number; y: number } {
  const { x: cx, y: cy } = diagramShapeCenter(shape);
  const rx = shape.width / 2 || 1;
  const ry = shape.height / 2 || 1;
  if (dirX === 0 && dirY === 0) return { x: cx, y: cy };
  let scale: number;
  if (shape.type === "ellipse") {
    scale = 1 / Math.sqrt((dirX / rx) ** 2 + (dirY / ry) ** 2);
  } else if (shape.type === "diamond") {
    scale = 1 / (Math.abs(dirX) / rx + Math.abs(dirY) / ry);
  } else {
    scale = 1 / Math.max(Math.abs(dirX) / rx, Math.abs(dirY) / ry);
  }
  return { x: cx + dirX * scale, y: cy + dirY * scale };
}

function diagramCanvasPoint(event: MouseEvent): { x: number; y: number } {
  const rect = diagramCanvasEl.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function startDiagramShapeDrag(event: MouseEvent, shape: DiagramShapeData, mode: "move" | "resize"): void {
  event.preventDefault();
  event.stopPropagation();
  diagramSelectedShapeId = shape.id;
  diagramSelectedConnectorId = undefined;
  diagramDragState = { shapeId: shape.id, mode, startPoint: diagramCanvasPoint(event), origShape: { ...shape } };
  renderDiagramCanvas();
}

function onDiagramShapeClick(shape: DiagramShapeData): void {
  if (diagramConnectMode) {
    if (!diagramConnectFirstShapeId) {
      diagramConnectFirstShapeId = shape.id;
    } else if (diagramConnectFirstShapeId !== shape.id) {
      const label = window.prompt("Connector label (optional):", "") ?? "";
      currentDiagramDoc.connectors.push({
        id: crypto.randomUUID(),
        fromId: diagramConnectFirstShapeId,
        toId: shape.id,
        label,
      });
      diagramConnectMode = false;
      diagramConnectFirstShapeId = undefined;
      diagramConnectModeBtn.classList.remove("active");
      diagramHintEl.textContent = DIAGRAM_DEFAULT_HINT;
    }
    renderDiagramCanvas();
    return;
  }
  diagramSelectedShapeId = shape.id;
  diagramSelectedConnectorId = undefined;
  renderDiagramCanvas();
}

function onDiagramShapeDblClick(shape: DiagramShapeData): void {
  const label = window.prompt("Edit label:", shape.label);
  if (label === null) return;
  shape.label = label;
  renderDiagramCanvas();
}

function renderDiagramCanvas(): void {
  diagramCanvasEl.innerHTML = "";
  diagramCanvasEl.setAttribute("width", String(DIAGRAM_CANVAS_WIDTH));
  diagramCanvasEl.setAttribute("height", String(DIAGRAM_CANVAS_HEIGHT));
  diagramCanvasEl.setAttribute("viewBox", `0 0 ${DIAGRAM_CANVAS_WIDTH} ${DIAGRAM_CANVAS_HEIGHT}`);

  const defs = document.createElementNS(SVG_NS, "defs");
  defs.innerHTML =
    '<marker id="diagram-arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">' +
    '<path d="M0,0 L0,6 L9,3 z" fill="#8a8f98"></path></marker>';
  diagramCanvasEl.appendChild(defs);

  for (const connector of currentDiagramDoc.connectors) {
    const from = currentDiagramDoc.shapes.find((s) => s.id === connector.fromId);
    const to = currentDiagramDoc.shapes.find((s) => s.id === connector.toId);
    if (!from || !to) continue;
    const fromCenter = diagramShapeCenter(from);
    const toCenter = diagramShapeCenter(to);
    const dirX = toCenter.x - fromCenter.x;
    const dirY = toCenter.y - fromCenter.y;
    const p1 = diagramBoundaryPoint(from, dirX, dirY);
    const p2 = diagramBoundaryPoint(to, -dirX, -dirY);
    const isSelected = connector.id === diagramSelectedConnectorId;

    const line = document.createElementNS(SVG_NS, "line");
    line.setAttribute("x1", String(p1.x));
    line.setAttribute("y1", String(p1.y));
    line.setAttribute("x2", String(p2.x));
    line.setAttribute("y2", String(p2.y));
    line.setAttribute("stroke", isSelected ? "#5865f2" : "#8a8f98");
    line.setAttribute("stroke-width", isSelected ? "3" : "2");
    line.setAttribute("marker-end", "url(#diagram-arrow)");
    (line.style as CSSStyleDeclaration).cursor = "pointer";
    line.addEventListener("click", (event) => {
      event.stopPropagation();
      diagramSelectedConnectorId = connector.id;
      diagramSelectedShapeId = undefined;
      renderDiagramCanvas();
    });
    diagramCanvasEl.appendChild(line);

    if (connector.label) {
      const text = document.createElementNS(SVG_NS, "text");
      text.setAttribute("x", String((p1.x + p2.x) / 2));
      text.setAttribute("y", String((p1.y + p2.y) / 2 - 4));
      text.setAttribute("font-size", "11");
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("fill", "#cfd2d8");
      text.textContent = connector.label;
      diagramCanvasEl.appendChild(text);
    }
  }

  for (const shape of currentDiagramDoc.shapes) {
    const isSelected = shape.id === diagramSelectedShapeId;
    const group = document.createElementNS(SVG_NS, "g");
    (group.style as CSSStyleDeclaration).cursor = diagramConnectMode ? "pointer" : "move";

    let shapeEl: SVGElement;
    const { x: cx, y: cy } = diagramShapeCenter(shape);
    if (shape.type === "ellipse") {
      shapeEl = document.createElementNS(SVG_NS, "ellipse");
      shapeEl.setAttribute("cx", String(cx));
      shapeEl.setAttribute("cy", String(cy));
      shapeEl.setAttribute("rx", String(shape.width / 2));
      shapeEl.setAttribute("ry", String(shape.height / 2));
    } else if (shape.type === "diamond") {
      shapeEl = document.createElementNS(SVG_NS, "polygon");
      const points = `${cx},${shape.y} ${shape.x + shape.width},${cy} ${cx},${shape.y + shape.height} ${shape.x},${cy}`;
      shapeEl.setAttribute("points", points);
    } else {
      shapeEl = document.createElementNS(SVG_NS, "rect");
      shapeEl.setAttribute("x", String(shape.x));
      shapeEl.setAttribute("y", String(shape.y));
      shapeEl.setAttribute("width", String(shape.width));
      shapeEl.setAttribute("height", String(shape.height));
      shapeEl.setAttribute("rx", "4");
    }
    shapeEl.setAttribute("fill", shape.color || "#f0f2ff");
    shapeEl.setAttribute("stroke", isSelected ? "#5865f2" : "#3a3c41");
    shapeEl.setAttribute("stroke-width", isSelected ? "2.5" : "1.5");
    group.appendChild(shapeEl);

    if (shape.label) {
      const text = document.createElementNS(SVG_NS, "text");
      text.setAttribute("x", String(cx));
      text.setAttribute("y", String(cy));
      text.setAttribute("font-size", "12");
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dominant-baseline", "middle");
      text.setAttribute("fill", "#111111");
      text.setAttribute("pointer-events", "none");
      text.textContent = shape.label;
      group.appendChild(text);
    }

    group.addEventListener("click", (event) => {
      event.stopPropagation();
      onDiagramShapeClick(shape);
    });
    group.addEventListener("dblclick", (event) => {
      event.stopPropagation();
      onDiagramShapeDblClick(shape);
    });
    group.addEventListener("mousedown", (event) => {
      if (diagramConnectMode) return;
      startDiagramShapeDrag(event, shape, "move");
    });
    diagramCanvasEl.appendChild(group);

    if (isSelected && !diagramConnectMode) {
      const handle = document.createElementNS(SVG_NS, "rect");
      handle.setAttribute("x", String(shape.x + shape.width - 6));
      handle.setAttribute("y", String(shape.y + shape.height - 6));
      handle.setAttribute("width", "12");
      handle.setAttribute("height", "12");
      handle.setAttribute("fill", "#5865f2");
      (handle.style as CSSStyleDeclaration).cursor = "nwse-resize";
      handle.addEventListener("mousedown", (event) => {
        startDiagramShapeDrag(event, shape, "resize");
      });
      diagramCanvasEl.appendChild(handle);
    }
  }
}

function nextDiagramShapePosition(): { x: number; y: number } {
  const n = currentDiagramDoc.shapes.length;
  return { x: 40 + (n % 6) * 130, y: 40 + Math.floor(n / 6) * 100 };
}

function addDiagramShape(type: DiagramShapeType): void {
  const label = window.prompt(`Label for the new ${type}:`, "") ?? "";
  const pos = nextDiagramShapePosition();
  const size = type === "diamond" ? { width: 80, height: 80 } : { width: 100, height: 50 };
  const shape: DiagramShapeData = {
    id: crypto.randomUUID(),
    type,
    x: pos.x,
    y: pos.y,
    width: size.width,
    height: size.height,
    label,
    color: "#f0f2ff",
  };
  currentDiagramDoc.shapes.push(shape);
  diagramSelectedShapeId = shape.id;
  diagramSelectedConnectorId = undefined;
  renderDiagramCanvas();
}

function toggleDiagramConnectMode(): void {
  diagramConnectMode = !diagramConnectMode;
  diagramConnectFirstShapeId = undefined;
  diagramConnectModeBtn.classList.toggle("active", diagramConnectMode);
  diagramHintEl.textContent = diagramConnectMode
    ? "Connect mode: click a shape, then click another to link them."
    : DIAGRAM_DEFAULT_HINT;
  renderDiagramCanvas();
}

function deleteDiagramSelection(): void {
  if (diagramSelectedShapeId) {
    const id = diagramSelectedShapeId;
    currentDiagramDoc.shapes = currentDiagramDoc.shapes.filter((s) => s.id !== id);
    currentDiagramDoc.connectors = currentDiagramDoc.connectors.filter((c) => c.fromId !== id && c.toId !== id);
    diagramSelectedShapeId = undefined;
  } else if (diagramSelectedConnectorId) {
    const id = diagramSelectedConnectorId;
    currentDiagramDoc.connectors = currentDiagramDoc.connectors.filter((c) => c.id !== id);
    diagramSelectedConnectorId = undefined;
  }
  renderDiagramCanvas();
}

function showDiagramEditor(file: DocumentRecord, data: DiagramDocumentData): void {
  emptyStateEl.hidden = true;
  contentViewEl.hidden = true;
  notesEditorEl.hidden = true;
  pdfViewerEl.hidden = true;
  wordEditorEl.hidden = true;
  sheetViewerEl.hidden = true;
  sdataEditorEl.hidden = true;
  imageViewerEl.hidden = true;
  diagramEditorEl.hidden = false;

  currentDiagramFileId = file.id;
  currentViewedFileId = file.id;
  currentDiagramDoc = data;
  diagramSelectedShapeId = undefined;
  diagramSelectedConnectorId = undefined;
  diagramConnectMode = false;
  diagramConnectFirstShapeId = undefined;
  diagramConnectModeBtn.classList.remove("active");
  diagramHintEl.textContent = DIAGRAM_DEFAULT_HINT;
  diagramSaveStatusEl.textContent = "";
  renderDiagramCanvas();
}

async function saveCurrentDiagram(): Promise<void> {
  if (!currentDiagramFileId) return;
  diagramSaveStatusEl.textContent = "Saving...";
  const result = await window.docstew.saveFile(currentDiagramFileId, currentDiagramDoc);
  if (result.success) {
    diagramSaveStatusEl.textContent = "Saved";
    await refreshFileList();
  } else {
    diagramSaveStatusEl.textContent = `Error: ${result.error}`;
  }
}

async function exportCurrentDiagram(): Promise<void> {
  if (!currentDiagramFileId) return;
  const format = diagramExportFormatEl.value;
  diagramExportBtn.disabled = true;
  diagramExportBtn.textContent = "Exporting...";
  const result = await window.docstew.exportFile(currentDiagramFileId, format);
  diagramExportBtn.disabled = false;
  diagramExportBtn.textContent = "Export";
  if (result.success && result.file) {
    diagramSaveStatusEl.textContent = `Exported to ${result.file.fileName}`;
    await refreshFileList();
  } else {
    diagramSaveStatusEl.textContent = `Export error: ${result.error}`;
  }
}

diagramCanvasEl.addEventListener("click", () => {
  diagramSelectedShapeId = undefined;
  diagramSelectedConnectorId = undefined;
  renderDiagramCanvas();
});

document.addEventListener("mousemove", (event) => {
  if (!diagramDragState || diagramEditorEl.hidden) return;
  const shape = currentDiagramDoc.shapes.find((s) => s.id === diagramDragState!.shapeId);
  if (!shape) return;
  const point = diagramCanvasPoint(event);
  const dx = point.x - diagramDragState.startPoint.x;
  const dy = point.y - diagramDragState.startPoint.y;
  if (diagramDragState.mode === "move") {
    shape.x = diagramDragState.origShape.x + dx;
    shape.y = diagramDragState.origShape.y + dy;
  } else {
    shape.width = Math.max(20, diagramDragState.origShape.width + dx);
    shape.height = Math.max(20, diagramDragState.origShape.height + dy);
  }
  renderDiagramCanvas();
});

document.addEventListener("mouseup", () => {
  diagramDragState = undefined;
});

diagramAddRectangleBtn.addEventListener("click", () => addDiagramShape("rectangle"));
diagramAddEllipseBtn.addEventListener("click", () => addDiagramShape("ellipse"));
diagramAddDiamondBtn.addEventListener("click", () => addDiagramShape("diamond"));
diagramConnectModeBtn.addEventListener("click", () => toggleDiagramConnectMode());
diagramDeleteSelectedBtn.addEventListener("click", () => deleteDiagramSelection());
diagramSaveBtn.addEventListener("click", () => void saveCurrentDiagram());
diagramExportBtn.addEventListener("click", () => void exportCurrentDiagram());

// ---- Presentation editor ----

let currentPresentationFileId: string | undefined;
let currentPresentationDoc: PresentationDocumentData = { slides: [{ title: "", bullets: [] }] };

function renderPresentationSlideList(): void {
  presentationSlideListEl.innerHTML = "";
  currentPresentationDoc.slides.forEach((slide, index) => {
    const card = document.createElement("div");
    card.className = "presentation-slide-card";

    const header = document.createElement("div");
    header.className = "presentation-slide-card-header";

    const number = document.createElement("span");
    number.className = "presentation-slide-number";
    number.textContent = `Slide ${index + 1}`;
    header.appendChild(number);

    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.className = "presentation-slide-title-input";
    titleInput.placeholder = "Slide title";
    titleInput.value = slide.title;
    titleInput.addEventListener("input", () => {
      slide.title = titleInput.value;
    });
    header.appendChild(titleInput);

    const actions = document.createElement("div");
    actions.className = "presentation-slide-actions";

    const upBtn = document.createElement("button");
    upBtn.textContent = "↑";
    upBtn.title = "Move up";
    upBtn.disabled = index === 0;
    upBtn.addEventListener("click", () => {
      const [moved] = currentPresentationDoc.slides.splice(index, 1);
      currentPresentationDoc.slides.splice(index - 1, 0, moved);
      renderPresentationSlideList();
    });
    actions.appendChild(upBtn);

    const downBtn = document.createElement("button");
    downBtn.textContent = "↓";
    downBtn.title = "Move down";
    downBtn.disabled = index === currentPresentationDoc.slides.length - 1;
    downBtn.addEventListener("click", () => {
      const [moved] = currentPresentationDoc.slides.splice(index, 1);
      currentPresentationDoc.slides.splice(index + 1, 0, moved);
      renderPresentationSlideList();
    });
    actions.appendChild(downBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.disabled = currentPresentationDoc.slides.length <= 1;
    deleteBtn.addEventListener("click", () => {
      currentPresentationDoc.slides.splice(index, 1);
      renderPresentationSlideList();
    });
    actions.appendChild(deleteBtn);

    header.appendChild(actions);
    card.appendChild(header);

    const bulletsInput = document.createElement("textarea");
    bulletsInput.className = "presentation-slide-bullets-input";
    bulletsInput.placeholder = "One bullet per line...";
    bulletsInput.value = slide.bullets.join("\n");
    bulletsInput.addEventListener("input", () => {
      slide.bullets = bulletsInput.value.split("\n");
    });
    card.appendChild(bulletsInput);

    presentationSlideListEl.appendChild(card);
  });
}

function showPresentationEditor(file: DocumentRecord, data: PresentationDocumentData): void {
  emptyStateEl.hidden = true;
  contentViewEl.hidden = true;
  notesEditorEl.hidden = true;
  pdfViewerEl.hidden = true;
  wordEditorEl.hidden = true;
  sheetViewerEl.hidden = true;
  sdataEditorEl.hidden = true;
  imageViewerEl.hidden = true;
  diagramEditorEl.hidden = true;
  presentationEditorEl.hidden = false;

  currentPresentationFileId = file.id;
  currentViewedFileId = file.id;
  currentPresentationDoc = data;
  presentationSaveStatusEl.textContent = "";
  renderPresentationSlideList();
}

function addPresentationSlide(): void {
  currentPresentationDoc.slides.push({ title: "", bullets: [] });
  renderPresentationSlideList();
}

async function saveCurrentPresentation(): Promise<void> {
  if (!currentPresentationFileId) return;
  presentationSaveStatusEl.textContent = "Saving...";
  const result = await window.docstew.saveFile(currentPresentationFileId, currentPresentationDoc);
  if (result.success) {
    presentationSaveStatusEl.textContent = "Saved";
    await refreshFileList();
  } else {
    presentationSaveStatusEl.textContent = `Error: ${result.error}`;
  }
}

async function exportCurrentPresentation(): Promise<void> {
  if (!currentPresentationFileId) return;
  const format = presentationExportFormatEl.value;
  presentationExportBtn.disabled = true;
  presentationExportBtn.textContent = "Exporting...";
  const result = await window.docstew.exportFile(currentPresentationFileId, format);
  presentationExportBtn.disabled = false;
  presentationExportBtn.textContent = "Export";
  if (result.success && result.file) {
    presentationSaveStatusEl.textContent = `Exported to ${result.file.fileName}`;
    await refreshFileList();
  } else {
    presentationSaveStatusEl.textContent = `Export error: ${result.error}`;
  }
}

presentationAddSlideBtn.addEventListener("click", () => addPresentationSlide());
presentationSaveBtn.addEventListener("click", () => void saveCurrentPresentation());
presentationExportBtn.addEventListener("click", () => void exportCurrentPresentation());

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
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
    event.preventDefault();
    toggleSearchPanel(searchPanelEl.hidden);
  } else if (event.key === "Escape" && !palette.hidden) {
    togglePalette(false);
  } else if (event.key === "Escape" && !aiChatPanel.hidden) {
    toggleAiChat(false);
  } else if (event.key === "Escape" && !searchPanelEl.hidden) {
    toggleSearchPanel(false);
  } else if (event.key === "Escape" && !historyPanelEl.hidden) {
    toggleHistoryPanel(false);
  } else if (event.key === "Escape" && !translationPanelEl.hidden) {
    closeTranslationPanel();
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && !notesEditorEl.hidden) {
    event.preventDefault();
    void saveCurrentNote();
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && !wordEditorEl.hidden) {
    event.preventDefault();
    void saveCurrentWordDoc();
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && !sdataEditorEl.hidden) {
    event.preventDefault();
    void saveCurrentSdata();
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && !diagramEditorEl.hidden) {
    event.preventDefault();
    void saveCurrentDiagram();
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && !presentationEditorEl.hidden) {
    event.preventDefault();
    void saveCurrentPresentation();
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

// ---- Search ----

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// fullTextIndex.ts wraps matches in ‹...› — escape everything else first,
// then turn those markers into <mark>, so real HTML in the source content
// can never be injected via this innerHTML assignment.
function highlightSnippet(snippet: string): string {
  return escapeHtml(snippet).replace(/‹/g, "<mark>").replace(/›/g, "</mark>");
}

let searchDebounceTimer: ReturnType<typeof setTimeout> | undefined;

function renderSearchResults(results: Array<DocumentRecord & { snippet: string }>): void {
  searchResultsEl.innerHTML = "";
  if (results.length === 0) {
    const li = document.createElement("li");
    li.textContent = searchInputEl.value.trim() ? "No matches found." : "Type to search your library.";
    searchResultsEl.appendChild(li);
    return;
  }
  for (const result of results) {
    const li = document.createElement("li");

    const nameRow = document.createElement("div");
    nameRow.className = "search-result-name";
    const name = document.createElement("span");
    name.textContent = result.title || result.fileName;
    nameRow.appendChild(name);
    const moduleTag = document.createElement("span");
    moduleTag.className = "search-result-module";
    moduleTag.textContent = result.moduleId ?? "";
    nameRow.appendChild(moduleTag);
    li.appendChild(nameRow);

    if (result.snippet) {
      const snippetEl = document.createElement("div");
      snippetEl.className = "search-result-snippet";
      snippetEl.innerHTML = highlightSnippet(result.snippet);
      li.appendChild(snippetEl);
    }

    li.addEventListener("click", () => {
      toggleSearchPanel(false);
      void selectFile(result);
    });
    searchResultsEl.appendChild(li);
  }
}

async function runSearch(): Promise<void> {
  const query = searchInputEl.value.trim();
  if (!query) {
    renderSearchResults([]);
    return;
  }
  const { results } = await window.docstew.search(query);
  renderSearchResults(results);
}

function toggleSearchPanel(show: boolean): void {
  searchPanelEl.hidden = !show;
  if (show) {
    searchInputEl.value = "";
    renderSearchResults([]);
    searchInputEl.focus();
  }
}

searchCloseBtn.addEventListener("click", () => toggleSearchPanel(false));
searchInputEl.addEventListener("input", () => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => void runSearch(), 200);
});

// ---- Version History ----

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function renderHistoryList(): Promise<void> {
  historyListEl.innerHTML = "";
  if (!currentViewedFileId) {
    const li = document.createElement("li");
    li.textContent = "No file is open.";
    historyListEl.appendChild(li);
    return;
  }
  const versions = await window.docstew.listVersions(currentViewedFileId);
  if (versions.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No earlier versions yet — versions are saved automatically when you edit.";
    historyListEl.appendChild(li);
    return;
  }
  for (const version of versions) {
    const li = document.createElement("li");

    const meta = document.createElement("div");
    meta.className = "history-entry-meta";
    const time = document.createElement("span");
    time.textContent = new Date(version.createdAt).toLocaleString();
    meta.appendChild(time);
    const size = document.createElement("span");
    size.className = "history-entry-size";
    size.textContent = formatBytes(version.sizeBytes);
    meta.appendChild(size);
    li.appendChild(meta);

    const restoreBtn = document.createElement("button");
    restoreBtn.className = "history-restore-btn";
    restoreBtn.textContent = "Restore";
    restoreBtn.addEventListener("click", () => void restoreHistoryVersion(version.id));
    li.appendChild(restoreBtn);

    historyListEl.appendChild(li);
  }
}

async function restoreHistoryVersion(versionId: number): Promise<void> {
  if (!currentViewedFileId) return;
  if (
    !window.confirm(
      "Restore this version? The current content will be saved as a version first, so you can undo this."
    )
  ) {
    return;
  }
  const result = await window.docstew.restoreVersion(currentViewedFileId, versionId);
  if (!result.success) {
    window.alert(`Could not restore: ${result.error}`);
    return;
  }
  await renderHistoryList();
  const files = await window.docstew.listFiles();
  const record = files.find((f) => f.id === currentViewedFileId);
  if (record) await selectFile(record);
}

function toggleHistoryPanel(show: boolean): void {
  historyPanelEl.hidden = !show;
  if (show) void renderHistoryList();
}

historyCloseBtn.addEventListener("click", () => toggleHistoryPanel(false));
notesHistoryBtn.addEventListener("click", () => toggleHistoryPanel(true));
pdfHistoryBtn.addEventListener("click", () => toggleHistoryPanel(true));
wordHistoryBtn.addEventListener("click", () => toggleHistoryPanel(true));
sheetHistoryBtn.addEventListener("click", () => toggleHistoryPanel(true));
sdataHistoryBtn.addEventListener("click", () => toggleHistoryPanel(true));
imageHistoryBtn.addEventListener("click", () => toggleHistoryPanel(true));
diagramHistoryBtn.addEventListener("click", () => toggleHistoryPanel(true));
presentationHistoryBtn.addEventListener("click", () => toggleHistoryPanel(true));

// ---- Translation review panel ----

interface TranslationToolResult {
  original: string;
  translated: string;
  targetLanguage: string;
}

function closeTranslationPanel(): void {
  translationPanelEl.hidden = true;
  translationBackdropEl.hidden = true;
}

function openTranslationPanel(data: TranslationToolResult): void {
  translationTitleEl.textContent = `Translation: ${data.targetLanguage}`;
  translationTargetLabelEl.textContent = data.targetLanguage;
  translationOriginalEl.textContent = data.original;
  translationTranslatedEl.textContent = data.translated;
  translationPanelEl.hidden = false;
  translationBackdropEl.hidden = false;
}

async function runTranslateTool(fileId: string, button: HTMLButtonElement): Promise<void> {
  const targetLanguage = window.prompt("Translate to which language?", "Spanish");
  if (!targetLanguage) return;
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = "Translating...";
  const result = await window.docstew.aiRunTool(fileId, "translate", { targetLanguage });
  button.disabled = false;
  button.textContent = originalLabel;
  if (result.success) {
    openTranslationPanel(result.result as TranslationToolResult);
  } else {
    window.alert(`Translation failed: ${result.error}`);
  }
}

translationCloseBtn.addEventListener("click", closeTranslationPanel);
translationBackdropEl.addEventListener("click", closeTranslationPanel);
notesTranslateBtn.addEventListener("click", () => {
  if (currentOpenFileId) void runTranslateTool(currentOpenFileId, notesTranslateBtn);
});
wordTranslateBtn.addEventListener("click", () => {
  if (currentWordFileId) void runTranslateTool(currentWordFileId, wordTranslateBtn);
});
sheetTranslateBtn.addEventListener("click", () => {
  if (currentSheetFileId) void runTranslateTool(currentSheetFileId, sheetTranslateBtn);
});

refreshFileList();
