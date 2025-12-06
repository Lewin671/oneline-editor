// Test fixture for Go struct symbol navigation
// Usage: Place cursor on 'User' in line 15 and press F12
// Expected: Cursor jumps to line 9 (struct definition)

package main

import "fmt"

type User struct {
	Name string
	Age  int
}

func main() {
	user := User{Name: "Alice", Age: 30}
	fmt.Println(user.Name, user.Age)
}
