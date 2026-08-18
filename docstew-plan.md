# DocStew — Project Plan & Architecture

A local-first, modular document studio with a built-in local AI. This doc covers: document type prioritization, function lists per type, core architecture, and a build pathway for Claude Code.

---

## 1. Document Type Prioritization

Ranked by (demand × differentiation from cloud tools × build complexity × synergy with local AI).

### Tier 1 — MVP (build first)
| Type | Why it's first |
|---|---|
| **Notes / Markdown** | Cheapest to build, validates the plugin API early, and is the natural home for AI chat/summarization output. Build this first even though it's not "core" to prove the architecture. |
| **PDF** | Universal document format. Highest daily-use demand. Viewing/annotation alone delivers huge value; local AI Q&A over PDFs is a killer differentiator vs. cloud tools. |
| **Word Processing (.docx/rich text)** | Core "office" expectation. People will judge the whole app on this. |
| **Spreadsheets (.xlsx/.csv)** | Second-most core office expectation; pairs well with AI (formula help, data cleanup). |

### Tier 2 — High value, build next
| Type | Notes |
|---|---|
| **Presentations (.pptx)** | Common ask, but higher UI complexity (layouts, animations). |
| **Forms** | Natural extension of PDF module (fillable forms) — cheap once PDF exists. |
| **Images / Basic Graphics** | Needed for embedding into other doc types; standalone editing is secondary. |

### Tier 3 — Differentiators, build once core is stable
| Type | Notes |
|---|---|
| **Diagrams / Flowcharts** | Good local-AI synergy (AI-generated diagrams from text description). |
| **Structured Data (JSON/XML/YAML)** | Low build cost, appeals to technical users, easy AI validation/formatting features. |
| **Archives (ZIP/7z)** | Utility feature, not a "document type" per se — could be a core service instead of a module. |
| **E-books (EPUB)** | Niche but simple viewer; low priority to edit. |

### Tier 4 — Stretch / niche (only if there's demand signal)
| Type | Notes |
|---|---|
| **Legal / Contracts (redlining, e-sign)** | High value but high complexity and liability surface (signatures, compliance). |
| **Email files (.eml/.msg)** | Useful for archiving workflows; narrow audience. |
| **Audio/video transcripts (.srt/.vtt)** | Great local-AI use case (local transcription + editing) but a different media pipeline entirely. |
| **CAD (.dwg/.dxf)** | Full editing is a massive undertaking; skip unless it's a specific personal need. |

**Recommendation:** Ship Notes → PDF → Word → Spreadsheets as your v1. That alone beats most "PDF tool" or "note app" competitors because of the shared local-AI layer and single-app experience.

---

## 2. Function Lists by Document Type

### Notes / Markdown
- Rich text + Markdown source toggle
- Backlinks / bidirectional links between notes
- Tagging and nested folders/pages
- Full-text search across all notes
- Templates (meeting notes, daily log, etc.)
- AI: summarize, expand, rewrite, auto-tag, "ask my notes"

### PDF
- View/render (including large files, scanned docs)
- Annotate: highlight, comment, draw, sticky notes
- Fill forms (AcroForm fields)
- Merge / split / reorder / rotate pages
- Redaction (true removal, not just visual cover)
- OCR for scanned PDFs → searchable/selectable text
- Export to Word/text/image
- Password protect / encrypt / decrypt
- Watermarking, page numbering
- AI: summarize, Q&A over document, extract tables/key data, compare two PDFs

### Word Processing (.docx)
- Rich text editing (styles, headings, lists, tables)
- Track changes / comments
- Templates (letterhead, resume, report)
- Table of contents auto-generation
- Find & replace (incl. regex)
- Export to PDF/Markdown/plain text
- Mail-merge style batch document generation
- AI: draft/rewrite sections, tone adjustment, grammar/style pass, summarize long docs

### Spreadsheets (.xlsx/.csv)
- Cell editing, formulas, functions
- Sorting/filtering, pivot-table-style summarization
- Charting
- Conditional formatting
- Multi-sheet workbooks
- Import/export CSV ↔ XLSX
- Data validation rules
- AI: formula generation from plain English, data cleanup, anomaly detection, auto-summarize a dataset

### Presentations (.pptx)
- Slide creation with layouts/master themes
- Speaker notes + presenter view (timer, next-slide preview)
- Transitions/animations (basic set, not full parity)
- Embed charts/images/tables
- Export to PDF or image sequence
- AI: generate slide outline from notes/doc, condense long content into slide bullets

### Forms (built on PDF/module-shared engine)
- Form builder (text fields, checkboxes, dropdowns, signatures)
- Conditional logic (show/hide fields)
- Response collection → export to spreadsheet
- Fillable PDF export

### Images / Basic Graphics
- Crop, resize, rotate
- Color correction (brightness/contrast/saturation)
- Background removal
- Format conversion (HEIC/PNG/JPG/WebP/SVG)
- Batch processing
- Annotation/markup (arrows, text, blur)
- AI: describe image, extract text (OCR), background removal

