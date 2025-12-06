import { create } from "zustand";
import { EditorManager } from "./editor/manager";
import { FrontendLSPManager } from "./lsp/client";

interface EditorState {
  editorManager: EditorManager | null;
  lspManager: FrontendLSPManager | null;
  currentFile: string | null;
  files: string[];
  isConnected: boolean;
  setEditorManager: (manager: EditorManager) => void;
  setLSPManager: (manager: FrontendLSPManager) => void;
  setCurrentFile: (file: string | null) => void;
  setFiles: (files: string[]) => void;
  setIsConnected: (connected: boolean) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  editorManager: null,
  lspManager: null,
  currentFile: null,
  files: [],
  isConnected: false,
  setEditorManager: (manager) => set({ editorManager: manager }),
  setLSPManager: (manager) => set({ lspManager: manager }),
  setCurrentFile: (file) => set({ currentFile: file }),
  setFiles: (files) => set({ files }),
  setIsConnected: (connected) => set({ isConnected: connected }),
}));
