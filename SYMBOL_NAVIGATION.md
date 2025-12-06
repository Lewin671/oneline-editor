# Symbol Navigation Feature

This document describes the symbol navigation (jump-to-definition) feature in the oneline-editor.

## Overview

The editor supports "Go to Definition" functionality for TypeScript, JavaScript, and Go languages. This allows users to:

- Navigate from a symbol usage to its definition
- Use keyboard shortcuts (F12 or Ctrl/Cmd+Click) to jump to definitions
- Find definitions across files in the same project

## Architecture

The symbol navigation feature is implemented through the Language Server Protocol (LSP):

### Frontend (Client)
- **Location**: `web/lib/lsp/client.ts`
- **Provider**: Monaco Editor's `registerDefinitionProvider`
- **Supported Languages**: TypeScript, JavaScript, Go
- The frontend sends `textDocument/definition` requests to the backend via WebSocket

### Backend (Server)
- **Location**: `server/src/lsp/proxy.ts`
- **Handler**: `handleDefinition` method (lines 323-341)
- The backend forwards definition requests to the appropriate language server:
  - **TypeScript/JavaScript**: `typescript-language-server`
  - **Go**: `gopls`

## How It Works

1. User places cursor on a symbol and presses F12 or Ctrl/Cmd+Click
2. Frontend Monaco provider sends LSP request via WebSocket
3. Backend LSP proxy routes request to appropriate language server
4. Language server analyzes code and returns definition location
5. Frontend receives location and navigates editor to that position

## Test Coverage

### Unit Tests
Location: `server/tests/unit/symbol-navigation.test.ts`

The test suite includes comprehensive coverage for:

#### TypeScript Symbol Navigation
- ✅ Function definitions
- ✅ Variable definitions
- ✅ Class definitions
- ✅ Interface definitions
- ✅ Cross-file imports

#### Go Symbol Navigation
- ✅ Function definitions
- ✅ Variable definitions
- ✅ Struct definitions
- ✅ Method definitions
- ✅ Interface definitions

#### Error Handling
- ✅ Non-existent files
- ✅ Invalid methods
- ✅ Missing method fields

### Running Tests

```bash
# Run all tests
npm test

# Run only symbol navigation tests
cd server && npm test -- symbol-navigation.test.ts
```

## Manual Testing

To manually verify symbol navigation functionality:

### Prerequisites

1. Install language servers:
```bash
# TypeScript language server
npm install -g typescript-language-server typescript

# Go language server
go install golang.org/x/tools/gopls@latest
```

2. Start the application:
```bash
npm run dev
```

### Test Cases

#### TypeScript Symbol Navigation

1. **Function Definition**
   - Create a file `test.ts` with:
     ```typescript
     function greet(name: string): string {
       return 'Hello, ' + name;
     }
     
     const message = greet('World');
     ```
   - Place cursor on `greet` in line 5
   - Press F12
   - Expected: Cursor jumps to line 1 (function definition)

2. **Class Definition**
   - Create a file `class.ts` with:
     ```typescript
     class User {
       constructor(public name: string) {}
       
       greet() {
         return 'Hello, ' + this.name;
       }
     }
     
     const user = new User('Alice');
     ```
   - Place cursor on `User` in line 9
   - Press F12
   - Expected: Cursor jumps to line 1 (class definition)

3. **Interface Definition**
   - Create a file `interface.ts` with:
     ```typescript
     interface Person {
       name: string;
       age: number;
     }
     
     const person: Person = {
       name: 'Bob',
       age: 25
     };
     ```
   - Place cursor on `Person` in line 6
   - Press F12
   - Expected: Cursor jumps to line 1 (interface definition)

4. **Import Definition**
   - Create `utils.ts`:
     ```typescript
     export function add(a: number, b: number): number {
       return a + b;
     }
     ```
   - Create `main.ts`:
     ```typescript
     import { add } from './utils';
     
     const result = add(2, 3);
     ```
   - Place cursor on `add` in line 3 of `main.ts`
   - Press F12
   - Expected: Editor opens `utils.ts` with cursor at line 1

#### Go Symbol Navigation

1. **Function Definition**
   - Create a file `test.go` with:
     ```go
     package main
     
     import "fmt"
     
     func greet(name string) string {
         return fmt.Sprintf("Hello, %s", name)
     }
     
     func main() {
         message := greet("World")
         fmt.Println(message)
     }
     ```
   - Place cursor on `greet` in line 10
   - Press F12
   - Expected: Cursor jumps to line 5 (function definition)

2. **Struct Definition**
   - Create a file `struct.go` with:
     ```go
     package main
     
     import "fmt"
     
     type User struct {
         Name string
         Age  int
     }
     
     func main() {
         user := User{Name: "Alice", Age: 30}
         fmt.Println(user.Name)
     }
     ```
   - Place cursor on `User` in line 11
   - Press F12
   - Expected: Cursor jumps to line 5 (struct definition)

3. **Method Definition**
   - Create a file `method.go` with:
     ```go
     package main
     
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
     }
     ```
   - Place cursor on `Greet` in line 15
   - Press F12
   - Expected: Cursor jumps to line 9 (method definition)

4. **Interface Definition**
   - Create a file `interface.go` with:
     ```go
     package main
     
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
     }
     ```
   - Place cursor on `Greeter` in line 18
   - Press F12
   - Expected: Cursor jumps to line 5 (interface definition)

## Known Limitations

1. Cross-package navigation in Go requires proper `go.mod` setup in the workspace
2. TypeScript navigation requires a `tsconfig.json` for best results
3. The editor must have the file open for navigation to work within the same file
4. Language servers must be installed and accessible in PATH

## Troubleshooting

### Symbol navigation not working

1. **Check language server status**: Look for errors in the browser console
2. **Verify language server installation**:
   ```bash
   which typescript-language-server
   which gopls
   ```
3. **Check WebSocket connection**: Status bar should show "Connected"
4. **Verify file is opened**: The file must be opened in the editor

### Definition not found

1. **For TypeScript/JavaScript**:
   - Ensure `tsconfig.json` exists in workspace
   - Check that all imported files are in the workspace
   
2. **For Go**:
   - Ensure `go.mod` exists in workspace
   - Run `go mod tidy` to update dependencies
   - Check that packages are properly imported

### Console errors

Check the browser console (F12) and server logs for specific error messages. Common issues:

- `File not found`: The referenced file doesn't exist in the workspace
- `Language server not started`: Language server failed to initialize
- `WebSocket disconnected`: Connection to backend lost

## Future Enhancements

Potential improvements for the symbol navigation feature:

- [ ] Add "Find All References" functionality
- [ ] Implement "Peek Definition" (inline preview)
- [ ] Support for more languages (Python, Rust, etc.)
- [ ] Symbol search across entire workspace
- [ ] Call hierarchy navigation
- [ ] Type hierarchy navigation

## References

- [LSP Specification - textDocument/definition](https://microsoft.github.io/language-server-protocol/specifications/specification-current/#textDocument_definition)
- [Monaco Editor API](https://microsoft.github.io/monaco-editor/api/index.html)
- [TypeScript Language Server](https://github.com/typescript-language-server/typescript-language-server)
- [gopls Documentation](https://pkg.go.dev/golang.org/x/tools/gopls)
