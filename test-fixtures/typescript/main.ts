// Test fixture for TypeScript import symbol navigation
// Usage: Place cursor on 'add' in line 4 and press F12
// Expected: Editor opens utils.ts with cursor at 'add' function definition

import { add, multiply, Calculator } from './utils';

const sum = add(2, 3);
const product = multiply(4, 5);
const calc = new Calculator();
const result = calc.add(10, 20);

console.log(`Sum: ${sum}, Product: ${product}, Result: ${result}`);
