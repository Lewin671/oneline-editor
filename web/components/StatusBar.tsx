"use client";

import { useEditorStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import React from "react";

export function StatusBar() {
  const { isConnected, currentFile } = useEditorStore();

  return (
    <div className="h-6 border-t bg-muted/20 flex items-center px-2 text-xs gap-4">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "w-2 h-2 rounded-full",
            isConnected ? "bg-green-500" : "bg-red-500",
          )}
        />
        <span>{isConnected ? "Connected" : "Disconnected"}</span>
      </div>
      {currentFile && (
        <div>
          <span>{currentFile}</span>
        </div>
      )}
      <div className="flex-1" />
      <div>
        <span>TypeScript</span>
      </div>
    </div>
  );
}
