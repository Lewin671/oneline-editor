"use client";

import { useEditorStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { AlertTriangle, XCircle } from "lucide-react";
import React from "react";

export function StatusBar() {
  const {
    isConnected,
    currentFile,
    currentLanguageId,
    editorManager,
    diagnosticsByUri,
    setProblemsOpen,
  } = useEditorStore();

  const currentModel =
    currentFile && editorManager ? editorManager.getModel(currentFile) : null;
  const diagnosticsKey = currentModel?.uri.toString();
  const diagnostics = diagnosticsKey
    ? diagnosticsByUri[diagnosticsKey]
    : undefined;

  const errors = diagnostics?.errors ?? 0;
  const warnings = diagnostics?.warnings ?? 0;

  const languageId =
    currentLanguageId ||
    currentModel?.getLanguageId() ||
    (currentFile ? "plaintext" : null);

  const languageLabel = languageId
    ? {
        typescript: "TypeScript",
        javascript: "JavaScript",
        go: "Go",
        json: "JSON",
        markdown: "Markdown",
        plaintext: "Plain Text",
      }[languageId] || languageId
    : "No file";

  return (
    <div className="h-6 border-t bg-muted/20 flex items-center px-2 text-xs gap-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <div
          className={cn(
            "w-2 h-2 rounded-full",
            isConnected ? "bg-green-500" : "bg-red-500",
          )}
        />
        <span>{isConnected ? "Connected" : "Disconnected"}</span>
      </div>
      {currentFile && (
        <div className="truncate text-muted-foreground" title={currentFile}>
          <span>{currentFile}</span>
        </div>
      )}
      <button
        type="button"
        onClick={() => setProblemsOpen(true)}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        title="Open Problems"
      >
        <div className="flex items-center gap-1.5 rounded px-1.5 py-[2px] hover:bg-background/40 transition-colors">
          <XCircle className="h-3.5 w-3.5" />
          <span className="tabular-nums text-foreground">{errors}</span>
        </div>
        <div className="flex items-center gap-1.5 rounded px-1.5 py-[2px] hover:bg-background/40 transition-colors">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="tabular-nums text-foreground">{warnings}</span>
        </div>
      </button>
      <div className="flex-1" />
      <div>
        <span className="font-medium">{languageLabel}</span>
      </div>
    </div>
  );
}
