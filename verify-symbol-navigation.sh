#!/bin/bash

# Symbol Navigation Verification Script
# This script creates test files and verifies symbol navigation functionality

set -e

echo "=== Symbol Navigation Verification Script ==="
echo ""

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v typescript-language-server &> /dev/null; then
    echo "❌ typescript-language-server not found"
    echo "   Install with: npm install -g typescript-language-server typescript"
    exit 1
else
    echo "✅ typescript-language-server found"
fi

if ! command -v gopls &> /dev/null; then
    echo "❌ gopls not found"
    echo "   Install with: go install golang.org/x/tools/gopls@latest"
    exit 1
else
    echo "✅ gopls found"
fi

echo ""
echo "Creating test workspace..."

# Create a temporary test workspace
WORKSPACE_DIR="/tmp/oneline-editor-test-$(date +%s)"
mkdir -p "$WORKSPACE_DIR"

echo "Test workspace created at: $WORKSPACE_DIR"
echo ""

# Create TypeScript test files
echo "Creating TypeScript test files..."

cat > "$WORKSPACE_DIR/ts-function.ts" << 'EOF'
function greet(name: string): string {
  return 'Hello, ' + name;
}

const message = greet('World');
console.log(message);
EOF

cat > "$WORKSPACE_DIR/ts-class.ts" << 'EOF'
class User {
  constructor(public name: string, public age: number) {}
  
  greet(): string {
    return `Hello, ${this.name}`;
  }
  
  getAge(): number {
    return this.age;
  }
}

const user = new User('Alice', 30);
console.log(user.greet());
EOF

cat > "$WORKSPACE_DIR/ts-interface.ts" << 'EOF'
interface Person {
  name: string;
  age: number;
}

interface Employee extends Person {
  employeeId: string;
}

const employee: Employee = {
  name: 'Bob',
  age: 25,
  employeeId: 'EMP001'
};
EOF

cat > "$WORKSPACE_DIR/ts-utils.ts" << 'EOF'
export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}

export class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }
}
EOF

cat > "$WORKSPACE_DIR/ts-main.ts" << 'EOF'
import { add, multiply, Calculator } from './ts-utils';

const sum = add(2, 3);
const product = multiply(4, 5);
const calc = new Calculator();
const result = calc.add(10, 20);

console.log(sum, product, result);
EOF

cat > "$WORKSPACE_DIR/tsconfig.json" << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["*.ts"]
}
EOF

echo "✅ TypeScript test files created"
echo ""

# Create Go test files
echo "Creating Go test files..."

cat > "$WORKSPACE_DIR/go-function.go" << 'EOF'
package main

import "fmt"

func greet(name string) string {
	return fmt.Sprintf("Hello, %s", name)
}

func main() {
	message := greet("World")
	fmt.Println(message)
}
EOF

cat > "$WORKSPACE_DIR/go-struct.go" << 'EOF'
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
EOF

cat > "$WORKSPACE_DIR/go-method.go" << 'EOF'
package main

import "fmt"

type User struct {
	Name string
}

func (u User) Greet() string {
	return fmt.Sprintf("Hello, %s", u.Name)
}

func (u *User) SetName(name string) {
	u.Name = name
}

func main() {
	user := User{Name: "Bob"}
	message := user.Greet()
	fmt.Println(message)
	
	user.SetName("Charlie")
	fmt.Println(user.Greet())
}
EOF

cat > "$WORKSPACE_DIR/go-interface.go" << 'EOF'
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

type Robot struct {
	ID string
}

func (r Robot) Greet() string {
	return "Beep boop, I am " + r.ID
}

func main() {
	var g Greeter
	
	g = Person{Name: "Charlie"}
	fmt.Println(g.Greet())
	
	g = Robot{ID: "R2D2"}
	fmt.Println(g.Greet())
}
EOF

cat > "$WORKSPACE_DIR/go.mod" << 'EOF'
module test

go 1.21
EOF

echo "✅ Go test files created"
echo ""

# Print summary
echo "=== Test Files Created ==="
echo ""
echo "TypeScript Files:"
echo "  - ts-function.ts     (function definition test)"
echo "  - ts-class.ts        (class definition test)"
echo "  - ts-interface.ts    (interface definition test)"
echo "  - ts-utils.ts        (export test)"
echo "  - ts-main.ts         (import test)"
echo "  - tsconfig.json      (TypeScript configuration)"
echo ""
echo "Go Files:"
echo "  - go-function.go     (function definition test)"
echo "  - go-struct.go       (struct definition test)"
echo "  - go-method.go       (method definition test)"
echo "  - go-interface.go    (interface definition test)"
echo "  - go.mod             (Go module file)"
echo ""

# Update .env file to point to test workspace
ENV_FILE=".env"
if [ -f "$ENV_FILE" ]; then
    echo "Updating $ENV_FILE with test workspace..."
    sed -i.bak "s|WORKSPACE_ROOT=.*|WORKSPACE_ROOT=$WORKSPACE_DIR|" "$ENV_FILE"
    echo "✅ Updated $ENV_FILE"
else
    echo "Creating $ENV_FILE with test workspace..."
    cat > "$ENV_FILE" << EOF
# Server Configuration
PORT=3000
WS_PORT=3000

# Language Server Paths
GOPLS_PATH=gopls
TS_SERVER_PATH=typescript-language-server

# Workspace Configuration
WORKSPACE_ROOT=$WORKSPACE_DIR

# Logging
LOG_LEVEL=info
EOF
    echo "✅ Created $ENV_FILE"
fi

echo ""
echo "=== Next Steps ==="
echo ""
echo "1. Start the application:"
echo "   npm run dev"
echo ""
echo "2. Open http://localhost:5173 in your browser"
echo ""
echo "3. Test symbol navigation:"
echo "   - Open any test file from the file tree"
echo "   - Place cursor on a symbol (function, class, variable, etc.)"
echo "   - Press F12 or Ctrl/Cmd+Click to jump to definition"
echo ""
echo "4. Verify the following behaviors:"
echo ""
echo "   TypeScript:"
echo "   - In ts-function.ts, jump from 'greet' usage to definition"
echo "   - In ts-class.ts, jump from 'User' to class definition"
echo "   - In ts-main.ts, jump from 'add' to ts-utils.ts definition"
echo ""
echo "   Go:"
echo "   - In go-function.go, jump from 'greet' usage to definition"
echo "   - In go-struct.go, jump from 'User' to struct definition"
echo "   - In go-method.go, jump from 'Greet' to method definition"
echo ""
echo "Test workspace: $WORKSPACE_DIR"
echo ""
echo "To clean up test workspace after testing:"
echo "  rm -rf $WORKSPACE_DIR"
echo ""
