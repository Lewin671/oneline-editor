import { LanguageClient } from "@lewin671/lsp-client";
import * as monaco from "monaco-editor";
import { EditorManager } from "../editor/manager";
import { WebSocketTransport } from "../transport/websocket";
import { BrowserHost, BrowserWindow } from "./host";

export class FrontendLSPManager {
  private client: LanguageClient | null = null;
  private host: BrowserHost | null = null;
  private transport: WebSocketTransport | null = null;
  private completionRequestId = 0; // Track completion request sequence
  private lastCompletionPosition: {
    uri: string;
    line: number;
    column: number;
  } | null = null;
  private disposables: monaco.IDisposable[] = [];
  private openedDocuments = new Set<string>();

  /**
   * Initialize the LSP client
   */
  async initialize(
    editorManager: EditorManager,
    wsUrl?: string,
    onConnectionStateChange?: (connected: boolean) => void,
  ): Promise<void> {
    // Auto-detect WebSocket URL based on environment
    if (!wsUrl) {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      // In development, connect directly to backend server on port 3001
      // In production, use the same host (assuming backend is proxied)
      const isDev = process.env.NODE_ENV === "development";
      const host = isDev ? "localhost:3001" : window.location.host;
      wsUrl = `${protocol}//${host}/lsp`;
    }

    console.log("[LSP Manager] Initializing with WebSocket URL:", wsUrl);

    // Create host
    this.host = new BrowserHost();

    // Create transport
    this.transport = new WebSocketTransport(wsUrl);

    // Listen to connection state changes
    if (onConnectionStateChange) {
      this.transport.onConnectionStateChange(onConnectionStateChange);
    }

    // Create client
    this.client = new LanguageClient(this.host, this.transport, {
      textDocument: {
        hover: {
          dynamicRegistration: true,
          contentFormat: ["markdown", "plaintext"],
        },
        completion: {
          dynamicRegistration: true,
          completionItem: {
            snippetSupport: true,
            documentationFormat: ["markdown", "plaintext"],
          },
        },
        definition: {
          dynamicRegistration: true,
          linkSupport: true,
        },
        references: {
          dynamicRegistration: true,
        },
        documentSymbol: {
          dynamicRegistration: true,
          hierarchicalDocumentSymbolSupport: true,
        },
        publishDiagnostics: {
          relatedInformation: true,
        },
      },
      workspace: {
        workspaceFolders: true,
      },
    });

    // Start client
    try {
      await this.client.start();
      console.log("[LSP Manager] Client started successfully");
    } catch (error) {
      console.error("[LSP Manager] Failed to start client:", error);
      throw error;
    }

    // Set up editor integration
    this.setupEditorIntegration(editorManager);
  }

  /**
   * Register Monaco providers after editor is ready
   */
  registerProviders(): void {
    this.registerMonacoProviders();
  }

  /**
   * Sync document with LSP server
   */
  private syncDocumentWithLSP(
    editorManager: EditorManager,
    uri: string,
    content?: string,
  ): void {
    if (!this.client) return;

    const model = editorManager.getModel(uri);
    if (!model) return;

    // Always use model.uri.toString() for consistent URI format
    const modelUri = model.uri.toString();
    const text = content ?? model.getValue();

    if (!this.isDocumentOpen(modelUri)) {
      this.didOpenTextDocument(
        modelUri,
        model.getLanguageId(),
        (model as any).getVersionId?.() ?? 1,
        text,
      );
    }

    this.client.didChange({
      textDocument: {
        uri: modelUri,
        version: (model as any).getVersionId(),
      },
      contentChanges: [
        {
          text,
        },
      ],
    });
  }

  /**
   * Set up integration with editor manager
   */
  private setupEditorIntegration(editorManager: EditorManager): void {
    // Sync all already-opened files to LSP server
    // This ensures files opened before LSP connection get LSP features
    const openFiles = editorManager.getOpenFiles();
    openFiles.forEach((uri) => {
      this.syncDocumentWithLSP(editorManager, uri);
    });

    // Listen to file open events to restore diagnostics and sync with LSP
    editorManager.onFileOpen((uri) => {
      this.restoreDiagnostics(uri);
      this.syncDocumentWithLSP(editorManager, uri);
    });

    // Listen to content changes
    editorManager.onContentChange((uri, content) => {
      this.syncDocumentWithLSP(editorManager, uri, content);
    });
  }

  /**
   * Restore diagnostics for a file
   */
  restoreDiagnostics(uri: string): void {
    if (this.host && this.host.window instanceof BrowserWindow) {
      (this.host.window as BrowserWindow).reapplyDiagnostics(uri);
    }
  }

