"use client";

import { EditorManager } from "@/lib/editor/manager";
import { FrontendLSPManager } from "@/lib/lsp/client";
import { useEditorStore } from "@/lib/store";
import Editor, { Monaco, loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import React, { useRef } from "react";

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
  const { setEditorManager, setLSPManager, setIsConnected } = useEditorStore();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

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

  return (
    <div className="h-full w-full overflow-hidden rounded-md border bg-background">
      <Editor
        height="100%"
        defaultLanguage="typescript"
        theme="vs-dark"
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
