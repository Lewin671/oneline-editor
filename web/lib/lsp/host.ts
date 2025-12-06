import {
  IConfiguration,
  IHost,
  IWindow,
  IWorkspace,
} from "@lewin671/lsp-client";
import * as monaco from "monaco-editor";
import {
  Diagnostic,
  MessageActionItem,
  MessageType,
} from "vscode-languageserver-protocol";
import { useEditorStore } from "../store";

export class BrowserWindow implements IWindow {
  private diagnosticsMap: Map<string, Diagnostic[]> = new Map();

  showMessage(type: MessageType, message: string): void {
    const level =
      type === MessageType.Error
        ? "error"
        : type === MessageType.Warning
          ? "warning"
          : "info";

    // Show notification in UI
    this.showNotification(level, message);

    // Also log to console
    const typeStr =
      type === MessageType.Error
        ? "ERROR"
        : type === MessageType.Warning
          ? "WARNING"
          : type === MessageType.Info
            ? "INFO"
            : "LOG";
    console.log(`[Window.${typeStr}] ${message}`);
  }

  async showMessageRequest(
    type: MessageType,
    message: string,
    actions?: MessageActionItem[],
  ): Promise<MessageActionItem | undefined> {
    // For now, just show message
    this.showMessage(type, message);
    if (actions && actions.length > 0) {
      console.log("Available actions:", actions.map((a) => a.title).join(", "));
    }
    return undefined;
  }

  logMessage(type: MessageType, message: string): void {
    const level =
      type === MessageType.Error
        ? "error"
        : type === MessageType.Warning
          ? "warn"
          : "log";
    console[level](`[LSP] ${message}`);
  }

  publishDiagnostics(uri: string, diagnostics: Diagnostic[]): void {
    console.log(`[LSP] publishDiagnostics for ${uri}, count: ${diagnostics.length}`);
    let targetUri = uri;
    let model = monaco.editor.getModel(monaco.Uri.parse(uri));

    if (!model) {
      const targetPath = monaco.Uri.parse(uri).path;
      model = monaco.editor
        .getModels()
        .find((m) => targetPath.endsWith(m.uri.path) || m.uri.path.endsWith(targetPath));
      if (model) {
        targetUri = model.uri.toString();
      }
    }

    this.diagnosticsMap.set(targetUri, diagnostics);

    if (model) {
      const markers = diagnostics.map((d) => this.convertDiagnosticToMarker(d));
      monaco.editor.setModelMarkers(model, "lsp", markers);
    }

    // Also push diagnostics into the shared store so the Problems UI updates
    const severityToLabel = (severity?: number): "error" | "warning" | "info" | "hint" => {
      switch (severity) {
        case 1:
          return "error";
        case 2:
          return "warning";
        case 3:
          return "info";
        case 4:
        default:
          return "hint";
      }
    };

    const errors = diagnostics.filter((d) => d.severity === 1).length;
    const warnings = diagnostics.filter((d) => d.severity === 2).length;
    const details = diagnostics.map((d) => ({
      uri: targetUri,
      message: d.message,
      severity: severityToLabel(d.severity),
      line: d.range.start.line + 1,
      column: d.range.start.character + 1,
      source: d.source,
      code: d.code?.toString(),
    }));

    console.log(`[LSP] setDiagnostics: uri=${targetUri}, errors=${errors}, warnings=${warnings}, details=${details.length}`);
    useEditorStore.getState().setDiagnostics(targetUri, { errors, warnings }, details);
  }

  private convertDiagnosticToMarker(
    diagnostic: Diagnostic,
  ): monaco.editor.IMarkerData {
    return {
      severity: this.convertSeverity(diagnostic.severity || 1),
      startLineNumber: diagnostic.range.start.line + 1,
      startColumn: diagnostic.range.start.character + 1,
      endLineNumber: diagnostic.range.end.line + 1,
      endColumn: diagnostic.range.end.character + 1,
      message: diagnostic.message,
      code: diagnostic.code?.toString(),
      source: diagnostic.source,
    };
  }

  private convertSeverity(severity: number): monaco.MarkerSeverity {
    switch (severity) {
      case 1:
        return monaco.MarkerSeverity.Error;
      case 2:
        return monaco.MarkerSeverity.Warning;
      case 3:
        return monaco.MarkerSeverity.Info;
      case 4:
        return monaco.MarkerSeverity.Hint;
      default:
        return monaco.MarkerSeverity.Info;
    }
  }

  private showNotification(level: string, message: string): void {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("lsp-notification", {
          detail: { level, message },
        }),
      );
    }
  }

  getDiagnostics(uri: string): Diagnostic[] {
    return this.diagnosticsMap.get(uri) || [];
  }

  reapplyDiagnostics(uri: string): void {
    console.log(`[LSP] reapplyDiagnostics for ${uri}`);
    let diagnostics = this.diagnosticsMap.get(uri);

    // If not found, try fuzzy matching
    if (!diagnostics) {
      const targetPath = monaco.Uri.parse(uri).path;
      for (const [key, value] of this.diagnosticsMap.entries()) {
        const keyPath = monaco.Uri.parse(key).path;
        // Check if paths match (ignoring scheme/host differences)
        if (
          keyPath === targetPath ||
          (keyPath.length > 1 && targetPath.endsWith(keyPath)) ||
          (targetPath.length > 1 && keyPath.endsWith(targetPath))
        ) {
          console.log(`[LSP] Found fuzzy match for ${uri} -> ${key}`);
          diagnostics = value;
          break;
        }
      }
    }

    if (diagnostics) {
      const model = monaco.editor.getModel(monaco.Uri.parse(uri));
      if (model) {
        const markers = diagnostics.map((d) => this.convertDiagnosticToMarker(d));
        monaco.editor.setModelMarkers(model, "lsp", markers);
      }
    }
  }
}

export class BrowserWorkspace implements IWorkspace {
  rootUri = "file:///workspace";

  setRootUri(uri: string): void {
    this.rootUri = uri;
  }
}

export class BrowserConfiguration implements IConfiguration {
  private config: Record<string, any> = {};

  get(section: string): any {
    if (typeof window === "undefined") return this.config[section] || {};

    // Try to load from localStorage
    const stored = localStorage.getItem(`config.${section}`);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return stored;
      }
    }
    return this.config[section] || {};
  }

  set(section: string, value: any): void {
    this.config[section] = value;
    if (typeof window !== "undefined") {
      localStorage.setItem(`config.${section}`, JSON.stringify(value));
    }
  }
}

export class BrowserHost implements IHost {
  window: IWindow;
  workspace: IWorkspace;
  configuration: IConfiguration;

  constructor() {
    this.window = new BrowserWindow();
    this.workspace = new BrowserWorkspace();
    this.configuration = new BrowserConfiguration();
  }

  dispose(): void {
    // Cleanup if needed
  }
}