  /**
   * Register Monaco editor providers for LSP features
   */
  private registerMonacoProviders(): void {
    if (!monaco) {
      console.error("[LSP Manager] Monaco not available");
      return;
    }

    const languages = ["typescript", "javascript", "go"];

    languages.forEach((languageId) => {
      console.log(
        `[LSP Manager] Registering completion provider for language: ${languageId}`,
      );

      // Completion provider
      this.disposables.push(
        monaco.languages.registerCompletionItemProvider(languageId, {
          triggerCharacters: [".", ":", "<", '"', "/", "@"],
          provideCompletionItems: async (
            model: any,
            position: any,
            context: any,
            token: any,
          ) => {
            const modelLanguage = model.getLanguageId();

            // Only handle if this provider matches the model's language
            if (modelLanguage !== languageId) {
              return { suggestions: [] };
            }

            if (!this.client) {
              return { suggestions: [] };
            }

            // Check the character before cursor to detect if we're after a trigger character
            const lineContent = model.getLineContent(position.lineNumber);
            const charBeforeCursor =
              position.column > 1 ? lineContent[position.column - 2] : "";

            // If we're right after a '.', only respond to TriggerCharacter requests
            if (charBeforeCursor === "." && context.triggerKind !== 1) {
              return { suggestions: [] };
            }

            // Ensure the server has the latest text before requesting completion
            this.client.didChange({
              textDocument: {
                uri: model.uri.toString(),
                version: model.getVersionId(),
              },
              contentChanges: [{ text: model.getValue() }],
            });

            // Increment request ID to track this request
            const currentRequestId = ++this.completionRequestId;
            const requestPosition = {
              uri: model.uri.toString(),
              line: position.lineNumber,
              column: position.column,
            };
            this.lastCompletionPosition = requestPosition;

            try {
              const uri = model.uri.toString();

              // Build LSP completion context
              const lspContext: any = {
                triggerKind:
                  context.triggerKind === 1
                    ? 2
                    : context.triggerKind === 2
                      ? 3
                      : 1,
              };
              if (context.triggerCharacter) {
                lspContext.triggerCharacter = context.triggerCharacter;
              }

              const result = await this.requestCompletion(
                uri,
                position.lineNumber - 1,
                position.column - 1,
                lspContext,
              );

              // Check if this request is still the latest one
              if (currentRequestId !== this.completionRequestId) {
                return { suggestions: [] };
              }

              // Also check if position has changed
              if (
                this.lastCompletionPosition &&
                (this.lastCompletionPosition.uri !== requestPosition.uri ||
                  this.lastCompletionPosition.line !== requestPosition.line ||
                  this.lastCompletionPosition.column !== requestPosition.column)
              ) {
                return { suggestions: [] };
              }

              // Check if request was cancelled
              if (token?.isCancellationRequested) {
                return { suggestions: [] };
              }

              if (!result) {
                return { suggestions: [] };
              }

              const items = Array.isArray(result) ? result : result.items || [];

              const memberKinds = new Set([2, 3, 5, 6, 10]); // Method, Function, Field, Variable, Property
              const isMemberContext = charBeforeCursor === ".";
              const filteredItems = isMemberContext
                ? items.filter((it: any) => memberKinds.has(it.kind))
                : items;
              const itemsToUse =
                isMemberContext && filteredItems.length === 0
                  ? items
                  : filteredItems;

              const wordInfo = model.getWordAtPosition(position);
              let range: any;
              if (wordInfo) {
                range = {
                  startLineNumber: position.lineNumber,
                  endLineNumber: position.lineNumber,
                  startColumn: wordInfo.startColumn,
                  endColumn: wordInfo.endColumn,
                };
              } else {
                range = {
                  startLineNumber: position.lineNumber,
                  endLineNumber: position.lineNumber,
                  startColumn: position.column,
                  endColumn: position.column,
                };
              }

              const suggestions = itemsToUse.map((item: any) => {
                let itemRange = range;
                let insertText = item.insertText || item.label;

                if (item.textEdit) {
                  if (item.textEdit.range) {
                    const editRange = item.textEdit.range;
                    itemRange = {
                      startLineNumber: editRange.start.line + 1,
                      endLineNumber: editRange.end.line + 1,
                      startColumn: editRange.start.character + 1,
                      endColumn: editRange.end.character + 1,
                    };
                  } else if (item.textEdit.insert && item.textEdit.replace) {
                    const editRange = item.textEdit.replace;
                    itemRange = {
                      startLineNumber: editRange.start.line + 1,
                      endLineNumber: editRange.end.line + 1,
                      startColumn: editRange.start.character + 1,
                      endColumn: editRange.end.character + 1,
                    };
                  }
                  insertText = item.textEdit.newText || insertText;
                }

                const filterText = item.filterText || item.label;

                return {
                  label: item.label,
                  kind: this.convertCompletionItemKind(item.kind),
                  insertText: insertText,
                  insertTextRules:
                    item.insertTextFormat === 2
                      ? monaco.languages.CompletionItemInsertTextRule
                          .InsertAsSnippet
                      : undefined,
                  detail: item.detail,
                  documentation: item.documentation,
                  sortText: item.sortText,
                  filterText: filterText,
                  range: itemRange,
                  additionalTextEdits: item.additionalTextEdits?.map(
                    (edit: any) => this.convertTextEdit(edit),
                  ),
                  command: this.convertCommand(item.command),
                };
              });

              return {
                suggestions,
                incomplete: result.isIncomplete || false,
              };
            } catch (error) {
              console.error("[LSP Manager] Completion error:", error);
              return { suggestions: [] };
            }
          },
        }),
      );

      // Hover provider
      this.disposables.push(
        monaco.languages.registerHoverProvider(languageId, {
          provideHover: async (model: any, position: any) => {
            if (!this.client) return null;

            try {
              const uri = model.uri.toString();
              const result = await this.requestHover(
                uri,
                position.lineNumber - 1,
                position.column - 1,
              );

              if (!result || !result.contents) return null;

              const contents = Array.isArray(result.contents)
                ? result.contents
                : [result.contents];

              return {
                contents: contents.map((content: any) => {
                  if (typeof content === "string") {
                    return { value: content };
                  }
                  if (content.language) {
                    return {
                      value: `\`\`\`${content.language}\n${content.value}\n\`\`\``,
                    };
                  }
                  return { value: content.value || "" };
                }),
              };
            } catch (error) {
              console.error("[LSP Manager] Hover error:", error);
              return null;
            }
          },
        }),
      );

      // Definition provider
      this.disposables.push(
        monaco.languages.registerDefinitionProvider(languageId, {
          provideDefinition: async (model: any, position: any) => {
            if (!this.client) return null;

            try {
              const uri = model.uri.toString();
              const result = await this.requestDefinition(
                uri,
                position.lineNumber - 1,
                position.column - 1,
              );

              if (!result) return null;

              const locations = Array.isArray(result) ? result : [result];

              return locations.map((loc: any) => ({
                uri: monaco.Uri.parse(loc.uri),
                range: {
                  startLineNumber: loc.range.start.line + 1,
                  startColumn: loc.range.start.character + 1,
                  endLineNumber: loc.range.end.line + 1,
                  endColumn: loc.range.end.character + 1,
                },
              }));
            } catch (error) {
              console.error("[LSP Manager] Definition error:", error);
              return null;
            }
          },
        }),
      );

      // References provider
      this.disposables.push(
        monaco.languages.registerReferenceProvider(languageId, {
          provideReferences: async (model: any, position: any) => {
            if (!this.client) return null;

            try {
              const uri = model.uri.toString();
              const result = await this.requestReferences(
                uri,
                position.lineNumber - 1,
                position.column - 1,
              );

              if (!result) return null;

              return result.map((loc: any) => ({
                uri: monaco.Uri.parse(loc.uri),
                range: {
                  startLineNumber: loc.range.start.line + 1,
                  startColumn: loc.range.start.character + 1,
                  endLineNumber: loc.range.end.line + 1,
                  endColumn: loc.range.end.character + 1,
                },
              }));
            } catch (error) {
              console.error("[LSP Manager] References error:", error);
              return null;
            }
          },
        }),
      );
    });

    console.log("[LSP Manager] Monaco providers registered");
  }

