# Requirements Document

## Introduction

本文档定义了一个基于 Web 的在线代码编辑器系统的需求。该系统允许用户在浏览器中编写 Go、JavaScript 和 TypeScript 代码，并通过 Language Server Protocol (LSP) 提供智能代码编辑功能，包括错误诊断、代码补全、跳转定义等。系统采用前后端分离架构，前端使用 Monaco Editor，后端使用 Node.js，通过 WebSocket 进行通信。前后端都使用 `@lewin671/lsp-client` 库来处理 LSP 协议通信。

## Glossary

- **Online Editor System**: 完整的在线代码编辑器系统，包括前端编辑器界面和后端 LSP 服务
- **Frontend Client**: 运行在浏览器中的前端应用，提供代码编辑界面，使用 `@lewin671/lsp-client` 通过 WebSocket 与后端通信
- **Backend Server**: 运行在 Node.js 环境中的后端服务，使用 `@lewin671/lsp-client` 管理与 Language Server 的连接
- **LSP Client Library**: `@lewin671/lsp-client` 库，提供通用的 LSP 客户端实现，支持多种传输方式
- **Language Server**: 提供特定编程语言智能功能的服务进程（如 gopls、typescript-language-server）
- **WebSocket Transport**: 自定义的 WebSocket 传输层实现，用于前端 LSP Client 与后端通信
- **Stdio Transport**: 标准输入输出传输层，用于后端 LSP Client 与 Language Server 进程通信
- **Virtual File System**: 后端维护的内存文件系统，用于存储用户编辑的代码文件
- **Diagnostic**: 代码诊断信息，包括错误、警告和提示
- **Completion**: 代码补全建议列表
- **Monaco Editor**: 微软开源的 Web 代码编辑器组件
- **IHost Interface**: LSP Client 的宿主环境抽象接口，定义了 Window、Workspace 和 Configuration 的行为

## Requirements

### Requirement 1

**User Story:** 作为开发者，我希望能够在浏览器中创建和编辑代码文件，以便无需本地开发环境即可编写代码

#### Acceptance Criteria

1. WHEN a user opens the Online Editor System THEN the Frontend Client SHALL display a code editing interface with Monaco Editor
2. WHEN a user creates a new file with a supported extension (.go, .js, .ts) THEN the Backend Server SHALL store the file in the Virtual File System
3. WHEN a user types code in the editor THEN the Frontend Client SHALL send content updates to the Backend Server through the WebSocket Transport
4. WHEN file content changes THEN the Backend Server SHALL synchronize the changes to the Virtual File System within 100 milliseconds
5. WHEN a user switches between files THEN the Frontend Client SHALL load and display the correct file content from the Backend Server

### Requirement 2

**User Story:** 作为开发者，我希望在编写 Go 代码时获得实时错误诊断，以便快速发现和修复代码问题

#### Acceptance Criteria

1. WHEN a user opens a Go file (.go) THEN the Backend Server SHALL start the gopls Language Server if not already running
2. WHEN the gopls Language Server starts THEN the Backend Server LSP Client SHALL establish a connection using Stdio Transport and send initialization requests
3. WHEN a user edits Go code THEN the Backend Server LSP Client SHALL send textDocument/didChange notifications to the gopls Language Server
4. WHEN the gopls Language Server detects errors or warnings THEN the Backend Server LSP Client SHALL receive textDocument/publishDiagnostics notifications
5. WHEN the Backend Server LSP Client receives Diagnostic messages THEN the Backend Server SHALL forward them to the Frontend Client through the WebSocket Transport
6. WHEN the Frontend Client receives Diagnostic messages THEN the Monaco Editor SHALL display error markers and underlines in the code

### Requirement 3

**User Story:** 作为开发者，我希望在编写 JavaScript 和 TypeScript 代码时获得实时错误诊断，以便快速发现和修复代码问题

#### Acceptance Criteria

1. WHEN a user opens a JavaScript or TypeScript file (.js, .ts) THEN the Backend Server SHALL start the typescript-language-server Language Server if not already running
2. WHEN the typescript-language-server Language Server starts THEN the Backend Server LSP Client SHALL establish a connection using Stdio Transport and send initialization requests
3. WHEN a user edits JavaScript or TypeScript code THEN the Backend Server LSP Client SHALL send textDocument/didChange notifications to the typescript-language-server Language Server
4. WHEN the typescript-language-server Language Server detects errors or warnings THEN the Backend Server LSP Client SHALL receive textDocument/publishDiagnostics notifications
5. WHEN the Backend Server LSP Client receives Diagnostic messages THEN the Backend Server SHALL forward them to the Frontend Client through the WebSocket Transport

### Requirement 4

**User Story:** 作为开发者，我希望在编写代码时获得智能代码补全建议，以便提高编码效率和准确性

#### Acceptance Criteria

1. WHEN a user triggers code completion (by typing or pressing Ctrl+Space) THEN the Frontend Client SHALL send a completion request to the Backend Server through the WebSocket Transport
2. WHEN the Backend Server receives a completion request THEN the Backend Server LSP Client SHALL send a textDocument/completion request to the appropriate Language Server
3. WHEN the Language Server returns Completion items THEN the Backend Server LSP Client SHALL receive the completion list
4. WHEN the Backend Server LSP Client receives Completion items THEN the Backend Server SHALL forward them to the Frontend Client through the WebSocket Transport
5. WHEN the Frontend Client receives Completion items THEN the Monaco Editor SHALL display the completion suggestions in a popup menu
6. WHEN a user selects a Completion item THEN the Monaco Editor SHALL insert the selected code at the cursor position

### Requirement 5

**User Story:** 作为开发者，我希望能够跳转到符号定义，以便快速浏览和理解代码结构

