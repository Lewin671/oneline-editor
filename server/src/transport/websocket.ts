import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

export interface WebSocketMessage {
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

export class LSPWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocket> = new Map();
  private messageHandlers: Map<string, (clientId: string, message: WebSocketMessage) => void> = new Map();
  private disconnectHandlers: Array<(clientId: string) => void> = [];

  constructor(server: Server, path: string = '/lsp') {
    this.wss = new WebSocketServer({
      server,
      path
    });

    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientId = this.generateClientId();
      this.clients.set(clientId, ws);

      console.log(`[WebSocket] Client connected: ${clientId}`);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as WebSocketMessage;
          this.handleMessage(clientId, message);
        } catch (error) {
          console.error(`[WebSocket] Failed to parse message from ${clientId}:`, error);
          this.sendError(clientId, -32700, 'Parse error');
        }
      });

      ws.on('close', () => {
        console.log(`[WebSocket] Client disconnected: ${clientId}`);
        this.handleDisconnect(clientId);
      });

      ws.on('error', (error) => {
        console.error(`[WebSocket] Error for client ${clientId}:`, error);
      });
    });
  }

  /**
   * Generate a unique client ID
   */
  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Handle incoming message from client
   */
  private handleMessage(clientId: string, message: WebSocketMessage): void {
    const method = message.method;
    if (method) {
      const handler = this.messageHandlers.get(method);
      if (handler) {
        handler(clientId, message);
      } else {
        console.warn(`[WebSocket] No handler for method: ${method}`);
        if (message.id !== undefined) {
          this.sendError(clientId, -32601, `Method not found: ${method}`, message.id);
        }
      }
    }
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(clientId: string): void {
    this.clients.delete(clientId);
    this.disconnectHandlers.forEach(handler => handler(clientId));
  }

  /**
   * Register a message handler for a specific method
   */
  onMethod(method: string, handler: (clientId: string, message: WebSocketMessage) => void): void {
    this.messageHandlers.set(method, handler);
  }

  /**
   * Register a disconnect handler
   */
  onDisconnect(handler: (clientId: string) => void): void {
    this.disconnectHandlers.push(handler);
  }

  /**
   * Send a message to a specific client
   */
  sendToClient(clientId: string, message: WebSocketMessage): boolean {
    const client = this.clients.get(clientId);
    if (client && client.readyState === WebSocket.OPEN) {
      try {
        client.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error(`[WebSocket] Failed to send message to ${clientId}:`, error);
        return false;
      }
    }
    return false;
  }

  /**
   * Send an error response to a client
   */
  sendError(clientId: string, code: number, message: string, id?: number | string | null): void {
    this.sendToClient(clientId, {
      jsonrpc: '2.0',
      id: id !== undefined ? id : null,
      error: {
        code,
        message
      }
    });
  }

  /**
   * Broadcast a message to all connected clients
   */
  broadcast(message: WebSocketMessage): void {
    this.clients.forEach((client, clientId) => {
      this.sendToClient(clientId, message);
    });
  }

  /**
   * Get all connected client IDs
   */
  getClientIds(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Get client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Close the WebSocket server
   */
  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}
