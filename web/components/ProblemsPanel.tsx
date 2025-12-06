"use client";

import { useEditorStore } from "@/lib/store";
import { AlertTriangle, ChevronDown, ChevronRight, Info, XCircle } from "lucide-react";
import React, { useMemo, useState } from "react";

const severityOrder: Record<string, number> = {
  error: 0,
  warning: 1,
  info: 2,
  hint: 3,
};

const severityIcon: Record<
  string,
  { icon: React.ReactNode; color: string }
> = {
  error: {
    icon: <XCircle className="h-4 w-4 flex-shrink-0" />,
    color: "text-red-500",
  },
  warning: {
    icon: <AlertTriangle className="h-4 w-4 flex-shrink-0" />,
    color: "text-amber-500",
  },
  info: {
    icon: <Info className="h-4 w-4 flex-shrink-0" />,
    color: "text-blue-500",
  },
  hint: {
    icon: <Info className="h-4 w-4 flex-shrink-0" />,
    color: "text-emerald-500",
  },
};

// Extract filename from URI path
function getFileName(uri: string): string {
  try {
    const url = new URL(uri);
    return url.pathname.split("/").pop() || uri;
  } catch {
    return uri.split("/").pop() || uri;
  }
}

// Extract relative path from URI
function getRelativePath(uri: string): string {
  try {
    const url = new URL(uri);
    return url.pathname;
  } catch {
    return uri;
  }
}

