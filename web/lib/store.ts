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

export interface DiagnosticsSummary {
  errors: number;
  warnings: number;
}

export type DiagnosticSeverity = "error" | "warning" | "info" | "hint";

export interface DiagnosticItem {
  uri: string;
  message: string;
  severity: DiagnosticSeverity;
  line: number;
  column: number;
  source?: string;
  code?: string;
}

interface EditorState {
  editorManager: EditorManager | null;
  lspManager: FrontendLSPManager | null;
  currentFile: string | null;
  currentLanguageId: string | null;
  files: string[];
  isConnected: boolean;
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  diagnosticsByUri: Record<string, DiagnosticsSummary>;
  diagnosticItemsByUri: Record<string, DiagnosticItem[]>;
  isProblemsOpen: boolean;
  setEditorManager: (manager: EditorManager) => void;
  setLSPManager: (manager: FrontendLSPManager) => void;
  setCurrentFile: (file: string | null) => void;
  setCurrentLanguageId: (languageId: string | null) => void;
  setFiles: (files: string[]) => void;
  setIsConnected: (connected: boolean) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setResolvedTheme: (theme: ResolvedTheme) => void;
  setDiagnostics: (
    uri: string,
    summary: DiagnosticsSummary,
    items?: DiagnosticItem[],
  ) => void;
  setProblemsOpen: (open: boolean) => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  editorManager: null,
  lspManager: null,
  currentFile: null,
  currentLanguageId: null,
  files: [],
  isConnected: false,
  themeMode: "auto",
  resolvedTheme: "light",
  diagnosticsByUri: {},
  diagnosticItemsByUri: {},
  isProblemsOpen: false,
  setEditorManager: (manager) => set({ editorManager: manager }),
  setLSPManager: (manager) => set({ lspManager: manager }),
  setCurrentFile: (file) => set({ currentFile: file }),
  setCurrentLanguageId: (languageId) => set({ currentLanguageId: languageId }),
  setFiles: (files) => set({ files }),
  setIsConnected: (connected) => set({ isConnected: connected }),
  setDiagnostics: (uri, summary, items = []) => {
    console.log(`[Store] setDiagnostics called: uri=${uri}, errors=${summary.errors}, warnings=${summary.warnings}, items=${items.length}`);
    set((state) => {
      const newState = {
        diagnosticsByUri: {
          ...state.diagnosticsByUri,
          [uri]: summary,
        },
        diagnosticItemsByUri: {
          ...state.diagnosticItemsByUri,
          [uri]: items,
        },
      };
      console.log(`[Store] New diagnosticsByUri keys:`, Object.keys(newState.diagnosticsByUri));
      return newState;
    });
  },
  setProblemsOpen: (open) => set({ isProblemsOpen: open }),
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
