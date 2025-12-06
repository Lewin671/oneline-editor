import * as monaco from 'monaco-editor';
import { LanguageClient } from '@lewin671/lsp-client';
import { BrowserHost } from './host.js';
import { WebSocketTransport } from '../transport/websocket.js';
import { EditorManager } from '../editor/manager.js';

export class FrontendLSPManager {
  private client: LanguageClient | null = null;
  private host: BrowserHost | null = null;
  private transport: WebSocketTransport | null = null;
  private completionRequestId = 0; // Track completion request sequence
  private lastCompletionPosition: { uri: string; line: number; column: number } | null = null;

  /**
   * Initialize the LSP client
   */
  async initialize(editorManager: EditorManager, wsUrl?: string): Promise<void> {
    // Auto-detect WebSocket URL based on environment
    if (!wsUrl) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      wsUrl = `${protocol}//${host}/lsp`;
    }
    
    console.log('[LSP Manager] Initializing with WebSocket URL:', wsUrl);

    // Create host
    this.host = new BrowserHost();

    // Create transport
    this.transport = new WebSocketTransport(wsUrl);

    // Create client
    this.client = new LanguageClient(
      this.host,
      this.transport,
      {
        textDocument: {
          hover: {
            dynamicRegistration: true,
            contentFormat: ['markdown', 'plaintext']
          },
          completion: {
            dynamicRegistration: true,
            completionItem: {
              snippetSupport: true,
              documentationFormat: ['markdown', 'plaintext']
            }
          },
          definition: {
            dynamicRegistration: true,
            linkSupport: true
          },
          references: {
            dynamicRegistration: true
          },
          documentSymbol: {
            dynamicRegistration: true,
            hierarchicalDocumentSymbolSupport: true
          },
          publishDiagnostics: {
            relatedInformation: true
          }
        },
        workspace: {
          workspaceFolders: true
        }
      }
    );