export function ProblemsPanel() {
  const {
    diagnosticItemsByUri,
    diagnosticsByUri,
    isProblemsOpen,
    setProblemsOpen,
    editorManager,
  } = useEditorStore();

  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  // Group diagnostics by file
  const groupedDiagnostics = useMemo(() => {
    const groups: Record<string, typeof diagnosticItemsByUri[string]> = {};
    
    for (const [uri, items] of Object.entries(diagnosticItemsByUri || {})) {
      if (items && items.length > 0) {
        groups[uri] = [...items].sort(
          (a, b) =>
            severityOrder[a.severity] - severityOrder[b.severity] ||
            a.line - b.line ||
            a.column - b.column,
        );
      }
    }
    
    return groups;
  }, [diagnosticItemsByUri]);

  const sortedFiles = useMemo(() => {
    return Object.keys(groupedDiagnostics).sort((a, b) => {
      // Sort by error count desc, then warning count desc, then filename
      const aItems = groupedDiagnostics[a] || [];
      const bItems = groupedDiagnostics[b] || [];
      const aErrors = aItems.filter(i => i.severity === "error").length;
      const bErrors = bItems.filter(i => i.severity === "error").length;
      const aWarnings = aItems.filter(i => i.severity === "warning").length;
      const bWarnings = bItems.filter(i => i.severity === "warning").length;
      
      if (aErrors !== bErrors) return bErrors - aErrors;
      if (aWarnings !== bWarnings) return bWarnings - aWarnings;
      return getFileName(a).localeCompare(getFileName(b));
    });
  }, [groupedDiagnostics]);

  // Auto-expand files with problems
  React.useEffect(() => {
    setExpandedFiles(new Set(sortedFiles));
  }, [sortedFiles]);

  if (!isProblemsOpen) return null;

  const totalErrors = Object.values(diagnosticsByUri).reduce(
    (acc, s) => acc + (s?.errors ?? 0),
    0,
  );
  const totalWarnings = Object.values(diagnosticsByUri).reduce(
    (acc, s) => acc + (s?.warnings ?? 0),
    0,
  );

  const toggleFile = (uri: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev);
      if (next.has(uri)) {
        next.delete(uri);
      } else {
        next.add(uri);
      }
      return next;
    });
  };

  const handleDiagnosticClick = async (item: DiagnosticItem) => {
    if (!editorManager) return;

    const path = getRelativePath(item.uri);
    
    // Check if file is already open
    const currentUri = editorManager.getCurrentUri();
    if (currentUri && currentUri.includes(path)) {
      // File is already open, just reveal position
      editorManager.revealPosition(item.line, item.column);
    } else {
      // Need to open the file first
      try {
        const response = await fetch(`http://localhost:3001/api/file${path}`);
        if (!response.ok) {
          console.error('Failed to fetch file content');
          return;
        }
        const content = await response.text();
        
        // Determine language ID from path
        let languageId = 'plaintext';
        if (path.endsWith('.ts') || path.endsWith('.tsx')) languageId = 'typescript';
        else if (path.endsWith('.js') || path.endsWith('.jsx')) languageId = 'javascript';
        else if (path.endsWith('.json')) languageId = 'json';
        else if (path.endsWith('.md')) languageId = 'markdown';
        
        // Open file
        editorManager.openFile(path, content, languageId);
        
        // Reveal position after a short delay to ensure file is loaded
        setTimeout(() => {
          editorManager.revealPosition(item.line, item.column);
        }, 100);
      } catch (error) {
        console.error('Error loading file:', error);
      }
    }
  };

  const hasProblems = sortedFiles.length > 0;

  return (
    <div className="border-t bg-background flex flex-col" style={{ height: '200px' }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-1.5 text-xs bg-muted/30">
        <div className="flex items-center gap-4">
          <span className="font-medium text-foreground uppercase tracking-wide">Problems</span>
          <div className="flex items-center gap-3 text-muted-foreground">
            <span className="flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5 text-red-500" />
              <span className="tabular-nums">{totalErrors}</span>
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              <span className="tabular-nums">{totalWarnings}</span>
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setProblemsOpen(false)}
          className="rounded p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground"
          aria-label="Close Problems"
        >
          <XCircle className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto text-[13px]">
        {!hasProblems ? (
          <div className="px-4 py-3 text-muted-foreground">
            No problems have been detected in the workspace.
          </div>
        ) : (
          <div className="py-1">
            {sortedFiles.map((uri) => {
              const items = groupedDiagnostics[uri] || [];
              const isExpanded = expandedFiles.has(uri);
              const errorCount = items.filter(i => i.severity === "error").length;
              const warningCount = items.filter(i => i.severity === "warning").length;
              
              return (
                <div key={uri}>
                  {/* File header */}
                  <button
                    type="button"
                    onClick={() => toggleFile(uri)}
                    className="w-full flex items-center gap-1 px-2 py-0.5 hover:bg-muted/50 text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="font-medium text-foreground truncate">
                      {getFileName(uri)}
                    </span>
                    <span className="text-muted-foreground truncate ml-1">
                      {getRelativePath(uri)}
                    </span>
                    <span className="ml-auto flex items-center gap-2 flex-shrink-0 text-xs">
                      {errorCount > 0 && (
                        <span className="flex items-center gap-0.5 text-red-500">
                          <XCircle className="h-3 w-3" />
                          {errorCount}
                        </span>
                      )}
                      {warningCount > 0 && (
                        <span className="flex items-center gap-0.5 text-amber-500">
                          <AlertTriangle className="h-3 w-3" />
                          {warningCount}
                        </span>
                      )}
                    </span>
                  </button>
                  
                  {/* Diagnostics list */}
                  {isExpanded && (
                    <div>
                      {items.map((item, idx) => {
                        const iconInfo = severityIcon[item.severity];
                        return (
                          <div
                            key={`${item.uri}-${item.line}-${item.column}-${idx}`}
                            className="flex items-start gap-2 pl-6 pr-2 py-0.5 hover:bg-muted/40 cursor-pointer"
                            onClick={() => handleDiagnosticClick(item)}
                          >
                            <span className={iconInfo.color}>
                              {iconInfo.icon}
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="text-foreground break-words">{item.message}</span>
                              {item.source && (
                                <span className="text-muted-foreground ml-1">{item.source}</span>
                              )}
                              {item.code && (
                                <span className="text-muted-foreground ml-1">({item.code})</span>
                              )}
                            </span>
                            <span className="text-muted-foreground tabular-nums flex-shrink-0 text-xs">
                              [{item.line}, {item.column}]
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
