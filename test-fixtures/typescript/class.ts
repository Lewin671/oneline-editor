// Test fixture for TypeScript class symbol navigation
// Usage: Place cursor on 'User' in line 13 and press F12
// Expected: Cursor jumps to line 5 (class definition)

class User {
  constructor(public name: string, public age: number) {}
  
  greet(): string {
    return `Hello, ${this.name}`;
  }
}

const user = new User('Alice', 30);
console.log(user.greet());
