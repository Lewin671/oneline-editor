"use client";

import { FileTree, FileTreeNode } from "@/components/FileTree";
import { StatusBar } from "@/components/StatusBar";
import { useEditorStore } from "@/lib/store";
import dynamic from "next/dynamic";
import React, { useCallback, useState } from "react";

const CodeEditor = dynamic(
  () => import("@/components/CodeEditor").then((mod) => mod.CodeEditor),
  {
    ssr: false,
    loading: () => <div className="h-full w-full bg-muted/10 animate-pulse" />,
  },
);

// Mock file system
const initialFiles: FileTreeNode[] = [
  {
    name: "src",
    path: "/src",
    type: "directory",
    children: [
      { name: "index.ts", path: "/src/index.ts", type: "file" },
      { name: "utils.ts", path: "/src/utils.ts", type: "file" },
      { name: "main.go", path: "/src/main.go", type: "file" },
    ],
  },
  { name: "package.json", path: "/package.json", type: "file" },
  { name: "README.md", path: "/README.md", type: "file" },
];

const getLanguageIdFromPath = (path: string): string => {
  if (path.endsWith(".ts") || path.endsWith(".tsx")) return "typescript";
  if (path.endsWith(".js") || path.endsWith(".jsx")) return "javascript";
  if (path.endsWith(".go")) return "go";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".md")) return "markdown";
  return "plaintext";
};

const getMockContent = (path: string, languageId: string): string => {
  if (languageId === "go") {
    return `package main

import "fmt"

func main() {
\tfmt.Println("Hello from Go")
}
`;
  }

  if (languageId === "typescript") {
    return `// ${path}

export function greet(name: string) {
  return \`Hello, \${name}!\`;
}

console.log(greet("World"));
`;
  }

  return `// Content of ${path}

console.log("Hello World");
`;
};

export default function Page() {
  const { editorManager, lspManager, setCurrentFile } = useEditorStore();
  const [files] = useState<FileTreeNode[]>(initialFiles);

  const handleFileSelect = useCallback(
    (path: string) => {
      setCurrentFile(path);
      // In a real app, we would fetch content. For now, mock content.
      const languageId = getLanguageIdFromPath(path);
      const content = getMockContent(path, languageId);

      if (!editorManager) return;

      editorManager.openFile(path, content, languageId);

      const model = editorManager.getModel(path);
      if (model && lspManager && !lspManager.isDocumentOpen(model.uri.toString())) {
        lspManager.didOpenTextDocument(
          model.uri.toString(),
          model.getLanguageId(),
          (model as any).getVersionId?.() ?? 1,
          model.getValue(),
        );
      }
    },
    [editorManager, lspManager, setCurrentFile],
  );

  return (
    <main className="flex h-screen flex-col overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
        <FileTree files={files} onFileSelect={handleFileSelect} />
        <div className="flex-1 flex flex-col min-w-0">
          <CodeEditor />
        </div>
      </div>
      <StatusBar />
    </main>
  );
}
