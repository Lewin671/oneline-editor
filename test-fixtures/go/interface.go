// Test fixture for Go interface symbol navigation
// Usage: Place cursor on 'Greeter' in line 22 and press F12
// Expected: Cursor jumps to line 9 (interface definition)

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
