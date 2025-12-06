# Test Fixtures for Symbol Navigation

This directory contains test files for verifying symbol navigation (go-to-definition) functionality.

## Structure

```
test-fixtures/
├── typescript/          # TypeScript test files
│   ├── function.ts     # Function definition navigation
│   ├── class.ts        # Class definition navigation
│   ├── interface.ts    # Interface definition navigation
│   ├── utils.ts        # Export definitions
│   ├── main.ts         # Import navigation
│   └── tsconfig.json   # TypeScript configuration
└── go/                  # Go test files
    ├── function.go     # Function definition navigation
    ├── struct.go       # Struct definition navigation
    ├── method.go       # Method definition navigation
    ├── interface.go    # Interface definition navigation
    └── go.mod          # Go module file
```

## How to Use

1. **Set up the workspace:**
   ```bash
   # Copy test fixtures to your workspace
   cp -r test-fixtures/* /path/to/your/workspace/
   
   # Or update .env to point to test-fixtures
   echo "WORKSPACE_ROOT=$(pwd)/test-fixtures" > .env
   ```

2. **Start the application:**
   ```bash
   npm run dev
   ```

3. **Open http://localhost:5173 in your browser**

4. **Test symbol navigation:**
   - Each test file has comments indicating where to place the cursor
   - Press F12 or Ctrl/Cmd+Click on a symbol
   - Verify the cursor jumps to the correct definition

## TypeScript Test Cases

### function.ts
- **Test**: Function definition navigation
- **Action**: Place cursor on `greet` in line 5, press F12
- **Expected**: Cursor jumps to line 1 (function definition)

### class.ts
- **Test**: Class definition navigation
- **Action**: Place cursor on `User` in line 11, press F12
- **Expected**: Cursor jumps to line 4 (class definition)

### interface.ts
- **Test**: Interface definition navigation
- **Action**: Place cursor on `Person` in line 10, press F12
- **Expected**: Cursor jumps to line 4 (interface definition)

### main.ts + utils.ts
- **Test**: Cross-file import navigation
- **Action**: Place cursor on `add` in main.ts line 4, press F12
- **Expected**: Editor opens utils.ts with cursor at `add` function

## Go Test Cases

### function.go
- **Test**: Function definition navigation
- **Action**: Place cursor on `greet` in line 10, press F12
- **Expected**: Cursor jumps to line 5 (function definition)

### struct.go
- **Test**: Struct definition navigation
- **Action**: Place cursor on `User` in line 12, press F12
- **Expected**: Cursor jumps to line 5 (struct definition)

### method.go
- **Test**: Method definition navigation
- **Action**: Place cursor on `Greet` in line 16, press F12
- **Expected**: Cursor jumps to line 9 (method definition)

### interface.go
- **Test**: Interface definition navigation
- **Action**: Place cursor on `Greeter` in line 21, press F12
- **Expected**: Cursor jumps to line 5 (interface definition)

## Prerequisites

Make sure you have the language servers installed:

```bash
# TypeScript language server
npm install -g typescript-language-server typescript

# Go language server
go install golang.org/x/tools/gopls@latest
```

## Troubleshooting

If symbol navigation is not working:

1. **Check the status bar** - Make sure it shows "Connected"
2. **Check browser console** - Look for any LSP errors
3. **Verify language servers are installed**:
   ```bash
   which typescript-language-server
   which gopls
   ```
4. **Check server logs** - Look for language server startup messages

## Automated Testing

These fixtures are also used by the automated test suite:

```bash
# Run symbol navigation unit tests
cd server && npm test -- symbol-navigation.test.ts
```

See [SYMBOL_NAVIGATION.md](../SYMBOL_NAVIGATION.md) for more details.
