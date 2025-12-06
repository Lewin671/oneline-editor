"use client";

import { EditorManager } from "@/lib/editor/manager";
import { FrontendLSPManager } from "@/lib/lsp/client";
import { useEditorStore } from "@/lib/store";
import Editor, { Monaco, loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import React, { useCallback, useEffect, useRef } from "react";

type MonacoEnvironmentShape = typeof self & {
  MonacoEnvironment?: {
    getWorker: (_: string, label: string) => Worker;
  };
};

// Configure Monaco loader to use local files instead of CDN and register workers
if (typeof window !== "undefined") {
  const globalSelf = self as MonacoEnvironmentShape;

  if (!globalSelf.MonacoEnvironment) {
    globalSelf.MonacoEnvironment = {
      getWorker(_moduleId, label) {
        const workerOptions: WorkerOptions = { type: "module" };
        switch (label) {
          case "json":
            return new Worker(
              new URL(
                "monaco-editor/esm/vs/language/json/json.worker.js",
                import.meta.url,
              ),
              workerOptions,
            );
          case "css":
          case "scss":
          case "less":
            return new Worker(
              new URL(
                "monaco-editor/esm/vs/language/css/css.worker.js",
                import.meta.url,
              ),
              workerOptions,
            );
          case "html":
          case "handlebars":
          case "razor":
            return new Worker(
              new URL(
                "monaco-editor/esm/vs/language/html/html.worker.js",
                import.meta.url,
              ),
              workerOptions,
            );
          case "typescript":
          case "javascript":
            return new Worker(
              new URL(
                "monaco-editor/esm/vs/language/typescript/ts.worker.js",
                import.meta.url,
              ),
              workerOptions,
            );
          default:
            return new Worker(
              new URL(
                "monaco-editor/esm/vs/editor/editor.worker.js",
                import.meta.url,
              ),
              workerOptions,
            );
        }
      },
    };
  }

  loader.config({ monaco });
}

export function CodeEditor() {
  const {
    editorManager,
    lspManager,
    setEditorManager,
    setLSPManager,
    setIsConnected,
    setDiagnostics,
    resolvedTheme,
  } = useEditorStore();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const handleSave = useCallback(() => {
    const model = editorManager?.getCurrentModel();
    if (!model) return;

    const content = model.getValue();
    const uri = model.uri.toString();

    // Send didSave to LSP server so diagnostics stay up-to-date
    lspManager?.didSaveTextDocument(uri, content);
  }, [editorManager, lspManager]);

  const updateDiagnosticsForUri = useCallback(
    (uri: monaco.Uri) => {
      const markers = monaco.editor.getModelMarkers({ resource: uri });
      const errors = markers.filter(
        (marker) => marker.severity === monaco.MarkerSeverity.Error,
      ).length;
      const warnings = markers.filter(
        (marker) => marker.severity === monaco.MarkerSeverity.Warning,
      ).length;

      const severityToLabel = (
        severity: monaco.MarkerSeverity,
      ): "error" | "warning" | "info" | "hint" => {
        switch (severity) {
          case monaco.MarkerSeverity.Error:
            return "error";
          case monaco.MarkerSeverity.Warning:
            return "warning";
          case monaco.MarkerSeverity.Info:
            return "info";
          case monaco.MarkerSeverity.Hint:
          default:
            return "hint";
        }
      };

      const details = markers.map((marker) => ({
        uri: uri.toString(),
        message: marker.message,
        severity: severityToLabel(marker.severity),
        line: marker.startLineNumber,
        column: marker.startColumn,
        source: marker.source,
        code:
          typeof marker.code === "object"
            ? (marker.code as any)?.value ?? (marker.code as any)?.target
            : marker.code?.toString(),
      }));

      setDiagnostics(uri.toString(), { errors, warnings }, details);
    },
    [setDiagnostics],
  );

  const handleEditorDidMount = (
    editor: monaco.editor.IStandaloneCodeEditor,
    monacoInstance: Monaco,
  ) => {
    editorRef.current = editor;
    monacoRef.current = monacoInstance;
    const disableDefaultTSFeatures = {
      completionItems: false,
      hovers: false,
      documentSymbols: false,
      definitions: false,
      references: false,
      documentHighlights: false,
      rename: false,
      diagnostics: false,
      documentRangeFormattingEdits: false,
      signatureHelp: false,
      onTypeFormattingEdits: false,
      codeActions: false,
      inlayHints: false,
    };

    // Initialize Managers
    const editorManager = new EditorManager();
    editorManager.attach(editor);
    setEditorManager(editorManager);

    const lspManager = new FrontendLSPManager();

    // Initialize LSP
    lspManager
      .initialize(editorManager, undefined, (connected) => {
        setIsConnected(connected);
      })
      .then(() => {
        lspManager.registerProviders();
        setLSPManager(lspManager);
      })
      .catch((err) => {
        console.error("Failed to initialize LSP:", err);
        setIsConnected(false);
      });

    // Configure Monaco
    monacoInstance.languages.typescript.typescriptDefaults.setEagerModelSync(
      false,
    );
    monacoInstance.languages.typescript.javascriptDefaults.setEagerModelSync(
      false,
    );

    // Disable built-in JS/TS features so completion/diagnostics rely on LSP only
    monacoInstance.languages.typescript.typescriptDefaults.setModeConfiguration(
      disableDefaultTSFeatures,
    );
    monacoInstance.languages.typescript.javascriptDefaults.setModeConfiguration(
      disableDefaultTSFeatures,
    );
  };

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // Register a VS Code style save shortcut
    const action = editor.addAction({
      id: "file-save",
      label: "Save File",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => handleSave(),
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && (event.key === "s" || event.key === "S")) {
        event.preventDefault();
        // When the editor isn't focused, still prevent the browser save dialog
        if (!editor.hasTextFocus()) {
          handleSave();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      action?.dispose();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleSave]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    // Recompute diagnostics when switching models so counts stay fresh
    const modelListener = editor.onDidChangeModel(() => {
      const model = editor.getModel();
      if (model) {
        updateDiagnosticsForUri(model.uri);
      }
    });

    // Keep diagnostics summary in sync with Monaco markers
    const dispose = monaco.editor.onDidChangeMarkers((uris) => {
      uris.forEach((uri) => updateDiagnosticsForUri(uri));
    });

    return () => {
      dispose.dispose();
      modelListener?.dispose();
    };
  }, [updateDiagnosticsForUri]);

  return (
    <div className="h-full w-full overflow-hidden rounded-md border bg-background">
      <Editor
        height="100%"
        defaultLanguage="typescript"
        theme={resolvedTheme === "dark" ? "vs-dark" : "vs"}
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: true },
          fontSize: 14,
          automaticLayout: true,
          padding: { top: 10 },
          scrollBeyondLastLine: false,
          wordBasedSuggestions: "off",
          suggest: {
            showWords: false,
          },
        }}
      />
    </div>
  );
}
