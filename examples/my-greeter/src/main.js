import { define, attr, string, number, reactive } from "@sirpepe/ornament";

// Register the element with the specified tag name
@define("my-greeter")
class MyGreeter extends HTMLElement {
  #shadow = this.attachShadow({ mode: "open" });

  // Define content attributes alongside corresponding getter/setter pairs
  // for a JS api and attribute change handling and type checking
  @attr(string()) accessor name = "Anonymous";
  @attr(number({ min: 0 })) accessor age = 0;

  // Mark the method as reactive to have it run every time one of the attributes
  // change
  @reactive() greet() {
    this.#shadow.innerHTML = `Hello! My name is ${this.name}, my age is ${this.age}`;
  }
}
