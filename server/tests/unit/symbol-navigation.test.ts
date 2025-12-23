import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LSPProxy, LSPMessage } from '../../src/lsp/proxy';
import { RealFileSystem } from '../../src/fs/real';
import { LanguageServerManager } from '../../src/lsp/manager';
import { WebSocket } from 'ws';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

// Mock the LanguageServerManager to avoid spawning real language servers
vi.mock('../../src/lsp/manager', () => {
  return {
    LanguageServerManager: vi.fn().mockImplementation(() => ({
      getOrCreateClient: vi.fn().mockResolvedValue({
        didOpen: vi.fn(),
        didChange: vi.fn(),
        didClose: vi.fn(),
        didSave: vi.fn(),
        sendRequest: vi.fn().mockImplementation((method, params) => {
          // Mock definition responses
          if (method === 'textDocument/definition') {
            return Promise.resolve({
              uri: params.textDocument.uri,
              range: {
                start: { line: 0, character: 0 },
                end: { line: 0, character: 10 }
              }
            });
          }
          return Promise.resolve(null);
        }),
      }),
    })),
  };
});

describe('Symbol Navigation', () => {
  let proxy: LSPProxy;
  let fileSystem: RealFileSystem;
  let lsManager: LanguageServerManager;
  let mockWs: any;
  let tempWorkspace: string;

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();
    
    // Create temporary workspace directory
    tempWorkspace = await fs.mkdtemp(path.join(os.tmpdir(), 'test-workspace-'));
    
    // Initialize file system
    fileSystem = new RealFileSystem(tempWorkspace);

    // Mock WebSocket
    mockWs = {
      send: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
    } as any;

    // Initialize language server manager
    lsManager = new LanguageServerManager(tempWorkspace);

    // Initialize LSP proxy
    proxy = new LSPProxy(fileSystem, lsManager, mockWs);
  });

  afterEach(async () => {
    // Clean up temporary workspace
    try {
      await fs.rm(tempWorkspace, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to clean up temp workspace:', error);
    }
  });

  describe('TypeScript Symbol Navigation', () => {
    it('should handle definition request for TypeScript function', async () => {
      const uri = 'file:///test.ts';
      
      // Open a TypeScript file with a function definition
      const openMessage: LSPMessage = {
        jsonrpc: '2.0',
        method: 'textDocument/didOpen',
        params: {
          textDocument: {
            uri,
            languageId: 'typescript',
            version: 1,
            text: `function greet(name: string): string {
  return 'Hello, ' + name;
}

const message = greet('World');`,
          },
        },
      };

      await proxy.handleMessage(openMessage);

      // Request definition for the 'greet' function call on line 4
      const definitionMessage: LSPMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'textDocument/definition',
        params: {
          textDocument: { uri },
          position: { line: 4, character: 17 }, // Position on 'greet' in the call
        },
      };

      const response = await proxy.handleMessage(definitionMessage);

      // Should return a response with the definition location
      expect(response).toBeDefined();
      expect(response?.id).toBe(1);
      expect(response?.result).toBeDefined();
      
      // The result could be a Location or Location[] or LocationLink[]
      // We just verify it's not an error
      expect(response?.error).toBeUndefined();
    });

    it('should handle definition request for TypeScript variable', async () => {
      const uri = 'file:///variables.ts';
      
      const openMessage: LSPMessage = {
        jsonrpc: '2.0',
        method: 'textDocument/didOpen',
        params: {
          textDocument: {
            uri,
            languageId: 'typescript',
            version: 1,
            text: `const userName = 'John Doe';
const userAge = 30;

console.log(userName);`,
          },
        },
      };

      await proxy.handleMessage(openMessage);

      // Request definition for 'userName' variable reference
      const definitionMessage: LSPMessage = {
        jsonrpc: '2.0',
        id: 2,
        method: 'textDocument/definition',
        params: {
          textDocument: { uri },
          position: { line: 3, character: 13 }, // Position on 'userName' in console.log
        },
      };

      const response = await proxy.handleMessage(definitionMessage);

      expect(response).toBeDefined();
      expect(response?.id).toBe(2);
      expect(response?.error).toBeUndefined();
      expect(response?.result).toBeDefined();
    });

    it('should handle definition request for TypeScript class', async () => {
      const uri = 'file:///class.ts';
      
      const openMessage: LSPMessage = {
        jsonrpc: '2.0',
        method: 'textDocument/didOpen',
        params: {
          textDocument: {
            uri,
            languageId: 'typescript',
            version: 1,
            text: `class User {
  constructor(public name: string) {}
  
  greet() {
    return 'Hello, ' + this.name;
  }
}

const user = new User('Alice');
user.greet();`,
          },
        },
      };

      await proxy.handleMessage(openMessage);

      // Request definition for 'User' class reference
      const definitionMessage: LSPMessage = {
        jsonrpc: '2.0',
        id: 3,
        method: 'textDocument/definition',
        params: {
          textDocument: { uri },
          position: { line: 8, character: 18 }, // Position on 'User' in constructor call
        },
      };

      const response = await proxy.handleMessage(definitionMessage);

      expect(response).toBeDefined();
      expect(response?.id).toBe(3);
      expect(response?.error).toBeUndefined();
      expect(response?.result).toBeDefined();
    });

    it('should handle definition request for TypeScript interface', async () => {
      const uri = 'file:///interface.ts';
      
      const openMessage: LSPMessage = {
        jsonrpc: '2.0',
        method: 'textDocument/didOpen',
        params: {
          textDocument: {
            uri,
            languageId: 'typescript',
            version: 1,
            text: `interface Person {
  name: string;
  age: number;
}

const person: Person = {
  name: 'Bob',
  age: 25
};`,
          },
        },
      };

      await proxy.handleMessage(openMessage);

      // Request definition for 'Person' interface reference
      const definitionMessage: LSPMessage = {
        jsonrpc: '2.0',
        id: 4,
        method: 'textDocument/definition',
        params: {
          textDocument: { uri },
          position: { line: 5, character: 15 }, // Position on 'Person' type annotation
        },
      };

      const response = await proxy.handleMessage(definitionMessage);

      expect(response).toBeDefined();
      expect(response?.id).toBe(4);
      expect(response?.error).toBeUndefined();
      expect(response?.result).toBeDefined();
    });

    it('should handle definition request for TypeScript import', async () => {
      const utilsUri = 'file:///utils.ts';
      const mainUri = 'file:///main.ts';
      
      // First, create the utils file
      const openUtilsMessage: LSPMessage = {
        jsonrpc: '2.0',
        method: 'textDocument/didOpen',
        params: {
          textDocument: {
            uri: utilsUri,
            languageId: 'typescript',
            version: 1,
            text: `export function add(a: number, b: number): number {
  return a + b;
}`,
          },
        },
      };

      await proxy.handleMessage(openUtilsMessage);

      // Now create the main file that imports from utils
      const openMainMessage: LSPMessage = {
        jsonrpc: '2.0',
        method: 'textDocument/didOpen',
        params: {
          textDocument: {
            uri: mainUri,
            languageId: 'typescript',
            version: 1,
            text: `import { add } from './utils';

const result = add(2, 3);`,
          },
        },
      };

      await proxy.handleMessage(openMainMessage);

      // Request definition for 'add' function in main file
      const definitionMessage: LSPMessage = {
        jsonrpc: '2.0',
        id: 5,
        method: 'textDocument/definition',
        params: {
          textDocument: { uri: mainUri },
          position: { line: 2, character: 16 }, // Position on 'add' function call
        },
      };

      const response = await proxy.handleMessage(definitionMessage);

      expect(response).toBeDefined();
      expect(response?.id).toBe(5);
      expect(response?.error).toBeUndefined();
      expect(response?.result).toBeDefined();
    });
  });

  describe('Go Symbol Navigation', () => {
    it('should handle definition request for Go function', async () => {
      const uri = 'file:///test.go';
      
      const openMessage: LSPMessage = {
        jsonrpc: '2.0',
        method: 'textDocument/didOpen',
        params: {
          textDocument: {
            uri,
            languageId: 'go',
            version: 1,
            text: `package main

import "fmt"

func greet(name string) string {
	return fmt.Sprintf("Hello, %s", name)
}

func main() {
	message := greet("World")
	fmt.Println(message)
}`,
          },
        },
      };

      await proxy.handleMessage(openMessage);

      // Request definition for 'greet' function call
      const definitionMessage: LSPMessage = {
        jsonrpc: '2.0',
        id: 10,
        method: 'textDocument/definition',
        params: {
          textDocument: { uri },
          position: { line: 9, character: 14 }, // Position on 'greet' function call
        },
      };

      const response = await proxy.handleMessage(definitionMessage);

      expect(response).toBeDefined();
      expect(response?.id).toBe(10);
      expect(response?.error).toBeUndefined();
      expect(response?.result).toBeDefined();
    });

    it('should handle definition request for Go variable', async () => {
      const uri = 'file:///variables.go';
      
      const openMessage: LSPMessage = {
        jsonrpc: '2.0',
        method: 'textDocument/didOpen',
        params: {
          textDocument: {
            uri,
            languageId: 'go',
            version: 1,
            text: `package main

import "fmt"

func main() {
	userName := "John Doe"
	userAge := 30
	
	fmt.Println(userName, userAge)
}`,
          },
        },
      };

      await proxy.handleMessage(openMessage);

      // Request definition for 'userName' variable
      const definitionMessage: LSPMessage = {
        jsonrpc: '2.0',
        id: 11,
        method: 'textDocument/definition',
        params: {
          textDocument: { uri },
          position: { line: 8, character: 14 }, // Position on 'userName' in Println
        },
      };

      const response = await proxy.handleMessage(definitionMessage);

      expect(response).toBeDefined();
      expect(response?.id).toBe(11);
      expect(response?.error).toBeUndefined();
      expect(response?.result).toBeDefined();
    });

    it('should handle definition request for Go struct', async () => {
      const uri = 'file:///struct.go';
      
      const openMessage: LSPMessage = {
        jsonrpc: '2.0',
        method: 'textDocument/didOpen',
        params: {
          textDocument: {
            uri,
            languageId: 'go',
            version: 1,
            text: `package main

import "fmt"

type User struct {
	Name string
	Age  int
}

func main() {
	user := User{Name: "Alice", Age: 30}
	fmt.Println(user.Name)
}`,
          },
        },
      };

      await proxy.handleMessage(openMessage);

      // Request definition for 'User' struct
      const definitionMessage: LSPMessage = {
        jsonrpc: '2.0',
        id: 12,
        method: 'textDocument/definition',
        params: {
          textDocument: { uri },
          position: { line: 10, character: 11 }, // Position on 'User' in struct initialization
        },
      };

      const response = await proxy.handleMessage(definitionMessage);

      expect(response).toBeDefined();
      expect(response?.id).toBe(12);
      expect(response?.error).toBeUndefined();
      expect(response?.result).toBeDefined();
    });

    it('should handle definition request for Go method', async () => {
      const uri = 'file:///method.go';
      
      const openMessage: LSPMessage = {
        jsonrpc: '2.0',
        method: 'textDocument/didOpen',
        params: {
          textDocument: {
            uri,
            languageId: 'go',
            version: 1,
            text: `package main

import "fmt"

type User struct {
	Name string
}

func (u User) Greet() string {
	return fmt.Sprintf("Hello, %s", u.Name)
}

func main() {
	user := User{Name: "Bob"}
	message := user.Greet()
	fmt.Println(message)
}`,
          },
        },
      };

      await proxy.handleMessage(openMessage);

      // Request definition for 'Greet' method call
      const definitionMessage: LSPMessage = {
        jsonrpc: '2.0',
        id: 13,
        method: 'textDocument/definition',
        params: {
          textDocument: { uri },
          position: { line: 14, character: 20 }, // Position on 'Greet' method call
        },
      };

      const response = await proxy.handleMessage(definitionMessage);

      expect(response).toBeDefined();
      expect(response?.id).toBe(13);
      expect(response?.error).toBeUndefined();
      expect(response?.result).toBeDefined();
    });

    it('should handle definition request for Go interface', async () => {
      const uri = 'file:///interface.go';
      
      const openMessage: LSPMessage = {
        jsonrpc: '2.0',
        method: 'textDocument/didOpen',
        params: {
          textDocument: {
            uri,
            languageId: 'go',
            version: 1,
            text: `package main

import "fmt"

type Greeter interface {
	Greet() string
}

type Person struct {
	Name string
}

func (p Person) Greet() string {
	return "Hello, " + p.Name
}

func main() {
	var g Greeter = Person{Name: "Charlie"}
	fmt.Println(g.Greet())
}`,
          },
        },
      };

      await proxy.handleMessage(openMessage);

      // Request definition for 'Greeter' interface
      const definitionMessage: LSPMessage = {
        jsonrpc: '2.0',
        id: 14,
        method: 'textDocument/definition',
        params: {
          textDocument: { uri },
          position: { line: 17, character: 9 }, // Position on 'Greeter' type
        },
      };

      const response = await proxy.handleMessage(definitionMessage);

      expect(response).toBeDefined();
      expect(response?.id).toBe(14);
      expect(response?.error).toBeUndefined();
      expect(response?.result).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should return error for non-existent file', async () => {
      const uri = 'file:///nonexistent.ts';
      
      const definitionMessage: LSPMessage = {
        jsonrpc: '2.0',
        id: 100,
        method: 'textDocument/definition',
        params: {
          textDocument: { uri },
          position: { line: 0, character: 0 },
        },
      };

      const response = await proxy.handleMessage(definitionMessage);

      expect(response).toBeDefined();
      expect(response?.id).toBe(100);
      expect(response?.error).toBeDefined();
      expect(response?.error?.message).toContain('File not found');
    });

    it('should handle invalid method gracefully', async () => {
      const message: LSPMessage = {
        jsonrpc: '2.0',
        id: 101,
        method: 'textDocument/invalidMethod',
        params: {},
      };

      const response = await proxy.handleMessage(message);

      expect(response).toBeDefined();
      expect(response?.id).toBe(101);
      expect(response?.error).toBeDefined();
      expect(response?.error?.code).toBe(-32601);
    });

    it('should handle missing method field', async () => {
      const message: LSPMessage = {
        jsonrpc: '2.0',
        id: 102,
        params: {},
      };

      const response = await proxy.handleMessage(message);

      expect(response).toBeDefined();
      expect(response?.id).toBe(102);
      expect(response?.error).toBeDefined();
      expect(response?.error?.code).toBe(-32600);
    });
  });
});
