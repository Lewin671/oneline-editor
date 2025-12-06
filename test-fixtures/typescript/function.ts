// Test fixture for TypeScript function symbol navigation
// Usage: Place cursor on 'greet' in line 9 and press F12
// Expected: Cursor jumps to line 5 (function definition)

function greet(name: string): string {
  return 'Hello, ' + name;
}

const message = greet('World');
console.log(message);
