"use client";

import { cn } from "@/lib/utils";
import { File, Folder, Plus } from "lucide-react";
import React from "react";

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileTreeNode[];
}

interface FileTreeProps {
  files: FileTreeNode[];
  onFileSelect: (path: string) => void;
}

export function FileTree({ files, onFileSelect }: FileTreeProps) {
  return (
    <div className="h-full w-64 border-r bg-muted/10 flex flex-col">
      <div className="p-2 border-b flex items-center justify-between">
        <span className="font-semibold text-sm">Explorer</span>
        <div className="flex gap-1">
          <button className="p-1 hover:bg-muted rounded">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-2">
        {files.map((file) => (
          <FileTreeNodeItem
            key={file.path}
            node={file}
            onSelect={onFileSelect}
          />
        ))}
      </div>
    </div>
  );
}

function FileTreeNodeItem({
  node,
  onSelect,
  level = 0,
}: { node: FileTreeNode; onSelect: (path: string) => void; level?: number }) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleClick = () => {
    if (node.type === "directory") {
      setIsOpen(!isOpen);
    } else {
      onSelect(node.path);
    }
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 py-1 px-2 hover:bg-accent/50 rounded cursor-pointer text-sm",
          level > 0 && "ml-4",
        )}
        onClick={handleClick}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        {node.type === "directory" ? (
          <Folder className="h-4 w-4 text-blue-400" />
        ) : (
          <File className="h-4 w-4 text-gray-400" />
        )}
        <span>{node.name}</span>
      </div>
      {isOpen && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNodeItem
              key={child.path}
              node={child}
              onSelect={onSelect}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
