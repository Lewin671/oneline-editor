import { LanguageClient, StdioTransport } from '@lewin671/lsp-client';
import { ServerHost, ServerWindow } from './host.js';
import { WebSocket } from 'ws';

export interface LanguageServerConfig {
  languageId: string;
  command: string;
  args: string[];
  fileExtensions: string[];
}

interface ClientInfo {
  client: LanguageClient;
  host: ServerHost;
  lastUsed: number;
  idleTimer?: NodeJS.Timeout;
}

interface ClientOptions {
  wsConnection?: WebSocket;
  mapUri?: (uri: string) => string;
}

export class LanguageServerManager {
  private clients: Map<string, ClientInfo> = new Map();
  private startingClients: Map<string, Promise<LanguageClient>> = new Map();
  private configs: LanguageServerConfig[];
  private idleTimeout: number = 5 * 60 * 1000; // 5 minutes

  constructor(
    private workspaceRoot: string,
    configs?: LanguageServerConfig[]
  ) {
    this.configs = configs || this.getDefaultConfigs();
  }

  /**
   * Get default language server configurations
   */
  private getDefaultConfigs(): LanguageServerConfig[] {
    return [
      {
        languageId: 'go',
        command: process.env.GOPLS_PATH || 'gopls',
        args: [],
        fileExtensions: ['.go']
      },
      {
        languageId: 'typescript',
        command: process.env.TS_SERVER_PATH || 'typescript-language-server',
        args: ['--stdio'],
        fileExtensions: ['.ts', '.tsx']
      },
      {
        languageId: 'javascript',
        command: process.env.TS_SERVER_PATH || 'typescript-language-server',
        args: ['--stdio'],
        fileExtensions: ['.js', '.jsx']
      }
    ];
  }

  /**
   * Get or create a Language Server client for the specified language
   */
  async getOrCreateClient(languageId: string, options?: ClientOptions): Promise<LanguageClient> {
    const clientInfo = this.clients.get(languageId);

    if (clientInfo) {
      // Update last used time
      clientInfo.lastUsed = Date.now();

      // Clear existing idle timer
      if (clientInfo.idleTimer) {
        clearTimeout(clientInfo.idleTimer);
      }

      // Set new idle timer
      clientInfo.idleTimer = setTimeout(() => {
        this.stopClient(languageId);
      }, this.idleTimeout);

      // If a new WebSocket connection is provided (e.g. after a page refresh),
      // rebind the host window so diagnostics flow to the latest client session.
      if (options?.wsConnection && clientInfo.host.window instanceof ServerWindow) {
        clientInfo.host.window.setConnection(options.wsConnection, options.mapUri);
      }

      return clientInfo.client;
    }

    // Check if a client is currently starting
    const startingPromise = this.startingClients.get(languageId);
    if (startingPromise) {
      return startingPromise;
    }

    // Create new client
    const config = this.configs.find(c => c.languageId === languageId);
    if (!config) {
      throw new Error(`Unsupported language: ${languageId}`);
    }

    console.log(`[LSP Manager] Starting ${languageId} language server: ${config.command}`);
    
    const startPromise = (async () => {
      let retryCount = 0;
      const maxRetries = 3;

      while (retryCount <= maxRetries) {
        try {
          const transport = new StdioTransport(config.command, config.args);
          const host = new ServerHost(this.workspaceRoot, options?.wsConnection, undefined, options?.mapUri);

          const client = new LanguageClient(
            host,
            transport,
            {
              textDocument: {
                hover: { dynamicRegistration: true, contentFormat: ['markdown', 'plaintext'] },
                completion: {
                  dynamicRegistration: true,
                  completionItem: {
                    snippetSupport: true,
                    documentationFormat: ['markdown', 'plaintext']
                  }
                },
                definition: { dynamicRegistration: true, linkSupport: true },
                references: { dynamicRegistration: true },
                documentSymbol: {
                  dynamicRegistration: true,
                  hierarchicalDocumentSymbolSupport: true
                },
                formatting: { dynamicRegistration: true },
                publishDiagnostics: { relatedInformation: true }
              },
              workspace: {
                workspaceFolders: true
              }
            }
          );

          // Start the client
          await client.start();

          // Store client info
          const info: ClientInfo = {
            client,
            host,
            lastUsed: Date.now(),
            idleTimer: setTimeout(() => {
              this.stopClient(languageId);
            }, this.idleTimeout)
          };

          this.clients.set(languageId, info);
          console.log(`[LSP Manager] ${languageId} language server started successfully`);
          
          return client;

        } catch (error) {
          console.error(`[LSP Manager] Failed to start ${languageId} language server (attempt ${retryCount + 1}/${maxRetries + 1}):`, error);
          
          retryCount++;
          if (retryCount <= maxRetries) {
            console.log(`[LSP Manager] Retrying in 1 second...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            throw new Error(`Failed to start ${languageId} language server after ${maxRetries + 1} attempts: ${error}`);
          }
        }
      }
      throw new Error(`Failed to start ${languageId} language server`);
    })();

    this.startingClients.set(languageId, startPromise);

    try {
      return await startPromise;
    } finally {
      this.startingClients.delete(languageId);
    }
  }

  /**
   * Stop a Language Server client
   */
  async stopClient(languageId: string): Promise<void> {
    const clientInfo = this.clients.get(languageId);
    if (!clientInfo) {
      return;
    }

    console.log(`[LSP Manager] Stopping ${languageId} language server`);

    // Clear idle timer
    if (clientInfo.idleTimer) {
      clearTimeout(clientInfo.idleTimer);
    }

    try {
      await clientInfo.client.stop();
      this.clients.delete(languageId);
      console.log(`[LSP Manager] ${languageId} language server stopped`);
    } catch (error) {
      console.error(`[LSP Manager] Error stopping ${languageId} language server:`, error);
      // Remove from map anyway
      this.clients.delete(languageId);
    }
  }

  /**
   * Stop all Language Server clients
   */
  async stopAll(): Promise<void> {
    console.log('[LSP Manager] Stopping all language servers');
    const promises = Array.from(this.clients.keys()).map(id => this.stopClient(id));
    await Promise.all(promises);
  }

  /**
   * Get language ID from file extension
   */
  getLanguageIdFromExtension(extension: string): string | undefined {
    const config = this.configs.find(c =>
      c.fileExtensions.includes(extension)
    );
    return config?.languageId;
  }

  /**
   * Get language ID from URI
   */
  getLanguageIdFromUri(uri: string): string | undefined {
    const match = uri.match(/\.([^.]+)$/);
    if (match) {
      const ext = '.' + match[1];
      return this.getLanguageIdFromExtension(ext);
    }
    return undefined;
  }

  /**
   * Check if a client is running
   */
  isClientRunning(languageId: string): boolean {
    return this.clients.has(languageId);
  }

  /**
   * Get all running client language IDs
   */
  getRunningClients(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Set idle timeout (in milliseconds)
   */
  setIdleTimeout(timeout: number): void {
    this.idleTimeout = timeout;
  }
}
