"use client";

import { cn } from "@/lib/utils";
import {
  Edit2,
  File,
  FilePlus,
  Folder,
  FolderPlus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import React, { useState } from "react";
import { ContextMenu, ContextMenuItem } from "./ContextMenu";

// API configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileTreeNode[];
}

interface FileTreeProps {
  files: FileTreeNode[];
  onFileSelect: (path: string) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export function FileTree({
  files,
  onFileSelect,
  onRefresh,
  isLoading = false,
}: FileTreeProps) {
  const [contextMenu, setContextMenu] = useState<{
    position: { x: number; y: number };
    items: ContextMenuItem[];
  } | null>(null);

  const handleContextMenu = (event: React.MouseEvent, node?: FileTreeNode) => {
    event.preventDefault();
    event.stopPropagation();

    const items: ContextMenuItem[] = [];

    if (node) {
      // Context menu for a specific file/folder
      items.push(
        {
          label: "New File",
          icon: <FilePlus className="h-4 w-4" />,
          onClick: async () => {
            const fileName = prompt(
              node.type === "directory"
                ? "Enter new file name:"
                : "Enter new file name (will be created in the same folder):",
            );
            if (fileName) {
              const basePath =
                node.type === "directory"
                  ? node.path
                  : node.path.substring(0, node.path.lastIndexOf("/"));
              const newPath = `${basePath}/${fileName}`.replace(/\/+/g, "/");
              await createFile(newPath);
              onRefresh();
            }
          },
        },
        {
          label: "New Folder",
          icon: <FolderPlus className="h-4 w-4" />,
          onClick: async () => {
            const folderName = prompt(
              node.type === "directory"
                ? "Enter new folder name:"
                : "Enter new folder name (will be created in the same folder):",
            );
            if (folderName) {
              const basePath =
                node.type === "directory"
                  ? node.path
                  : node.path.substring(0, node.path.lastIndexOf("/"));
              const newPath = `${basePath}/${folderName}`.replace(/\/+/g, "/");
              await createFolder(newPath);
              onRefresh();
            }
          },
        },
        {
          label: "Rename",
          icon: <Edit2 className="h-4 w-4" />,
          onClick: async () => {
            const newName = prompt(`Rename ${node.name}:`, node.name);
            if (newName && newName !== node.name) {
              const lastSlashIndex = node.path.lastIndexOf("/");
              const parentPath =
                lastSlashIndex > 0
                  ? node.path.substring(0, lastSlashIndex)
                  : "";
              const newPath = parentPath
                ? `${parentPath}/${newName}`
                : `/${newName}`;
              await renamePath(node.path, newPath);
              onRefresh();
            }
          },
        },
        {
          label: "Delete",
          icon: <Trash2 className="h-4 w-4" />,
          onClick: async () => {
            const confirmed = confirm(
              `Are you sure you want to delete "${node.name}"?`,
            );
            if (confirmed) {
              await deletePath(node.path);
              onRefresh();
            }
          },
        },
      );
    } else {
      // Context menu for empty space
      items.push(
        {
          label: "New File",
          icon: <FilePlus className="h-4 w-4" />,
          onClick: async () => {
            const fileName = prompt("Enter new file name:");
            if (fileName) {
              const newPath = `/${fileName}`;
              await createFile(newPath);
              onRefresh();
            }
          },
        },
        {
          label: "New Folder",
          icon: <FolderPlus className="h-4 w-4" />,
          onClick: async () => {
            const folderName = prompt("Enter new folder name:");
            if (folderName) {
              const newPath = `/${folderName}`;
              await createFolder(newPath);
              onRefresh();
            }
          },
        },
      );
    }

    setContextMenu({
      position: { x: event.clientX, y: event.clientY },
      items,
    });
  };

  return (
    <div className="h-full w-64 border-r bg-muted/10 flex flex-col">
      <div className="p-2 border-b flex items-center justify-between">
        <span className="font-semibold text-sm">Explorer</span>
        <div className="flex gap-1">
          <button
            type="button"
            className="p-1 hover:bg-muted rounded"
            title="Refresh"
            onClick={onRefresh}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        className="flex-1 overflow-auto p-2"
        onContextMenu={(e) => handleContextMenu(e)}
      >
        {isLoading ? (
          <div className="text-sm text-muted-foreground p-2">
            Loading files...
          </div>
        ) : files.length === 0 ? (
          <div className="text-sm text-muted-foreground p-2">
            No files found
          </div>
        ) : (
          files.map((file) => (
            <FileTreeNodeItem
              key={file.path}
              node={file}
              onSelect={onFileSelect}
              onContextMenu={handleContextMenu}
            />
          ))
        )}
      </div>
      {contextMenu && (
        <ContextMenu
          items={contextMenu.items}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

// API helper functions
async function createFile(path: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/file${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "", languageId: "plaintext" }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create file");
    }
  } catch (error) {
    console.error("Error creating file:", error);
    alert(
      `Failed to create file: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}

async function createFolder(path: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/folder${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create folder");
    }
  } catch (error) {
    console.error("Error creating folder:", error);
    alert(
      `Failed to create folder: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}

async function renamePath(oldPath: string, newPath: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/rename`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldPath, newPath }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to rename");
    }
  } catch (error) {
    console.error("Error renaming:", error);
    alert(
      `Failed to rename: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}

async function deletePath(path: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/path${path}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to delete");
    }
  } catch (error) {
    console.error("Error deleting:", error);
    alert(
      `Failed to delete: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }
}

function FileTreeNodeItem({
  node,
  onSelect,
  onContextMenu,
  level = 0,
}: {
  node: FileTreeNode;
  onSelect: (path: string) => void;
  onContextMenu: (event: React.MouseEvent, node: FileTreeNode) => void;
  level?: number;
}) {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleClick = () => {
    if (node.type === "directory") {
      setIsOpen(!isOpen);
    } else {
      onSelect(node.path);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClick();
    }
  };

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onContextMenu(event, node);
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 py-1 px-2 hover:bg-accent/50 rounded cursor-pointer text-sm",
          level > 0 && "ml-4",
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onContextMenu={handleContextMenu}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        role="button"
        tabIndex={0}
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
              onContextMenu={onContextMenu}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
