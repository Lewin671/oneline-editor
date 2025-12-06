# Online Code Editor

A modern web-based code editor with Language Server Protocol (LSP) support for Go, JavaScript, and TypeScript.

## Features

- 🚀 Real-time code editing with Monaco Editor
- 🔍 Intelligent code completion, hover information, and go-to-definition
- 🐛 Real-time error diagnostics
- 🌐 WebSocket-based communication
- 📁 Real file system integration (directly maps to workspace directory)
- 🎨 Modern dark theme UI
- 🔧 Support for Go, TypeScript, and JavaScript

## Prerequisites

Before running the application, make sure you have the following installed:

- **Node.js** 18+ 
- **npm** or **yarn**
- **gopls** (Go language server): `go install golang.org/x/tools/gopls@latest`
- **typescript-language-server**: `npm install -g typescript-language-server typescript`

## Installation

1. Clone the repository and navigate to the online-editor directory

2. Install dependencies:
```bash
npm install
```

This will install dependencies for both the server and web client.

## Quick Start

After installing dependencies, you can quickly start the application:

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm run build
npm start
# or
./start.sh
```

## Development

To run the application in development mode with hot reload:

```bash
npm run dev
```

This will start:
- Backend server on `http://localhost:3000`
- Frontend dev server on `http://localhost:5173`

Open your browser and navigate to `http://localhost:5173`

## Production Build

To build the application for production:

```bash
npm run build
```

This will:
1. Compile TypeScript code for the backend
2. Bundle the frontend application

To start the production server:

```bash
npm start
```

The server will serve the built frontend and handle LSP requests on `http://localhost:3000`

## Environment Variables

The server automatically loads environment variables from a `.env` file in the root directory (see `.env.example`):

```env
# Server Configuration
PORT=3000
WS_PORT=3000

# Language Server Paths
GOPLS_PATH=gopls
TS_SERVER_PATH=typescript-language-server

# Workspace Configuration
# This is the root directory where all code files will be stored
# The server will directly map to this directory instead of using virtual files
WORKSPACE_ROOT=/tmp/online-editor

# Logging
LOG_LEVEL=info
```

**Important**: Make sure the `WORKSPACE_ROOT` directory exists and has proper read/write permissions before starting the server.

## Project Structure

```
online-editor/
├── server/                 # Backend code
│   ├── src/
│   │   ├── index.ts       # Server entry point
│   │   ├── lsp/           # LSP proxy and manager
│   │   ├── fs/            # File system (real and virtual implementations)
│   │   └── transport/     # WebSocket transport
│   └── tests/             # Backend tests
├── web/                    # Frontend code
│   ├── src/
│   │   ├── main.ts        # Frontend entry point
│   │   ├── editor/        # Monaco Editor integration
│   │   ├── lsp/           # LSP client
│   │   ├── transport/     # WebSocket transport
│   │   └── ui/            # UI components
│   └── tests/             # Frontend tests
└── package.json           # Root package.json
```

## Testing

Run all tests:
```bash
npm test
```

Run unit tests only:
```bash
npm run test:unit
```

Run property-based tests only:
```bash
npm run test:property
```

## Architecture

The application uses a client-server architecture:

1. **Frontend (Browser)**:
   - Monaco Editor for code editing
   - LSP Client using `@lewin671/lsp-client`
   - WebSocket Transport for communication

2. **Backend (Node.js)**:
   - Express server for HTTP
   - WebSocket server for LSP communication
   - LSP Proxy to route requests to Language Servers
   - Real File System for managing code files directly on disk
   - Language Server Manager for lifecycle management

3. **Language Servers**:
   - gopls for Go
   - typescript-language-server for TypeScript/JavaScript

## Troubleshooting

### Language Server not found

Make sure the language servers are installed and in your PATH:

```bash
# Check gopls
which gopls

# Check typescript-language-server
which typescript-language-server
```

### Connection issues

If you see "Disconnected" in the status bar:
1. Check that the backend server is running
2. Check browser console for WebSocket errors
3. Verify the WebSocket URL in the frontend code

### Port already in use

If port 3000 or 5173 is already in use, you can change them:
- Backend: Set `PORT` in `.env`
- Frontend: Modify `server.port` in `web/vite.config.ts`

## License

MIT