    // Start client
    try {
      await this.client.start();
      console.log('[LSP Manager] Client started successfully');
    } catch (error) {
      console.error('[LSP Manager] Failed to start client:', error);
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
   * Set up integration with editor manager
   */
  private setupEditorIntegration(editorManager: EditorManager): void {
    // Listen to content changes
    editorManager.onContentChange((uri, content) => {
      if (this.client) {
        const model = editorManager.getModel(uri);
        if (model) {
          this.client.didChange({
            textDocument: {
              uri,
              version: (model as any).getVersionId()
            },
            contentChanges: [{
              text: content
            }]
          });
        }
      }
    });
  }

  /**
   * Register Monaco editor providers for LSP features
   */
  private registerMonacoProviders(): void {
    if (!monaco) {
      console.error('[LSP Manager] Monaco not available');
      return;
    }

    const languages = ['typescript', 'javascript', 'go'];

    languages.forEach(languageId => {
      console.log(`[LSP Manager] Registering completion provider for language: ${languageId}`);
      
      // Completion provider
      monaco.languages.registerCompletionItemProvider(languageId, {
        triggerCharacters: ['.', ':', '<', '"', '/', '@'],
        provideCompletionItems: async (model: any, position: any, context: any, token: any) => {
          const modelLanguage = model.getLanguageId();
          console.log(`[LSP Manager] provideCompletionItems called for language: ${modelLanguage}, registered for: ${languageId}`);
          
          // Only handle if this provider matches the model's language
          if (modelLanguage !== languageId) {
            console.log(`[LSP Manager] Skipping - language mismatch`);
            return { suggestions: [] };
          }
          
          if (!this.client) {
            console.log('[LSP Manager] Client not available for completion');
            return { suggestions: [] };
          }

          // Check the character before cursor to detect if we're after a trigger character
          const lineContent = model.getLineContent(position.lineNumber);
          const charBeforeCursor = position.column > 1 ? lineContent[position.column - 2] : '';
          
          // If we're right after a '.', only respond to TriggerCharacter requests
          // This prevents duplicate completions when typing 'user.' which triggers both
          // an Invoke completion for 'user' and a TriggerCharacter completion for '.'
          if (charBeforeCursor === '.' && context.triggerKind !== 1) {
            console.log(`[LSP Manager] Skipping non-trigger completion after '.'`);
            return { suggestions: [] };
          }

          // Ensure the server has the latest text before requesting completion
          // This avoids races where the completion request reaches the server
          // before the content change notification (leading to global suggestions).
          this.client.didChange({
            textDocument: {
              uri: model.uri.toString(),
              version: model.getVersionId()
            },
            contentChanges: [{ text: model.getValue() }]
          });

          // Increment request ID to track this request
          const currentRequestId = ++this.completionRequestId;
          const requestPosition = { 
            uri: model.uri.toString(), 
            line: position.lineNumber, 
            column: position.column 
          };
          this.lastCompletionPosition = requestPosition;

          try {
            const uri = model.uri.toString();
            console.log(`[LSP Manager] Requesting completion #${currentRequestId} for ${uri} at ${position.lineNumber}:${position.column}`);
            
            // Build LSP completion context
            // Monaco triggerKind: 0 = Invoke, 1 = TriggerCharacter, 2 = TriggerForIncompleteCompletions
            // LSP triggerKind: 1 = Invoked, 2 = TriggerCharacter, 3 = TriggerForIncompleteCompletions
            const lspContext: any = {
              triggerKind: context.triggerKind === 1 ? 2 : (context.triggerKind === 2 ? 3 : 1)
            };
            if (context.triggerCharacter) {
              lspContext.triggerCharacter = context.triggerCharacter;
            }
            
            console.log(`[LSP Manager] Completion context #${currentRequestId}:`, lspContext);
            
            const result = await this.requestCompletion(
              uri,
              position.lineNumber - 1,
              position.column - 1,
              lspContext
            );

            // Check if this request is still the latest one
            // If a newer request was made, discard this result
            if (currentRequestId !== this.completionRequestId) {
              console.log(`[LSP Manager] Discarding stale completion result #${currentRequestId} (current: #${this.completionRequestId})`);
              return { suggestions: [] };
            }
            
            // Also check if position has changed
            if (this.lastCompletionPosition && 
                (this.lastCompletionPosition.uri !== requestPosition.uri ||
                 this.lastCompletionPosition.line !== requestPosition.line ||
                 this.lastCompletionPosition.column !== requestPosition.column)) {
              console.log(`[LSP Manager] Discarding completion result #${currentRequestId} - position changed`);
              return { suggestions: [] };
            }

            // Check if request was cancelled
            if (token?.isCancellationRequested) {
              console.log(`[LSP Manager] Completion request #${currentRequestId} was cancelled`);
              return { suggestions: [] };
            }

            console.log(`[LSP Manager] Completion result #${currentRequestId}:`, result);

            if (!result) {
              console.log('[LSP Manager] No completion result');
              return { suggestions: [] };
            }

            const items = Array.isArray(result) ? result : result.items || [];

            // If we're in a member-access context (right after '.'), client-filter to member kinds
            // to avoid global suggestions when the server does not filter strictly.
            // Include functions and variables as many servers (e.g. gopls) use these kinds for members.
            const memberKinds = new Set([2, 3, 5, 6, 10]); // Method, Function, Field, Variable, Property
            const isMemberContext = charBeforeCursor === '.';
            const filteredItems = isMemberContext ? items.filter((it: any) => memberKinds.has(it.kind)) : items;
            // If filtering drops everything (e.g. gopls returns Function items), fall back to the original list
            const itemsToUse = isMemberContext && filteredItems.length === 0 ? items : filteredItems;
            console.log(`[LSP Manager] Got ${items.length} completion items` + (isMemberContext ? `, filtered to ${filteredItems.length} member items${itemsToUse === items ? ' (fallback to all)' : ''}` : ''));
            
            // Get the word at the current position for range calculation
            // Use getWordAtPosition to get the full word being typed, not just until cursor
            const wordInfo = model.getWordAtPosition(position);
            let range;
            if (wordInfo) {
              // If we're in the middle of a word, use that word's range
              range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: wordInfo.startColumn,
                endColumn: wordInfo.endColumn
              };
            } else {
              // If no word at position (e.g., after '.' or at start of line),
              // use the current cursor position as both start and end
              range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: position.column,
                endColumn: position.column
              };
            }
            
            console.log(`[LSP Manager] Word at position:`, wordInfo, 'Range:', range);
            
            const suggestions = itemsToUse.map((item: any) => {
              // Handle textEdit if present (from LSP) - prefer LSP's range as it's more accurate
              let itemRange = range;
              let insertText = item.insertText || item.label;
              
              if (item.textEdit) {
                // LSP textEdit can be either TextEdit or InsertReplaceEdit
                if (item.textEdit.range) {
                  const editRange = item.textEdit.range;
                  itemRange = {
                    startLineNumber: editRange.start.line + 1,
                    endLineNumber: editRange.end.line + 1,
                    startColumn: editRange.start.character + 1,
                    endColumn: editRange.end.character + 1
                  };
                } else if (item.textEdit.insert && item.textEdit.replace) {
                  // InsertReplaceEdit - use replace range for consistency
                  const editRange = item.textEdit.replace;
                  itemRange = {
                    startLineNumber: editRange.start.line + 1,
                    endLineNumber: editRange.end.line + 1,
                    startColumn: editRange.start.character + 1,
                    endColumn: editRange.end.character + 1
                  };
                }
                insertText = item.textEdit.newText || insertText;
              }
              
              // For filterText, use the label if not provided
              // This helps Monaco filter completions correctly when typing
              const filterText = item.filterText || item.label;
              
              return {
                label: item.label,
                kind: this.convertCompletionItemKind(item.kind),
                insertText: insertText,
                insertTextRules: item.insertTextFormat === 2 
                  ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet 
                  : undefined,
                detail: item.detail,
                documentation: item.documentation,
                sortText: item.sortText,
                filterText: filterText,
                range: itemRange,
                additionalTextEdits: item.additionalTextEdits?.map((edit: any) => this.convertTextEdit(edit)),
                command: this.convertCommand(item.command)
              };
            });

            console.log(`[LSP Manager] Returning ${suggestions.length} suggestions:`, suggestions.slice(0, 3));
            return { 
              suggestions,
              incomplete: result.isIncomplete || false
            };
          } catch (error) {
            console.error('[LSP Manager] Completion error:', error);
            return { suggestions: [] };
          }
        }
      });

      // Hover provider
      monaco.languages.registerHoverProvider(languageId, {
        provideHover: async (model: any, position: any) => {
          if (!this.client) return null;

          try {
            const uri = model.uri.toString();
            const result = await this.requestHover(
              uri,
              position.lineNumber - 1,
              position.column - 1
            );

            if (!result || !result.contents) return null;

            const contents = Array.isArray(result.contents)
              ? result.contents
              : [result.contents];

            return {
              contents: contents.map((content: any) => {
                if (typeof content === 'string') {
                  return { value: content };
                }
                if (content.language) {
                  return {
                    value: `\`\`\`${content.language}\n${content.value}\n\`\`\``
                  };
                }
                return { value: content.value || '' };
              })
            };
          } catch (error) {
            console.error('[LSP Manager] Hover error:', error);
            return null;
          }
        }
      });

      // Definition provider
      monaco.languages.registerDefinitionProvider(languageId, {
        provideDefinition: async (model: any, position: any) => {
          if (!this.client) return null;

          try {
            const uri = model.uri.toString();
            const result = await this.requestDefinition(
              uri,
              position.lineNumber - 1,
              position.column - 1
            );

            if (!result) return null;

            const locations = Array.isArray(result) ? result : [result];

            return locations.map((loc: any) => ({
              uri: monaco.Uri.parse(loc.uri),
              range: {
                startLineNumber: loc.range.start.line + 1,
                startColumn: loc.range.start.character + 1,
                endLineNumber: loc.range.end.line + 1,
                endColumn: loc.range.end.character + 1
              }
            }));
          } catch (error) {
            console.error('[LSP Manager] Definition error:', error);
            return null;
          }
        }
      });

      // References provider
      monaco.languages.registerReferenceProvider(languageId, {
        provideReferences: async (model: any, position: any) => {
          if (!this.client) return null;

          try {
            const uri = model.uri.toString();
            const result = await this.requestReferences(
              uri,
              position.lineNumber - 1,
              position.column - 1
            );

            if (!result) return null;

            return result.map((loc: any) => ({
              uri: monaco.Uri.parse(loc.uri),
              range: {
                startLineNumber: loc.range.start.line + 1,
                startColumn: loc.range.start.character + 1,
                endLineNumber: loc.range.end.line + 1,
                endColumn: loc.range.end.character + 1
              }
            }));
          } catch (error) {
            console.error('[LSP Manager] References error:', error);
            return null;
          }
        }
      });
    });

