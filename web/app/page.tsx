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
    setCurrentFile,
    setCurrentLanguageId,
  } = useEditorStore();
  const [files, setFiles] = useState<FileTreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Store pending file to open when editorManager is not yet ready
  const [pendingFile, setPendingFile] = useState<{
    path: string;
    content: string;
    languageId: string;
  } | null>(null);

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

  // Open pending file when editorManager becomes ready
  useEffect(() => {
    if (editorManager && pendingFile) {
      editorManager.openFile(pendingFile.path, pendingFile.content, pendingFile.languageId);
      setPendingFile(null);
    }
  }, [editorManager, pendingFile]);

  const handleFileSelect = useCallback(
    async (path: string) => {
      const languageId = getLanguageIdFromPath(path);
      setCurrentFile(path);
      setCurrentLanguageId(languageId);

      try {
        // Fetch file content from server
        const response = await fetch(`http://localhost:3001/api/file${path}`);
        if (!response.ok) {
          console.error('Failed to fetch file content');
          return;
        }
        const content = await response.text();

        if (!editorManager) {
          // Store pending file to open when editor is ready
          setPendingFile({ path, content, languageId });
          return;
        }

        // Open file in editor - LSP sync is handled automatically via onFileOpen listener
        editorManager.openFile(path, content, languageId);
      } catch (error) {
        console.error('Error loading file:', error);
      }
    },
    [
      editorManager,
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
