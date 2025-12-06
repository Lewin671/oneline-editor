import { create } from "zustand";
import { EditorManager } from "./editor/manager";
import { FrontendLSPManager } from "./lsp/client";
import {
  applyResolvedTheme,
  resolveTheme,
  saveThemeMode,
  type ResolvedTheme,
  type ThemeMode,
} from "./theme";

interface EditorState {
  editorManager: EditorManager | null;
  lspManager: FrontendLSPManager | null;
  currentFile: string | null;
  files: string[];
  isConnected: boolean;
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setEditorManager: (manager: EditorManager) => void;
  setLSPManager: (manager: FrontendLSPManager) => void;
  setCurrentFile: (file: string | null) => void;
  setFiles: (files: string[]) => void;
  setIsConnected: (connected: boolean) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setResolvedTheme: (theme: ResolvedTheme) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  editorManager: null,
  lspManager: null,
  currentFile: null,
  files: [],
  isConnected: false,
  themeMode: "auto",
  resolvedTheme: "light",
  setEditorManager: (manager) => set({ editorManager: manager }),
  setLSPManager: (manager) => set({ lspManager: manager }),
  setCurrentFile: (file) => set({ currentFile: file }),
  setFiles: (files) => set({ files }),
  setIsConnected: (connected) => set({ isConnected: connected }),
  setThemeMode: (mode) => {
    const resolvedTheme = resolveTheme(mode);
    applyResolvedTheme(resolvedTheme);
    saveThemeMode(mode);
    set({ themeMode: mode, resolvedTheme });
  },
  setResolvedTheme: (theme) => {
    applyResolvedTheme(theme);
    set({ resolvedTheme: theme, themeMode: get().themeMode });
  },
}));
