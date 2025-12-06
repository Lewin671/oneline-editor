import * as monaco from 'monaco-editor';
import { EditorManager } from './editor/manager.js';
import { FrontendLSPManager } from './lsp/client.js';
import { FileTree, FileTreeNode } from './ui/FileTree.js';
import { StatusBar, withLoadingIndicator } from './ui/StatusBar.js';

// Configure Monaco Environment - disable workers since we're using LSP
(self as any).MonacoEnvironment = {
  getWorker() {
    // Return a dummy worker that does nothing
    return new Worker(
      URL.createObjectURL(
        new Blob(['self.onmessage = () => {}'], { type: 'text/javascript' })
      )
    );
  }
};

// Disable Monaco's built-in TypeScript/JavaScript language features
// We're using LSP for all language intelligence
monaco.languages.typescript.typescriptDefaults.setEagerModelSync(false);
monaco.languages.typescript.javascriptDefaults.setEagerModelSync(false);

// Disable built-in TypeScript mode completions
monaco.languages.typescript.typescriptDefaults.setModeConfiguration({
  completionItems: false,
  hovers: false,
  documentSymbols: false,
  definitions: false,
  references: false,
  documentHighlights: false,
  rename: false,
  diagnostics: false,
  documentRangeFormattingEdits: false,
  signatureHelp: false,
  onTypeFormattingEdits: false,
  codeActions: false,
  inlayHints: false
});
monaco.languages.typescript.javascriptDefaults.setModeConfiguration({
  completionItems: false,
  hovers: false,
  documentSymbols: false,
  definitions: false,
  references: false,
  documentHighlights: false,
  rename: false,
  diagnostics: false,
  documentRangeFormattingEdits: false,
  signatureHelp: false,
  onTypeFormattingEdits: false,
  codeActions: false,
  inlayHints: false
});

monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
  noLib: true,
  allowNonTsExtensions: true
});
monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
  noLib: true,
  allowNonTsExtensions: true
});

monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
  noSemanticValidation: true,
  noSyntaxValidation: true,
  noSuggestionDiagnostics: true
});
monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
  noSemanticValidation: true,
  noSyntaxValidation: true,
  noSuggestionDiagnostics: true
});

class App {
  private editorManager: EditorManager;
  private lspManager: FrontendLSPManager;
  private fileTree: FileTree;
  private statusBar: StatusBar;
  private currentFiles: Map<string, { languageId: string; content: string }> = new Map();

  constructor() {
    this.editorManager = new EditorManager();
    this.lspManager = new FrontendLSPManager();
    this.fileTree = new FileTree(document.getElementById('file-tree')!);
    this.statusBar = new StatusBar(document.getElementById('status-bar')!);
  }

  async initialize(): Promise<void> {
    try {
      // Initialize editor
      const editorContainer = document.getElementById('editor-container');
      if (!editorContainer) {
        throw new Error('Editor container not found');
      }

      this.editorManager.createEditor(editorContainer, {
        theme: 'vs-dark',
        automaticLayout: true
      });

      // Initialize LSP client
      this.statusBar.setStatus('connecting');
      await withLoadingIndicator(
        this.statusBar,
        'lsp-init',
        async () => {
          await this.lspManager.initialize(this.editorManager);
        }
      );
      
      // Register Monaco providers after editor is created
      this.lspManager.registerProviders();
      
      this.statusBar.setStatus('connected');
      this.statusBar.showMessage('LSP client connected', 2000);

      // Set up file tree handlers
      this.setupFileTreeHandlers();

      // Create some sample files
      this.createSampleFiles();

      console.log('[App] Initialization complete');
    } catch (error) {
      console.error('[App] Initialization failed:', error);
      this.statusBar.setStatus('disconnected');
      this.statusBar.showError('Failed to initialize application');
      throw error;
    }
  }