    console.log('[LSP Manager] Monaco providers registered');
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
        endColumn: edit.range.end.character + 1
      },
      text: edit.newText
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
      arguments: command.arguments
    };
  }

  /**
   * Convert LSP CompletionItemKind to Monaco CompletionItemKind
   */
  private convertCompletionItemKind(kind?: number): number {
    const monaco = (window as any).monaco;
    if (!monaco || !kind) return 0;

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
      25: CompletionItemKind.TypeParameter
    };

    return kindMap[kind] || CompletionItemKind.Text;
  }

  /**
   * Notify LSP server that a document was opened
   */
  didOpenTextDocument(uri: string, languageId: string, version: number, text: string): void {
    if (this.client) {
      this.client.didOpen({
        textDocument: {
          uri,
          languageId,
          version,
          text
        }
      });
    }
  }

  /**
   * Notify LSP server that a document was closed
   */
  didCloseTextDocument(uri: string): void {
    if (this.client) {
      this.client.didClose({
        textDocument: { uri }
      });
    }
  }

  /**
   * Notify LSP server that a document was saved
   */
  didSaveTextDocument(uri: string, text?: string): void {
    if (this.client) {
      this.client.didSave({
        textDocument: { uri },
        text
      });
    }
  }

  /**
   * Request completion
   */
  async requestCompletion(uri: string, line: number, character: number, context?: any): Promise<any> {
    if (!this.client) {
      throw new Error('LSP client not initialized');
    }

    return this.client.sendRequest('textDocument/completion', {
      textDocument: { uri },
      position: { line, character },
      context
    });
  }

  /**
   * Request hover information
   */
  async requestHover(uri: string, line: number, character: number): Promise<any> {
    if (!this.client) {
      throw new Error('LSP client not initialized');
    }

    return this.client.sendRequest('textDocument/hover', {
      textDocument: { uri },
      position: { line, character }
    });
  }

  /**
   * Request definition
   */
  async requestDefinition(uri: string, line: number, character: number): Promise<any> {
    if (!this.client) {
      throw new Error('LSP client not initialized');
    }

    return this.client.sendRequest('textDocument/definition', {
      textDocument: { uri },
      position: { line, character }
    });
  }

  /**
   * Request references
   */
  async requestReferences(uri: string, line: number, character: number): Promise<any> {
    if (!this.client) {
      throw new Error('LSP client not initialized');
    }

    return this.client.sendRequest('textDocument/references', {
      textDocument: { uri },
      position: { line, character },
      context: { includeDeclaration: true }
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
      console.log('[LSP Manager] Stopping client...');
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

    console.log('[LSP Manager] Client stopped');
  }
}
