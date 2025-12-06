"use client";

import { FileTree, FileTreeNode } from "@/components/FileTree";
import { ProblemsPanel } from "@/components/ProblemsPanel";
import { StatusBar } from "@/components/StatusBar";
import { ThemeManager } from "@/components/ThemeManager";
import { TopBar } from "@/components/TopBar";
import { useEditorStore } from "@/lib/store";
import dynamic from "next/dynamic";
import React, { useCallback, useEffect, useState } from "react";

const CodeEditor = dynamic(
  () => import("@/components/CodeEditor").then((mod) => mod.CodeEditor),
  {
    ssr: false,
    loading: () => <div className="h-full w-full bg-muted/10 animate-pulse" />,
  },
);

const getLanguageIdFromPath = (path: string): string => {
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return "typescript";
  if (path.endsWith(".js") || path.endsWith(".jsx")) return "javascript";
  if (path.endsWith(".go")) return "go";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md")) return "markdown";
  return "plaintext";
};

export default function Page() {
  const {
    editorManager,
    lspManager,
    setCurrentFile,
    setCurrentLanguageId,
  } = useEditorStore();
  const [files, setFiles] = useState<FileTreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch file tree on mount
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/files');
        if (response.ok) {
          const fileTree = await response.json();
          setFiles(fileTree);
        } else {
          console.error('Failed to fetch file tree');
        }
      } catch (error) {
        console.error('Error fetching file tree:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFiles();
  }, []);

  const handleFileSelect = useCallback(
    async (path: string) => {
      const languageId = getLanguageIdFromPath(path);
      setCurrentFile(path);
      setCurrentLanguageId(languageId);

      if (!editorManager) return;

      try {
        // Fetch file content from server
        const response = await fetch(`http://localhost:3001/api/file${path}`);
        if (!response.ok) {
          console.error('Failed to fetch file content');
          return;
        }
        const content = await response.text();

        editorManager.openFile(path, content, languageId);

        const model = editorManager.getModel(path);
        if (model) {
          if (lspManager && !lspManager.isDocumentOpen(model.uri.toString())) {
            lspManager.didOpenTextDocument(
              model.uri.toString(),
              model.getLanguageId(),
              (model as any).getVersionId?.() ?? 1,
              model.getValue(),
            );
          }
        }
      } catch (error) {
        console.error('Error loading file:', error);
      }
    },
    [
      editorManager,
      lspManager,
      setCurrentFile,
      setCurrentLanguageId,
    ],
  );

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-background">
      <ThemeManager />
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <FileTree 
          files={files} 
          onFileSelect={handleFileSelect}
          isLoading={isLoading}
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <CodeEditor />
          </div>
          <ProblemsPanel />
        </div>
      </div>
      <StatusBar />
    </main>
  );
}