#### Acceptance Criteria

1. WHEN a user triggers go-to-definition (by Ctrl+Click or F12) on a symbol THEN the Frontend Client SHALL send a definition request to the Backend Server through the WebSocket Transport
2. WHEN the Backend Server receives a definition request THEN the Backend Server LSP Client SHALL send a textDocument/definition request to the appropriate Language Server
3. WHEN the Language Server returns definition locations THEN the Backend Server LSP Client SHALL receive the location information
4. WHEN the Backend Server LSP Client receives definition locations THEN the Backend Server SHALL forward them to the Frontend Client through the WebSocket Transport
5. WHEN the Frontend Client receives definition locations THEN the Monaco Editor SHALL navigate to the target location

### Requirement 6

**User Story:** 作为开发者，我希望系统能够高效管理多个 Language Server 进程，以便支持多种编程语言而不影响性能

#### Acceptance Criteria

1. WHEN the Backend Server starts THEN the Online Editor System SHALL initialize LSP Client instances with Stdio Transport for each supported language
2. WHEN a file of a specific language is opened for the first time THEN the Backend Server SHALL create a new LSP Client instance and spawn the corresponding Language Server process
3. WHEN a Language Server process is idle for more than 5 minutes THEN the Backend Server SHALL stop the LSP Client and terminate the Language Server process to free resources
4. WHEN multiple files of the same language are open THEN the Backend Server SHALL reuse the same LSP Client instance and Language Server process
5. WHEN a Language Server process crashes THEN the Backend Server SHALL automatically restart the LSP Client and notify the Frontend Client

### Requirement 7

**User Story:** 作为开发者，我希望前端能够使用统一的 LSP Client 架构与后端通信，以便获得一致的 LSP 协议体验

#### Acceptance Criteria

1. WHEN the Frontend Client initializes THEN the Online Editor System SHALL create a Frontend LSP Client instance using the LSP Client Library with custom WebSocket Transport
2. WHEN the Frontend LSP Client starts THEN the Frontend Client SHALL establish a WebSocket Transport connection to the Backend Server
3. WHEN Monaco Editor triggers LSP requests (completion, definition, hover) THEN the Frontend LSP Client SHALL send the requests through the WebSocket Transport to the Backend Server
4. WHEN the Backend Server returns LSP responses THEN the Frontend LSP Client SHALL receive and process them according to the LSP protocol
5. WHEN the Frontend LSP Client receives notifications (diagnostics, log messages) THEN the IHost Interface implementation SHALL update the Monaco Editor UI accordingly

### Requirement 8

**User Story:** 作为开发者，我希望前后端通信稳定可靠，以便在网络波动时仍能正常使用编辑器

#### Acceptance Criteria

1. WHEN the Frontend Client connects to the Backend Server THEN the WebSocket Transport SHALL establish the connection within 3 seconds
2. WHEN the WebSocket Transport connection is interrupted THEN the Frontend Client SHALL attempt to reconnect automatically with exponential backoff
3. WHEN the WebSocket Transport connection is re-established THEN the Frontend Client SHALL resynchronize all open files with the Backend Server
4. WHEN a message fails to send through the WebSocket Transport THEN the Online Editor System SHALL queue the message and retry up to 3 times
5. WHEN the Backend Server is unavailable THEN the Frontend Client SHALL display a connection status indicator to the user

### Requirement 9

**User Story:** 作为开发者，我希望能够在本地运行和部署这个在线编辑器，以便在不同环境中使用

#### Acceptance Criteria

1. WHEN a developer runs npm install in the project root THEN the Online Editor System SHALL install all dependencies for both Frontend Client and Backend Server including the LSP Client Library
2. WHEN a developer runs npm run dev THEN the Backend Server SHALL start on port 3000 and the Frontend Client SHALL start on port 5173 with hot reload enabled
3. WHEN a developer runs npm run build THEN the Online Editor System SHALL compile TypeScript code and bundle the Frontend Client for production
4. WHEN a developer runs npm start in production mode THEN the Backend Server SHALL serve the built Frontend Client static files and handle API requests
5. WHEN the Online Editor System is deployed THEN the Backend Server SHALL support environment variable configuration for ports and Language Server paths

### Requirement 10

**User Story:** 作为开发者，我希望编辑器界面现代化且易用，以便获得良好的用户体验

#### Acceptance Criteria

1. WHEN the Frontend Client loads THEN the Monaco Editor SHALL display with a modern dark theme by default
2. WHEN a user creates or opens files THEN the Frontend Client SHALL display a file tree sidebar for navigation
3. WHEN a user edits code THEN the Monaco Editor SHALL provide syntax highlighting for Go, JavaScript, and TypeScript
4. WHEN a user hovers over a symbol THEN the Monaco Editor SHALL display hover information from the Language Server
5. WHEN the Online Editor System processes requests THEN the Frontend Client SHALL display loading indicators for operations taking longer than 200 milliseconds

### Requirement 11

**User Story:** 作为系统管理员，我希望系统能够处理错误情况并提供清晰的日志，以便快速诊断和解决问题

#### Acceptance Criteria

1. WHEN the Backend Server encounters an error THEN the Online Editor System SHALL log the error with timestamp, severity, and stack trace
2. WHEN a Language Server fails to start THEN the Backend Server SHALL log the failure reason and notify the Frontend Client with a user-friendly error message
3. WHEN the Backend Server LSP Client receives an invalid response from a Language Server THEN the Backend Server SHALL log the invalid response and continue operation
4. WHEN the Virtual File System operations fail THEN the Backend Server SHALL log the error and return appropriate error codes to the Frontend Client
5. WHEN the WebSocket Transport encounters protocol errors THEN the Backend Server SHALL log the error details and attempt to recover the connection