  private setupFileTreeHandlers(): void {
    // Handle file selection
    this.fileTree.onFileSelect(async (path) => {
      await withLoadingIndicator(
        this.statusBar,
        'file-open',
        async () => {
          await this.openFile(path);
        }
      );
    });

    // Handle file creation
    this.fileTree.onFileCreate(async (path, type) => {
      if (type === 'file') {
        await this.createFile(path);
      }
    });

    // Handle file deletion
    this.fileTree.onFileDelete(async (path) => {
      await this.deleteFile(path);
    });
  }

  private async openFile(path: string): Promise<void> {
    const fileInfo = this.currentFiles.get(path);
    if (!fileInfo) {
      console.warn(`File not found: ${path}`);
      return;
    }

    const uri = `file://${path}`;

    // Open in editor
    this.editorManager.openFile(uri, fileInfo.content, fileInfo.languageId);

    // Notify LSP server
    this.lspManager.didOpenTextDocument(uri, fileInfo.languageId, 1, fileInfo.content);

    this.statusBar.showMessage(`Opened: ${path.split('/').pop()}`, 2000);
  }

  private async createFile(path: string): Promise<void> {
    const languageId = this.getLanguageIdFromPath(path);
    const content = this.getDefaultContent(languageId);

    this.currentFiles.set(path, { languageId, content });

    // Add to file tree
    const node: FileTreeNode = {
      name: path.split('/').pop() || path,
      path,
      type: 'file'
    };
    this.fileTree.addFile(node);

    // Open the file
    await this.openFile(path);

    this.statusBar.showMessage(`Created: ${path.split('/').pop()}`, 2000);
  }

  private async deleteFile(path: string): Promise<void> {
    const uri = `file://${path}`;

    // Close in editor if open
    this.editorManager.closeFile(uri);

    // Notify LSP server
    this.lspManager.didCloseTextDocument(uri);

    // Remove from current files
    this.currentFiles.delete(path);

    // Remove from file tree
    this.fileTree.removeFile(path);

    this.statusBar.showMessage(`Deleted: ${path.split('/').pop()}`, 2000);
  }

  private getLanguageIdFromPath(path: string): string {
    if (path.endsWith('.go')) return 'go';
    if (path.endsWith('.ts')) return 'typescript';
    if (path.endsWith('.js')) return 'javascript';
    if (path.endsWith('.json')) return 'json';
    return 'plaintext';
  }

  private getDefaultContent(languageId: string): string {
    switch (languageId) {
      case 'go':
        return `package main

import "fmt"

func main() {
\tfmt.Println("Hello, World!")
}
`;
      case 'typescript':
        return `function greet(name: string): void {
\tconsole.log(\`Hello, \${name}!\`);
}

greet("World");
`;
      case 'javascript':
        return `function greet(name) {
\tconsole.log(\`Hello, \${name}!\`);
}

greet("World");
`;
      default:
        return '';
    }
  }

  private createSampleFiles(): void {
    const sampleFiles: Array<{ path: string; languageId: string; content: string }> = [
      {
        path: '/workspace/main.go',
        languageId: 'go',
        content: `package main

import "fmt"

func main() {
\tfmt.Println("Hello from Go!")
}
`
      },
      {
        path: '/workspace/app.ts',
        languageId: 'typescript',
        content: `interface User {
\tname: string;
\tage: number;
}

function greet(user: User): void {
\tconsole.log(\`Hello, \${user.name}!\`);
}

const user: User = { name: "Alice", age: 30 };
greet(user);
`
      },
      {
        path: '/workspace/utils.js',
        languageId: 'javascript',
        content: `function add(a, b) {
\treturn a + b;
}

function multiply(a, b) {
\treturn a * b;
}

module.exports = { add, multiply };
`
      }
    ];

    const fileNodes: FileTreeNode[] = sampleFiles.map(file => {
      this.currentFiles.set(file.path, {
        languageId: file.languageId,
        content: file.content
      });

      return {
        name: file.path.split('/').pop() || file.path,
        path: file.path,
        type: 'file'
      };
    });

    this.fileTree.setFiles(fileNodes);
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  const app = new App();
  try {
    await app.initialize();
  } catch (error) {
    console.error('Failed to initialize app:', error);
  }
});

// Handle global errors
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled rejection:', event.reason);
});
