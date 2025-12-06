import { ITransport } from "@lewin671/lsp-client";
import {
  DataCallback,
  Disposable,
  Message,
  MessageReader,
  MessageWriter,
  PartialMessageInfo,
} from "vscode-jsonrpc";

export class WebSocketTransport implements ITransport {
  private socket: WebSocket | null = null;
  private reader: WebSocketMessageReader | null = null;
  private writer: WebSocketMessageWriter | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Start with 1 second
  private reconnectTimer: number | null = null;
  private connectionStateListeners: Array<(connected: boolean) => void> = [];

  constructor(private url: string) {}

  onConnectionStateChange(listener: (connected: boolean) => void): void {
    this.connectionStateListeners.push(listener);
  }

  private notifyConnectionState(connected: boolean): void {
    this.connectionStateListeners.forEach((listener) => listener(connected));
  }

  async connect(): Promise<{ reader: MessageReader; writer: MessageWriter }> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(this.url);

        this.socket.onopen = () => {
          console.log("[WebSocket] Connected to server");
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;
          this.notifyConnectionState(true);

          this.reader = new WebSocketMessageReader(this.socket!);
          this.writer = new WebSocketMessageWriter(this.socket!);

          resolve({ reader: this.reader, writer: this.writer });
        };

        this.socket.onerror = (error) => {
          console.error("[WebSocket] Connection error:", error);
          this.notifyConnectionState(false);
          reject(new Error("WebSocket connection failed"));
        };

        this.socket.onclose = () => {
          console.log("[WebSocket] Connection closed");
          this.notifyConnectionState(false);
          this.attemptReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[WebSocket] Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      30000,
    );

    console.log(
      `[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
    );

    this.reconnectTimer = window.setTimeout(async () => {
      try {
        await this.connect();
        console.log("[WebSocket] Reconnected successfully");
      } catch (error) {
        console.error("[WebSocket] Reconnection failed:", error);
      }
    }, delay);
  }

  dispose(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    if (this.reader) {
      this.reader.dispose();
      this.reader = null;
    }

    if (this.writer) {
      this.writer.dispose();
      this.writer = null;
    }
  }
}

class WebSocketMessageReader implements MessageReader {
  private callback: DataCallback | null = null;
  private errorEmitter: Array<(error: Error) => void> = [];
  private closeEmitter: Array<() => void> = [];
  private partialMessageEmitter: Array<(info: PartialMessageInfo) => void> = [];

  constructor(private socket: WebSocket) {
    this.socket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(event.data);
        if (this.callback) {
          this.callback(message);
        }
      } catch (error) {
        this.errorEmitter.forEach((listener) => listener(error as Error));
      }
    });

    this.socket.addEventListener("close", () => {
      this.closeEmitter.forEach((listener) => listener());
    });

    this.socket.addEventListener("error", () => {
      this.errorEmitter.forEach((listener) =>
        listener(new Error("WebSocket error")),
      );
    });
  }

  listen(callback: DataCallback): Disposable {
    this.callback = callback;
    return {
      dispose: () => {
        this.callback = null;
      },
    };
  }

  onError(listener: (error: Error) => void): Disposable {
    this.errorEmitter.push(listener);
    return {
      dispose: () => {
        const index = this.errorEmitter.indexOf(listener);
        if (index >= 0) {
          this.errorEmitter.splice(index, 1);
        }
      },
    };
  }

  onClose(listener: () => void): Disposable {
    this.closeEmitter.push(listener);
    return {
      dispose: () => {
        const index = this.closeEmitter.indexOf(listener);
        if (index >= 0) {
          this.closeEmitter.splice(index, 1);
        }
      },
    };
  }

  onPartialMessage(listener: (info: PartialMessageInfo) => void): Disposable {
    this.partialMessageEmitter.push(listener);
    return {
      dispose: () => {
        const index = this.partialMessageEmitter.indexOf(listener);
        if (index >= 0) {
          this.partialMessageEmitter.splice(index, 1);
        }
      },
    };
  }

  dispose(): void {
    this.callback = null;
    this.errorEmitter = [];
    this.closeEmitter = [];
    this.partialMessageEmitter = [];
  }
}

class WebSocketMessageWriter implements MessageWriter {
  private errorEmitter: Array<
    (data: [Error, Message | undefined, number | undefined]) => void
  > = [];
  private closeEmitter: Array<() => void> = [];
  private messageQueue: any[] = [];
  private maxRetries = 3;

  constructor(private socket: WebSocket) {}

  async write(message: Message): Promise<void> {
    return this.sendWithRetry(message, 0);
  }

  private async sendWithRetry(
    message: Message,
    attempt: number,
  ): Promise<void> {
    if (this.socket.readyState !== WebSocket.OPEN) {
      if (attempt < this.maxRetries) {
        // Queue message and retry
        this.messageQueue.push(message);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return this.sendWithRetry(message, attempt + 1);
      } else {
        const error = new Error("WebSocket not open after retries");
        this.errorEmitter.forEach((listener) =>
          listener([error, message, attempt]),
        );
        throw error;
      }
    }

    try {
      this.socket.send(JSON.stringify(message));

      // Send queued messages
      while (
        this.messageQueue.length > 0 &&
        this.socket.readyState === WebSocket.OPEN
      ) {
        const queuedMessage = this.messageQueue.shift();
        this.socket.send(JSON.stringify(queuedMessage));
      }
    } catch (error) {
      if (attempt < this.maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return this.sendWithRetry(message, attempt + 1);
      } else {
        this.errorEmitter.forEach((listener) =>
          listener([error as Error, message, attempt]),
        );
        throw error;
      }
    }
  }

  onError(
    listener: (data: [Error, Message | undefined, number | undefined]) => void,
  ): Disposable {
    this.errorEmitter.push(listener);
    return {
      dispose: () => {
        const index = this.errorEmitter.indexOf(listener);
        if (index >= 0) {
          this.errorEmitter.splice(index, 1);
        }
      },
    };
  }

  onClose(listener: () => void): Disposable {
    this.closeEmitter.push(listener);
    return {
      dispose: () => {
        const index = this.closeEmitter.indexOf(listener);
        if (index >= 0) {
          this.closeEmitter.splice(index, 1);
        }
      },
    };
  }

  end(): void {
    // Close the socket
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
    }
  }

  dispose(): void {
    this.errorEmitter = [];
    this.closeEmitter = [];
    this.messageQueue = [];
  }
}
