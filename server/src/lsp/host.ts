import { IHost, IWindow, IWorkspace, IConfiguration } from '@lewin671/lsp-client';
import { MessageType, MessageActionItem, Diagnostic } from 'vscode-languageserver-protocol';
import { WebSocket } from 'ws';

/**
 * Server Window implementation that forwards messages through WebSocket
 */
export class ServerWindow implements IWindow {
  constructor(
    private wsConnection?: WebSocket,
    private mapUri?: (uri: string) => string
  ) {}

  showMessage(type: MessageType, message: string): void {
    if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
      this.wsConnection.send(JSON.stringify({
        jsonrpc: '2.0',
        method: 'window/showMessage',
        params: { type, message }
      }));
    } else {
      const typeStr = type === MessageType.Error ? 'ERROR' :
                      type === MessageType.Warning ? 'WARNING' :
                      type === MessageType.Info ? 'INFO' : 'LOG';
      console.log(`[Window.${typeStr}] ${message}`);
    }
  }

  async showMessageRequest(
    type: MessageType,
    message: string,
    actions?: MessageActionItem[]
  ): Promise<MessageActionItem | undefined> {
    if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
      this.wsConnection.send(JSON.stringify({
        jsonrpc: '2.0',
        method: 'window/showMessageRequest',
        params: { type, message, actions }
      }));
    }
    return undefined;
  }

  logMessage(type: MessageType, message: string): void {
    const level = type === MessageType.Error ? 'ERROR' :
                  type === MessageType.Warning ? 'WARNING' :
                  type === MessageType.Info ? 'INFO' : 'LOG';
    console.log(`[${level}] ${message}`);
  }

  publishDiagnostics(uri: string, diagnostics: Diagnostic[]): void {
    const targetUri = this.mapUri ? this.mapUri(uri) : uri;
    if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
      this.wsConnection.send(JSON.stringify({
        jsonrpc: '2.0',
        method: 'textDocument/publishDiagnostics',
        params: { uri: targetUri, diagnostics }
      }));
    } else {
      console.log(`[Diagnostics] ${targetUri}: ${diagnostics.length} issue(s)`);
    }
  }
}

/**
 * Console-only Window implementation for when no WebSocket is available
 */
export class ConsoleWindow implements IWindow {
  constructor(private mapUri?: (uri: string) => string) {}

  showMessage(type: MessageType, message: string): void {
    const typeStr = type === MessageType.Error ? 'ERROR' :
                    type === MessageType.Warning ? 'WARNING' :
                    type === MessageType.Info ? 'INFO' : 'LOG';
    console.log(`[Message.${typeStr}] ${message}`);
  }

  async showMessageRequest(
    type: MessageType,
    message: string,
    actions?: MessageActionItem[]
  ): Promise<MessageActionItem | undefined> {
    console.log(`[MessageRequest] ${message}`);
    if (actions) {
      console.log(`  Actions: ${actions.map(a => a.title).join(', ')}`);
    }
    return undefined;
  }

  logMessage(type: MessageType, message: string): void {
    const level = type === MessageType.Error ? 'ERROR' :
                  type === MessageType.Warning ? 'WARNING' :
                  type === MessageType.Info ? 'INFO' : 'LOG';
    console.log(`[${level}] ${message}`);
  }

  publishDiagnostics(uri: string, diagnostics: Diagnostic[]): void {
    const targetUri = this.mapUri ? this.mapUri(uri) : uri;
    console.log(`[Diagnostics] ${targetUri}: ${diagnostics.length} issue(s)`);
    diagnostics.forEach(d => {
      const severity = d.severity === 1 ? 'Error' :
                      d.severity === 2 ? 'Warning' : 'Info';
      console.log(`  [${severity}] Line ${d.range.start.line + 1}: ${d.message}`);
    });
  }
}

/**
 * Server Workspace implementation
 */
export class ServerWorkspace implements IWorkspace {
  constructor(public rootUri: string) {}
}

/**
 * Server Configuration implementation
 */
export class ServerConfiguration implements IConfiguration {
  private config: Record<string, any> = {};

  constructor(config?: Record<string, any>) {
    this.config = config || {};
  }

  get(section: string): any {
    return this.config[section] || {};
  }

  set(section: string, value: any): void {
    this.config[section] = value;
  }
}

/**
 * Server Host implementation
 */
export class ServerHost implements IHost {
  window: IWindow;
  workspace: IWorkspace;
  configuration: IConfiguration;

  constructor(
    workspaceRoot: string,
    wsConnection?: WebSocket,
    config?: Record<string, any>,
    mapUri?: (uri: string) => string
  ) {
    this.window = wsConnection ? new ServerWindow(wsConnection, mapUri) : new ConsoleWindow(mapUri);
    this.workspace = new ServerWorkspace(`file://${workspaceRoot}`);
    this.configuration = new ServerConfiguration(config);
  }

  dispose(): void {
    // Cleanup if needed
  }
}