### Diagrams / Flowcharts
- Shape library + connectors
- Auto-layout
- Templates (org chart, flowchart, mind map, network diagram)
- Export to SVG/PDF/PNG
- AI: generate diagram from a text description

### Structured Data (JSON/XML/YAML)
- Syntax highlighting + validation
- Pretty-print / minify
- Schema viewing/validation
- Format conversion between JSON/XML/YAML/CSV
- Diff viewer
- AI: explain structure, fix malformed data, generate sample data from schema

---

## 3. Cross-Cutting Core Features (apply to most/all modules)
These should live in the **core system**, not be duplicated per module:
- Universal format conversion pipeline
- Merge/split for any paginated doc type
- Global full-text + semantic search across the entire library
- Version history / diffing
- Batch operations (rename, convert, tag, export many files)
- Metadata editing (author, tags, dates)
- E-signature (shared engine used by PDF + Forms)
- **Translation** (see Section 3a) — shared engine used by every module, not a standalone document type

---

## 3a. Translation Service (Core)

Translation isn't a document type with its own file format — it's a transformation that applies *across* existing modules. It lives in core as a shared service that each module calls into, so the model/logic exists in one place instead of being reimplemented per module.

### Feasibility by document type
| Type | Difficulty | Why |
|---|---|---|
| Notes/plain text | Easy | Text in, text out |
| Spreadsheets | Easy–moderate | Translate cell text, leave formulas/structure alone |
| Word docs | Moderate | Must preserve styles/formatting — translate text runs in place, not just raw text |
| Presentations | Moderate | Same as Word, plus translated text needs to fit slide layouts (length varies by language) |
| PDF | **Hard** | No editable text model — either regenerate with reflowed text (lossy) or overlay a translated text layer. Treat as a stretch feature. |

### Model options
- **NLLB-200** (Meta, open source) — purpose-built translation model, 200 languages, runs locally on modest hardware, generally best raw translation quality for major language pairs
- **General local LLM** (already in the AI Engine) — more flexible for context/tone/terminology consistency, needs a larger model for good quality
- **Hybrid (recommended):** NLLB for the base translation pass, local LLM for a terminology/consistency cleanup pass

Quality note: major language pairs (EN↔ES/FR/DE/ZH/JA) are solid locally today; lower-resource languages degrade — surface this to users rather than overpromising.

### Features for business/company use
- Translation memory (reuse previously translated segments for consistency across a project)
- Glossary/terminology management (brand/product terms stay untranslated or consistently translated)
- Batch-translate a whole folder
- Side-by-side bilingual view for review/editing
- Linked original ↔ translated documents (tracked pair, not two untracked files)

### How it plugs into the architecture
- Lives in core as a **Translation Service**, alongside the Local AI Engine
- Each module registers a `translate` function in its `aiTools` (same pattern as `summarize`) that calls into the core Translation Service, passing its own text-extraction/reinsertion logic
- Translation memory + glossary data stored alongside the existing metadata store (SQLite)

---

## 4. Modular Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                              DocStew Core                               │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ │
│  │ File/      │ │ Plugin     │ │ Local AI   │ │Translation │ │ UI Shell / │ │
│  │ Library    │ │ Registry & │ │ Engine     │ │ Service    │ │ Window/    │ │
│  │ Manager    │ │ Loader     │ │ (LLM +     │ │ (NLLB +    │ │ Nav/       │ │
│  │ (index,    │ │            │ │ embeddings)│ │ memory +   │ │ Command    │ │
│  │ search,    │ │            │ │            │ │ glossary)  │ │ Palette    │ │
│  │ metadata)  │ │            │ │            │ │            │ │            │ │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────┘ │
│                     ▲ Plugin API (stable contract) ▲                     │
└─────────────────────┼───────────────────────────────┼───────────────────┘
                       │                               │
        ┌──────────────┼───────────────┬───────────────┼───────────────┐
        ▼               ▼               ▼               ▼               ▼
   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
   │  Notes   │    │   PDF   │    │  Word   │    │  Sheet  │    │  ...    │
   │  Module  │    │ Module  │    │ Module  │    │ Module  │    │ Modules │
   └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