  /**
   * Convert LSP TextEdit to Monaco ISingleEditOperation
   */
  private convertTextEdit(edit: any): any {
    if (!edit) return undefined;
    return {
      range: {
        startLineNumber: edit.range.start.line + 1,
        startColumn: edit.range.start.character + 1,
        endLineNumber: edit.range.end.line + 1,
        endColumn: edit.range.end.character + 1,
      },
      text: edit.newText,
    };
  }

  /**
   * Convert LSP Command to Monaco Command
   */
  private convertCommand(command: any): any {
    if (!command) return undefined;
    return {
      id: command.command,
      title: command.title,
      arguments: command.arguments,
    };
  }

  /**
   * Convert LSP CompletionItemKind to Monaco CompletionItemKind
   */
  private convertCompletionItemKind(kind?: number): number {
    if (!kind) return 0;

    const CompletionItemKind = monaco.languages.CompletionItemKind;

    // LSP CompletionItemKind mapping
    const kindMap: { [key: number]: number } = {
      1: CompletionItemKind.Text,
      2: CompletionItemKind.Method,
      3: CompletionItemKind.Function,
      4: CompletionItemKind.Constructor,
      5: CompletionItemKind.Field,
      6: CompletionItemKind.Variable,
      7: CompletionItemKind.Class,
      8: CompletionItemKind.Interface,
      9: CompletionItemKind.Module,
      10: CompletionItemKind.Property,
      11: CompletionItemKind.Unit,
      12: CompletionItemKind.Value,
      13: CompletionItemKind.Enum,
      14: CompletionItemKind.Keyword,
      15: CompletionItemKind.Snippet,
      16: CompletionItemKind.Color,
      17: CompletionItemKind.File,
      18: CompletionItemKind.Reference,
      19: CompletionItemKind.Folder,
      20: CompletionItemKind.EnumMember,
      21: CompletionItemKind.Constant,
      22: CompletionItemKind.Struct,
      23: CompletionItemKind.Event,
      24: CompletionItemKind.Operator,
      25: CompletionItemKind.TypeParameter,
    };

    return kindMap[kind] || CompletionItemKind.Text;
  }

