import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { RealFileSystem } from './fs/real.js';
import { LanguageServerManager } from './lsp/manager.js';
import { LSPWebSocketServer } from './transport/websocket.js';
import { LSPProxy } from './lsp/proxy.js';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root directory
// Look for .env in the project root (two levels up from dist/index.js)
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

// Load environment variables
const PORT = parseInt(process.env.PORT || '3001', 10);
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || '/tmp/online-editor';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Create Express app
const app = express();
const server = createServer(app);

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../web/dist')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    workspace: WORKSPACE_ROOT
  });
});

// Initialize core components
const fileSystem = new RealFileSystem(WORKSPACE_ROOT);
const lsManager = new LanguageServerManager(WORKSPACE_ROOT);
const wsServer = new LSPWebSocketServer(server, '/lsp');

// API endpoint to get file tree
app.get('/api/files', async (req, res) => {
  try {
    const fileTree = await fileSystem.listFileTree();
    res.json(fileTree);
  } catch (error) {
    console.error('[API] Error getting file tree:', error);
    res.status(500).json({ error: 'Failed to get file tree' });
  }
});

// API endpoint to get file content
app.get('/api/file/*', async (req, res) => {
  try {
    // Extract the file path from the URL (everything after /api/file/)
    const params = req.params as { '0'?: string };
    const requestPath = params['0'];
    if (!requestPath) {
      res.status(400).json({ error: 'File path is required' });
      return;
    }
    
    const filePath = '/' + requestPath;
    const content = await fileSystem.readFileContent(filePath);
    res.type('text/plain').send(content);
  } catch (error) {
    console.error('[API] Error reading file:', error);
    const errorMessage = error instanceof Error ? error.message : 'File not found';
    res.status(404).json({ error: errorMessage });
  }
});

// Store proxies per client
const clientProxies = new Map<string, LSPProxy>();

// Handle LSP initialize
wsServer.onMethod('initialize', async (clientId, message) => {
  console.log(`[Server] Client ${clientId} initializing`);
  
  // Create proxy for this client
  const client = wsServer['clients'].get(clientId);
  if (client) {
    const proxy = new LSPProxy(fileSystem, lsManager, client);
    clientProxies.set(clientId, proxy);
  }
  
  // Send initialize response
  wsServer.sendToClient(clientId, {
    jsonrpc: '2.0',
    id: message.id,
    result: {
      capabilities: {
        textDocumentSync: 1, // Full sync
        completionProvider: {
          resolveProvider: false,
          triggerCharacters: ['.', ':', '<', '"', '/', '@']
        },
        hoverProvider: true,
        definitionProvider: true,
        referencesProvider: true
      },
      serverInfo: {
        name: 'online-editor-lsp-proxy',
        version: '1.0.0'
      }
    }
  });
});

// Handle initialized notification
wsServer.onMethod('initialized', async (clientId, message) => {
  console.log(`[Server] Client ${clientId} initialized`);
});

// Handle WebSocket messages
wsServer.onMethod('textDocument/didOpen', async (clientId, message) => {
  let proxy = clientProxies.get(clientId);
  if (!proxy) {
    const client = wsServer['clients'].get(clientId);
    if (client) {
      proxy = new LSPProxy(fileSystem, lsManager, client);
      clientProxies.set(clientId, proxy);
    }
  }

  if (proxy) {
    await proxy.handleMessage(message);
  }
});

wsServer.onMethod('textDocument/didChange', async (clientId, message) => {
  const proxy = clientProxies.get(clientId);
  if (proxy) {
    await proxy.handleMessage(message);
  }
});

wsServer.onMethod('textDocument/didClose', async (clientId, message) => {
  const proxy = clientProxies.get(clientId);
  if (proxy) {
    await proxy.handleMessage(message);
  }
});

wsServer.onMethod('textDocument/didSave', async (clientId, message) => {
  const proxy = clientProxies.get(clientId);
  if (proxy) {
    await proxy.handleMessage(message);
  }
});

wsServer.onMethod('textDocument/completion', async (clientId, message) => {
  const proxy = clientProxies.get(clientId);
  if (proxy) {
    const response = await proxy.handleMessage(message);
    if (response) {
      wsServer.sendToClient(clientId, response);
    }
  }
});

wsServer.onMethod('textDocument/hover', async (clientId, message) => {
  const proxy = clientProxies.get(clientId);
  if (proxy) {
    const response = await proxy.handleMessage(message);
    if (response) {
      wsServer.sendToClient(clientId, response);
    }
  }
});

wsServer.onMethod('textDocument/definition', async (clientId, message) => {
  const proxy = clientProxies.get(clientId);
  if (proxy) {
    const response = await proxy.handleMessage(message);
    if (response) {
      wsServer.sendToClient(clientId, response);
    }
  }
});

wsServer.onMethod('textDocument/references', async (clientId, message) => {
  const proxy = clientProxies.get(clientId);
  if (proxy) {
    const response = await proxy.handleMessage(message);
    if (response) {
      wsServer.sendToClient(clientId, response);
    }
  }
});

// Handle client disconnect
wsServer.onDisconnect((clientId) => {
  clientProxies.delete(clientId);
  console.log(`[Server] Client ${clientId} disconnected, proxy removed`);
});

// Serve frontend in production
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../web/dist/index.html'));
});

// Start server
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║         Online Code Editor Server                         ║
╚════════════════════════════════════════════════════════════╝

Server running on: http://localhost:${PORT}
WebSocket endpoint: ws://localhost:${PORT}/lsp
Workspace root: ${WORKSPACE_ROOT}
Log level: ${LOG_LEVEL}

Supported languages:
  - Go (gopls)
  - TypeScript (typescript-language-server)
  - JavaScript (typescript-language-server)

Press Ctrl+C to stop the server
  `);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[Server] Shutting down gracefully...');

  try {
    // Stop all Language Server clients
    await lsManager.stopAll();

    // Close WebSocket server
    await wsServer.close();

    // Close HTTP server
    server.close(() => {
      console.log('[Server] Server closed');
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      console.error('[Server] Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  } catch (error) {
    console.error('[Server] Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\n[Server] Received SIGTERM, shutting down...');
  process.emit('SIGINT');
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('[Server] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