```

### Core system responsibilities
1. **File/Library Manager** — file system access, watch folders, indexing, tagging, metadata store (SQLite recommended)
2. **Plugin Registry & Loader** — discovers modules, loads their manifest, exposes them to the UI shell and AI engine
3. **Local AI Engine** — model runtime, embedding store, retrieval, and a **tool-calling layer** so the AI can invoke module functions (e.g., "summarize" or "extract table" are AI-callable functions each module registers)
4. **Translation Service** — translation model runtime (NLLB + LLM cleanup pass), translation memory, glossary management; exposed to modules the same way the AI Engine is (see Section 3a)
5. **UI Shell** — window management, navigation, command palette, shared design system/components

### Module contract (every document type module implements)
```ts
interface DocStewModule {
  id: string;                        // "pdf", "notes", "docx"
  supportedExtensions: string[];     // [".pdf"]
  open(filePath: string): DocumentHandle;
  render(handle: DocumentHandle): UIComponent;
  save(handle: DocumentHandle): void;
  export(handle: DocumentHandle, format: string): Buffer;
  index(handle: DocumentHandle): SearchableText;   // for global search + AI RAG
  aiTools: AITool[];                 // functions the local AI can call on this doc type
}
```

Because every module implements the same contract, the core never needs to know what a "PDF" or "spreadsheet" *is* — it just calls `open`, `render`, `save`, `index`, and exposes `aiTools` to the AI engine. This is what makes modules addable/removable without touching core code.

### Local AI integration model
- **Model runtime:** local inference via Ollama or llama.cpp (user picks/downloads a model; keep this pluggable, not hardcoded to one model)
- **Embeddings/RAG:** every module's `index()` output feeds a local vector store (e.g., sqlite-vec or a lightweight local vector DB) → powers "ask my documents" across the whole library
- **Tool-calling:** the AI engine exposes each module's `aiTools` as callable functions, so a chat request like *"summarize this PDF and put the summary in my notes"* becomes: call PDF module's `summarize` tool → call Notes module's `create` tool
- **Privacy boundary:** everything stays local by default — this is your core differentiator vs. cloud suites, so make it structurally impossible for a module to phone home without explicit user action

---

## 5. Development Pathway (for Claude Code)

Build in this order — each phase is a working, testable milestone before moving on.

**Phase 0 — Core Shell (no document logic yet)**
- Set up app shell (recommend **Tauri** — Rust core + web frontend, lighter/faster than Electron for a desktop-native feel; use Electron only if you want faster prototyping and don't mind the resource cost)
- File/Library Manager: open a folder, list files, basic metadata (SQLite)
- Plugin Registry: define the module contract above, build a loader that can register a dummy "hello world" module
- Basic UI shell: sidebar (file tree/library), main pane, command palette stub

**Phase 1 — First Module: Notes**
- Implement Notes as the first real module against the plugin contract
- Validates: open/render/save/export/index all work end-to-end
- This is your "does the architecture actually work" checkpoint

**Phase 2 — Local AI Engine (basic)**
- Integrate local model runtime (Ollama recommended for simplicity to start)
- Build embedding index + vector store, wire Notes module's `index()` into it
- Ship a basic chat panel that can answer questions about notes ("ask my notes")
- Define the `aiTools` interface and register Notes' first AI tool (e.g., summarize)

**Phase 3 — PDF Module**
- View/render, annotate, merge/split, OCR
- Register PDF's `aiTools` (summarize, Q&A, extract table) — this proves tool-calling across modules

**Phase 4 — Word Module (.docx)**
- Rich text editing, track changes, export to PDF/Markdown
- Register AI tools: rewrite, tone adjustment, summarize

**Phase 5 — Spreadsheet Module**
- Cell editing/formulas/CSV import-export
- Register AI tools: formula generation, data cleanup

**Phase 6 — Cross-Cutting Core Features**
- Global search UI across all modules (now that 4 modules exist, this becomes meaningful to test)
- Batch operations, version history, universal format conversion

**Phase 6a — Translation Service**
- Integrate NLLB-200 (or similar) as the base translation runtime, plus an LLM cleanup pass
- Build translation memory + glossary storage (SQLite, alongside existing metadata)
- Register `translate` as an `aiTool` on Notes, Word, and Spreadsheet modules first (easy/moderate cases)
- Side-by-side bilingual review UI
- Treat PDF translation as a later stretch task once the text-layer approach is validated on the easier modules

**Phase 7 — Tier 2/3 Modules**
- Presentations, Forms, Images, Diagrams, Structured Data — each is now "just" implementing the existing contract, so these should go faster than Phases 1–5

### Suggested repo structure
```
docstew/
├── core/
│   ├── file-manager/
│   ├── plugin-registry/
│   ├── ai-engine/
│   └── ui-shell/
├── modules/
│   ├── notes/
│   ├── pdf/
│   ├── docx/
│   ├── xlsx/
│   └── ...
├── shared/
│   ├── module-contract.ts
│   └── ui-components/
└── docs/
    └── module-authoring-guide.md
```

### Why this order works for Claude Code specifically
- Each phase is a self-contained, testable unit of work you can hand to Claude Code as its own session/task
- The module contract (Phase 0) means every later module-building session has a clear, unchanging spec to build against — less drift, less re-explaining context each time
- Local AI is introduced early (Phase 2) against the *simplest* module (Notes), so you debug the AI/tool-calling plumbing before it has to deal with PDF/DOCX parsing complexity

---

## Open Questions to Settle Before Coding
- **Tauri vs. Electron** — Tauri is lighter and more "desktop-native," Electron has a larger ecosystem/faster prototyping. Worth a quick spike of both before committing.
- **Which local model runtime** — Ollama (easiest to integrate, handles model management) vs. llama.cpp directly (more control, more work).
- **Storage** — SQLite for metadata/index is a safe default; confirm before Phase 0.