  /**
   * Notify LSP server that a document was opened
   */
  didOpenTextDocument(
    uri: string,
    languageId: string,
    version: number,
    text: string,
  ): void {
    if (!this.client || this.openedDocuments.has(uri)) {
      return;
    }

    this.openedDocuments.add(uri);
    this.client.didOpen({
      textDocument: {
        uri,
        languageId,
        version,
        text,
      },
    });
  }

  /**
   * Notify LSP server that a document was closed
   */
  didCloseTextDocument(uri: string): void {
    if (!this.client || !this.openedDocuments.has(uri)) {
      return;
    }

    this.client.didClose({
      textDocument: { uri },
    });
    this.openedDocuments.delete(uri);
  }

  /**
   * Notify LSP server that a document was saved
   */
  didSaveTextDocument(uri: string, text?: string): void {
    if (this.client) {
      this.client.didSave({
        textDocument: { uri },
        text,
      });
    }
  }

  /**
   * Request completion
   */
  async requestCompletion(
    uri: string,
    line: number,
    character: number,
    context?: any,
  ): Promise<any> {
    if (!this.client) {
      throw new Error("LSP client not initialized");
    }

    return this.client.sendRequest("textDocument/completion", {
      textDocument: { uri },
      position: { line, character },
      context,
    });
  }

  /**
   * Request hover information
   */
  async requestHover(
    uri: string,
    line: number,
    character: number,
  ): Promise<any> {
    if (!this.client) {
      throw new Error("LSP client not initialized");
    }

    return this.client.sendRequest("textDocument/hover", {
      textDocument: { uri },
      position: { line, character },
    });
  }

  /**
   * Request definition
   */
  async requestDefinition(
    uri: string,
    line: number,
    character: number,
  ): Promise<any> {
    if (!this.client) {
      throw new Error("LSP client not initialized");
    }

    return this.client.sendRequest("textDocument/definition", {
      textDocument: { uri },
      position: { line, character },
    });
  }

  /**
   * Request references
   */
  async requestReferences(
    uri: string,
    line: number,
    character: number,
  ): Promise<any> {
    if (!this.client) {
      throw new Error("LSP client not initialized");
    }

    return this.client.sendRequest("textDocument/references", {
      textDocument: { uri },
      position: { line, character },
      context: { includeDeclaration: true },
    });
  }

  /**
   * Get the LSP client instance
   */
  getClient(): LanguageClient | null {
    return this.client;
  }

  /**
   * Check if client is running
   */
  isRunning(): boolean {
    return this.client !== null && this.client.isRunning();
  }

  /**
   * Stop the LSP client
   */
  async stop(): Promise<void> {
    if (this.client) {
      console.log("[LSP Manager] Stopping client...");
      await this.client.stop();
      this.client = null;
    }

    if (this.transport) {
      this.transport.dispose();
      this.transport = null;
    }

    if (this.host) {
      this.host.dispose();
      this.host = null;
    }

    // Dispose Monaco providers
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.openedDocuments.clear();

    console.log("[LSP Manager] Client stopped");
  }

  /**
   * Check if a document has been opened with the LSP
   */
  isDocumentOpen(uri: string): boolean {
    return this.openedDocuments.has(uri);
  }
}
