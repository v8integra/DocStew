export const IPC_CHANNELS = {
  LIBRARY_OPEN_FOLDER: "library:openFolder",
  LIBRARY_LIST_FILES: "library:listFiles",
  LIBRARY_OPEN_FILE: "library:openFile",
  LIBRARY_SAVE_FILE: "library:saveFile",
  LIBRARY_CREATE_FILE: "library:createFile",
  REGISTRY_LIST_MODULES: "registry:listModules",
  NOTES_RENDER_PREVIEW: "notes:renderPreview",
  AI_STATUS: "ai:status",
  AI_CHAT: "ai:chat",
  AI_RUN_TOOL: "ai:runTool",
} as const;
