// Test fixture for TypeScript interface symbol navigation
// Usage: Place cursor on 'Person' in line 10 and press F12
// Expected: Cursor jumps to line 4 (interface definition)

interface Person {
  name: string;
  age: number;
}

const person: Person = {
  name: 'Bob',
  age: 25
};

console.log(person.name);
