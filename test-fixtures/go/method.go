// Test fixture for Go method symbol navigation
// Usage: Place cursor on 'Greet' in line 16 and press F12
// Expected: Cursor jumps to line 9 (method definition)

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
