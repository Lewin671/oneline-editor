// Test fixture for Go function symbol navigation
// Usage: Place cursor on 'greet' in line 14 and press F12
// Expected: Cursor jumps to line 9 (function definition)

package main

import "fmt"

func greet(name string) string {
	return fmt.Sprintf("Hello, %s", name)
}

func main() {
	message := greet("World")
	fmt.Println(message)
}
