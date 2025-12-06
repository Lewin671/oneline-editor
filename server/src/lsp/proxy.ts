import { VirtualFileSystem } from '../fs/virtual.js';
import { LanguageServerManager } from './manager.js';
import { WebSocket } from 'ws';
import {
  DidOpenTextDocumentParams,
  DidChangeTextDocumentParams,
  DidCloseTextDocumentParams,
  DidSaveTextDocumentParams,
  CompletionParams,
  HoverParams,
  DefinitionParams,
  ReferenceParams
} from 'vscode-languageserver-protocol';

export interface LSPMessage {
  jsonrpc: '2.0';
  id?: number | string | null;
  method?: string;
  params?: any;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export class LSPProxy {
  // Serialize per-document operations to keep order (didChange before completion, etc.)
  private uriLocks: Map<string, Promise<any>> = new Map();
  private mapTempUriToOriginal = (uri: string): string => {
    return this.fileSystem.resolveOriginalUri(uri) || uri;
  };

  constructor(
    private fileSystem: VirtualFileSystem,
    private lsManager: LanguageServerManager,
    private wsConnection: WebSocket
  ) {}

  /**
   * Run a task serialized per URI to guarantee ordering of LSP messages
   */
  private async withUriLock<T>(uri: string, task: () => Promise<T>): Promise<T> {
    const prev = this.uriLocks.get(uri) || Promise.resolve();
    let result: T;
    const current = prev.then(task);
    // Store current promise to chain further tasks
    this.uriLocks.set(uri, current);
    try {
      result = await current;
    } finally {
      // Only clear if we're the last in the chain
      if (this.uriLocks.get(uri) === current) {
        this.uriLocks.delete(uri);
      }
    }
    return result;
  }

  /**
   * Handle incoming LSP request/notification
   */
  async handleMessage(message: LSPMessage): Promise<LSPMessage | void> {
    const { method, params, id } = message;

    if (!method) {
      return this.createErrorResponse(id, -32600, 'Invalid Request: missing method');
    }

    try {
      switch (method) {
        case 'textDocument/didOpen':
          await this.handleDidOpen(params as DidOpenTextDocumentParams);
          return; // Notification, no response

        case 'textDocument/didChange':
          await this.handleDidChange(params as DidChangeTextDocumentParams);
          return; // Notification, no response

        case 'textDocument/didClose':
          await this.handleDidClose(params as DidCloseTextDocumentParams);
          return; // Notification, no response

        case 'textDocument/didSave':
          await this.handleDidSave(params as DidSaveTextDocumentParams);
          return; // Notification, no response

        case 'textDocument/completion':
          const completionResult = await this.handleCompletion(params as CompletionParams);
          return this.createSuccessResponse(id, completionResult);

        case 'textDocument/hover':
          const hoverResult = await this.handleHover(params as HoverParams);
          return this.createSuccessResponse(id, hoverResult);

        case 'textDocument/definition':
          const definitionResult = await this.handleDefinition(params as DefinitionParams);
          return this.createSuccessResponse(id, definitionResult);

        case 'textDocument/references':
          const referencesResult = await this.handleReferences(params as ReferenceParams);
          return this.createSuccessResponse(id, referencesResult);

        default:
          return this.createErrorResponse(id, -32601, `Method not found: ${method}`);
      }
    } catch (error) {
      console.error(`[LSP Proxy] Error handling ${method}:`, error);
      return this.createErrorResponse(
        id,
        -32603,
        `Internal error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handle textDocument/didOpen
   */
  private async handleDidOpen(params: DidOpenTextDocumentParams): Promise<void> {
    const { textDocument } = params;

    console.log(`[LSP Proxy] didOpen: ${textDocument.uri}, language: ${textDocument.languageId}`);

    await this.withUriLock(textDocument.uri, async () => {

      // Save to virtual file system
      this.fileSystem.createFile(
        textDocument.uri,
        textDocument.text,
        textDocument.languageId
      );

      // Write to temp directory
      const tempPath = await this.fileSystem.writeToTempDir(textDocument.uri);
      console.log(`[LSP Proxy] File written to: ${tempPath}`);

      // Get or create Language Server client
      const client = await this.lsManager.getOrCreateClient(textDocument.languageId, {
        wsConnection: this.wsConnection,
        mapUri: this.mapTempUriToOriginal
      });

      // Forward to Language Server with the temp file URI
      const tempUri = `file://${tempPath}`;
      console.log(`[LSP Proxy] Forwarding didOpen to LS with URI: ${tempUri}`);
      
      client.didOpen({
        textDocument: {
          uri: tempUri,
          languageId: textDocument.languageId,
          version: textDocument.version,
          text: textDocument.text
        }
      });
    });
  }

  /**
   * Handle textDocument/didChange
   */
  private async handleDidChange(params: DidChangeTextDocumentParams): Promise<void> {
    const { textDocument, contentChanges } = params;

    console.log(`[LSP Proxy] didChange: ${textDocument.uri}`);

    await this.withUriLock(textDocument.uri, async () => {
      // Update virtual file system
      if (contentChanges.length > 0) {
        const lastChange = contentChanges[contentChanges.length - 1];
        if ('text' in lastChange) {
          this.fileSystem.updateFile(textDocument.uri, lastChange.text);
          const tempPath = await this.fileSystem.writeToTempDir(textDocument.uri);
          console.log(`[LSP Proxy] Updated file at: ${tempPath}`);
        }
      }

      // Get file info
      const file = this.fileSystem.getFile(textDocument.uri);
      if (!file) {
        console.warn(`[LSP Proxy] File not found: ${textDocument.uri}`);
        return;
      }

      // Get Language Server client
      const client = await this.lsManager.getOrCreateClient(file.languageId, {
        wsConnection: this.wsConnection,
        mapUri: this.mapTempUriToOriginal
      });

      // Forward to Language Server with temp file URI
      const tempPath = this.fileSystem.getTempPath(textDocument.uri);
      const tempUri = `file://${tempPath}`;
      
      // Always send full content to ensure LSP has accurate file state
      // This is more reliable than forwarding incremental changes
      client.didChange({
        textDocument: {
          uri: tempUri,
          version: textDocument.version
        },
        contentChanges: [{
          text: file.content
        }]
      });
    });
  }

  /**
   * Handle textDocument/didClose
   */
  private async handleDidClose(params: DidCloseTextDocumentParams): Promise<void> {
    const { textDocument } = params;

    console.log(`[LSP Proxy] didClose: ${textDocument.uri}`);

    await this.withUriLock(textDocument.uri, async () => {
      // Get file info before deleting
      const file = this.fileSystem.getFile(textDocument.uri);
      if (!file) {
        return;
      }

      // Forward to Language Server with temp file URI
      const client = await this.lsManager.getOrCreateClient(file.languageId, {
        wsConnection: this.wsConnection,
        mapUri: this.mapTempUriToOriginal
      });
      const tempPath = this.fileSystem.getTempPath(textDocument.uri);
      const tempUri = `file://${tempPath}`;
      
      client.didClose({
        textDocument: { uri: tempUri }
      });

      // Remove from virtual file system
      this.fileSystem.deleteFile(textDocument.uri);
    });
  }

  /**
   * Handle textDocument/didSave
   */
  private async handleDidSave(params: DidSaveTextDocumentParams): Promise<void> {
    const { textDocument, text } = params;

    console.log(`[LSP Proxy] didSave: ${textDocument.uri}`);

    await this.withUriLock(textDocument.uri, async () => {
      const file = this.fileSystem.getFile(textDocument.uri);
      if (!file) {
        return;
      }

      // Write to temp directory
      await this.fileSystem.writeToTempDir(textDocument.uri);

      // Forward to Language Server with temp file URI
      const client = await this.lsManager.getOrCreateClient(file.languageId, {
        wsConnection: this.wsConnection,
        mapUri: this.mapTempUriToOriginal
      });
      const tempPath = this.fileSystem.getTempPath(textDocument.uri);
      const tempUri = `file://${tempPath}`;
      
      client.didSave({
        textDocument: { uri: tempUri },
        text
      });
    });
  }

  /**
   * Handle textDocument/completion
   */
  private async handleCompletion(params: CompletionParams): Promise<any> {
    console.log(`[LSP Proxy] Handling completion request for ${params.textDocument.uri}`);

    return this.withUriLock(params.textDocument.uri, async () => {
      const file = this.fileSystem.getFile(params.textDocument.uri);
      if (!file) {
        console.error(`[LSP Proxy] File not found: ${params.textDocument.uri}`);
        throw new Error(`File not found: ${params.textDocument.uri}`);
      }

      console.log(`[LSP Proxy] File found, language: ${file.languageId}`);
      const client = await this.lsManager.getOrCreateClient(file.languageId, {
        wsConnection: this.wsConnection,
        mapUri: this.mapTempUriToOriginal
      });
      
      // Ensure latest content is flushed to temp path before requesting completion
      const tempPath = await this.fileSystem.writeToTempDir(params.textDocument.uri);
      const tempUri = `file://${tempPath}`;
      
      console.log(`[LSP Proxy] Sending completion request to language server with URI: ${tempUri}`);
      const result = await client.sendRequest('textDocument/completion', {
        textDocument: { uri: tempUri },
        position: params.position,
        context: params.context
      });
      console.log(`[LSP Proxy] Completion result:`, result);
      
      return result;
    });
  }

  /**
   * Handle textDocument/hover
   */
  private async handleHover(params: HoverParams): Promise<any> {
    return this.withUriLock(params.textDocument.uri, async () => {
      const file = this.fileSystem.getFile(params.textDocument.uri);
      if (!file) {
        throw new Error(`File not found: ${params.textDocument.uri}`);
      }

      const client = await this.lsManager.getOrCreateClient(file.languageId, {
        wsConnection: this.wsConnection,
        mapUri: this.mapTempUriToOriginal
      });
      const tempPath = await this.fileSystem.writeToTempDir(params.textDocument.uri);
      const tempUri = `file://${tempPath}`;
      
      return client.sendRequest('textDocument/hover', {
        textDocument: { uri: tempUri },
        position: params.position
      });
    });
  }

  /**
   * Handle textDocument/definition
   */
  private async handleDefinition(params: DefinitionParams): Promise<any> {
    return this.withUriLock(params.textDocument.uri, async () => {
      const file = this.fileSystem.getFile(params.textDocument.uri);
      if (!file) {
        throw new Error(`File not found: ${params.textDocument.uri}`);
      }

      const client = await this.lsManager.getOrCreateClient(file.languageId, {
        wsConnection: this.wsConnection,
        mapUri: this.mapTempUriToOriginal
      });
      const tempPath = await this.fileSystem.writeToTempDir(params.textDocument.uri);
      const tempUri = `file://${tempPath}`;
      
      return client.sendRequest('textDocument/definition', {
        textDocument: { uri: tempUri },
        position: params.position
      });
    });
  }

  /**
   * Handle textDocument/references
   */
  private async handleReferences(params: ReferenceParams): Promise<any> {
    return this.withUriLock(params.textDocument.uri, async () => {
      const file = this.fileSystem.getFile(params.textDocument.uri);
      if (!file) {
        throw new Error(`File not found: ${params.textDocument.uri}`);
      }

      const client = await this.lsManager.getOrCreateClient(file.languageId, {
        wsConnection: this.wsConnection,
        mapUri: this.mapTempUriToOriginal
      });
      const tempPath = await this.fileSystem.writeToTempDir(params.textDocument.uri);
      const tempUri = `file://${tempPath}`;
      
      return client.sendRequest('textDocument/references', {
        textDocument: { uri: tempUri },
        position: params.position,
        context: params.context
      });
    });
  }

  /**
   * Create success response
   */
  private createSuccessResponse(id: number | string | null | undefined, result: any): LSPMessage {
    return {
      jsonrpc: '2.0',
      id: id !== undefined ? id : null,
      result
    };
  }

  /**
   * Create error response
   */
  private createErrorResponse(id: number | string | null | undefined, code: number, message: string): LSPMessage {
    return {
      jsonrpc: '2.0',
      id: id !== undefined ? id : null,
      error: {
        code,
        message
      }
    };
  }
}
