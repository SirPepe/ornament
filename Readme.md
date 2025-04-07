<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/logo_dark.png">
    <img alt="Ornament" src="./assets/logo.png">
  </picture>
</h1>

📢 **What's new in 3.0.1?** [Check out the Changelog!](./changelog.md)

**Build your own frontend framework** with Ornament, a stable, mid-level,
pareto-optimal, treeshakable and tiny TypeScript-positive toolkit for web
component infrastructure! Escape from heavyweight frameworks, constant rewrites
and the all-encompassing frontend FOMO with a declarative, simple, and type-safe
API for web components:

```javascript
import {
  define,
  attr,
  string,
  number,
  connected,
  reactive,
} from "@sirpepe/ornament";

// Register the element with the specified tag name
@define("my-greeter")
class MyGreeter extends HTMLElement {
  // No built-in rendering functionality. Shadow DOM or light DOM? Template
  // strings, JSX, or something else entirely? You decide!
  #shadow = this.attachShadow({ mode: "open" });

  // Define content attributes alongside corresponding getter/setter pairs
  // for a JS api and attribute change handling and type checking. If you use
  // TypeScript, the type checks will work at compile time *and* at run time
  @attr(string()) accessor name = "Anonymous";
  @attr(number({ min: 0 })) accessor age = 0;

  // Mark the method as reactive to have it run every time one of the attributes
  // change, and also run it when the component first connects to the DOM.
  @reactive()
  @connected()
  greet() {
    this.#shadow.innerHTML = `Hello! My name is ${this.name}, my age is ${this.age}`;
  }
}
```

Ornament makes quasi-vanilla web components fun and easy when compared to the
equivalent boilerplate monstrosity that one would have to write by hand
otherwise:

<details>
<summary>😱 Unveil the horror 😱</summary>

```javascript
class MyGreeter extends HTMLElement {
  #shadow = this.attachShadow({ mode: "open" });

  // Internal "name" and "age" states, initialized from the element's content
  // attributes, with default values in case the content attributes are not set.
  // The value for "age" has to be figured out with some imperative code in the
  // constructor to keep NaN off our backs.
  #name = this.getAttribute("name") || "Anonymous";
  #age;

  constructor() {
    super(); // mandatory boilerplate
    let age = Number(this.getAttribute("age"));
    if (Number.isNaN(age)) {
      // Remember to keep NaN in check
      age = 0;
    }
    this.#age = 0;
  }

  // Remember to run the reactive method when connecting to the DOM
  connectedCallback() {
    this.greet();
  }

  // Method to run each time `#name` or `#age` changes
  greet() {
    this.#shadow.innerHTML = `Hello! My name is ${this.#name}, my age is ${this.#age}`;
  }

  // DOM getter for the IDL attribute, required to make JS operations like
  // `console.log(el.name)` work
  get name() {
    return this.#name;
  }

  // DOM setter for the IDL attribute with type checking and/or conversion *and*
  // attribute updates, required to make JS operations like `el.name = "Alice"`
  // work.
  set name(value) {
    value = String(value); // Remember to convert/check the type!
    this.#name = value;
    this.setAttribute("name", value); // Remember to sync the content attribute!
    this.greet(); // Remember to run the method!
  }

  // DOM getter for the IDL attribute, required to make JS operations like
  // `console.log(el.age)` work
  get age() {
    return this.#age;
  }

  // DOM setter for the IDL attribute with type checking and/or conversion *and*
  // attribute updates, required to make JS operations like `el.age = 42` work.
  set age(value) {
    value = Number(value); // Remember to convert/check the type!
    if (Number.isNaN(value) || value < 0) {
      // Remember to keep NaN in check
      value = 0;
    }
    this.#age = value;
    this.setAttribute("age", value); // Remember to sync the content attribute!
    this.greet(); // Remember to run the method!
  }

  // Attribute change handling, required to make JS operations like
  // `el.setAttribute("name", "Bob")` update the internal element state.
  attributeChangedCallback(name, oldValue, newValue) {
    // Because `#name` is a string, and attribute values are always strings as
    // well we don't need to convert the types at this stage, but we still need
    // to manually make sure that we fall back to "Anonymous" if the new value
    // is null (if the attribute got removed) or if the value is (essentially)
    // an empty string
    if (name === "name") {
      if (newValue === null || newValue.trim() === "") {
        newValue = "Anonymous";
      }
      this.#name = newValue;
      this.greet(); // Remember to run the method!
    }
    // But for "#age" we do again need to convert types, check for NaN, enforce
    // the min value of 0...
    if (name === "age") {
      const value = Number(value); // Remember to convert/check the type!
      if (Number.isNaN(value) || value < 0) {
        // Remember to keep NaN in check
        value = 0;
      }
      this.#age = value;
      this.greet(); // Remember to run the method!
    }
  }

  // Required for attribute change monitoring to work
  static get observedAttributes() {
    return ["name", "age"]; // remember to always keep this up to date
  }
}

// Finally remember to register the element
window.customElements.define("my-greeter", MyGreeter);
```

</details>

Ornament makes _only the most tedious bits_ of building vanilla web components
(attribute handling and lifecycle reactions) easy by adding some primitives that
really should be part of the standard, but aren't. **Ornament is not a framework,**
but something that you want to build your own framework on top of. Combine
Ornament's baseline web component features with something like
[uhtml](https://github.com/WebReflection/uhtml) or [Preact](https://preactjs.com/)
for rending, add your favorite state management library, write some glue code
and enjoy your very own frontend web framework.

## Guide

### Installation

Install [@sirpepe/ornament](https://www.npmjs.com/package/@sirpepe/ornament)
with your favorite package manager. To get the decorator syntax working in 2025,
you will probably need [@babel/plugin-proposal-decorators](https://babeljs.io/docs/babel-plugin-proposal-decorators)
(with option `version` set to `"2023-11"`) or
[TypeScript 5.0+](https://devblogs.microsoft.com/typescript/announcing-typescript-5-0/#decorators)
(with the option `experimentalDecorators` turned _off_).

Apart from that, Ornament is just a bunch of functions. No further setup
required.

### General philosophy

The native APIs for web components are verbose and imperative, but lend
themselves to quite a bit of streamlining with
[the upcoming syntax for ECMAScript Decorators](https://2ality.com/2022/10/javascript-decorators.html).
The native APIs are also missing a few important primitives. Ornament's goal is
to provide the missing primitives and to streamline the developer experience.
Ornament is **not a framework** but instead aims to be:

- **as stable as possible** by remaining dependency-free, keeping its own code to an absolute minimum, and relying on iron-clad web standards where possible
- **fast and lean** by being nothing more than just a bag of relatively small and simple functions
- supportive of **gradual** adoption and removal by being able to co-exist with vanilla web component code
- **malleable** by being easy to extend, easy to customize, and easy to get rid of
- **universal** by adhering to (the spirit of) web standards, thereby staying compatible with vanilla web component code as well as all sorts of web frameworks
- equipped with **useful type definitions** (and work within the constraints of TypeScript)

Ornament is _infrastructure for web components_ and not a framework itself. It
makes dealing with the native APIs bearable and leaves building something
actually sophisticated up to you. Ornament does not come with _any_ of the
following:

- state management (even though it is simple to connect components to signals or event targets)
- rendering (but it works well with [uhtml](https://github.com/WebReflection/uhtml), [Preact](https://preactjs.com/) and similar libraries)
- built-in solutions for client-side routing, data fetching, or anything beyond the components themselves
- any preconceived notions about what should be going on server-side
- specialized syntax for every (or any specific) use case

You can (and probably have to) therefore pick or write your own solutions for
the above features. Check out the `examples` folder for inspiration! The
examples can be built using `npm run build-examples`.

### Exit strategy

Every good library should come with an exit strategy as well as install
instructions. Here is how you can get rid of Ornament if you want to migrate
away:

- Components built with Ornament will generally turn out to be very close to
  vanilla web components, so **they will most probably just keep working** when
  used with other frameworks/libraries. You can theoretically just keep your
  components and replace them only when the need for change arises. A
  compatibility wrapper for frameworks that are not quite friendly to web
  components (eg. React) may be required.
- If you want to replace Ornament with hand-written logic for web components,
  you can **replace all attribute and update handling piecemeal.** Ornament's
  decorators co-exist with native `attributeChangedCallback()` and friends just
  fine. Ornament _extends_ what you can do with custom elements, it does not
  abstract anything away.
- Much of your migration will depend on **how you build on top of Ornament.**
  You should keep reusable components and app-specific state containers
  separate, just as you would do in e.g. React. This will make maintenance and
  eventual migration much easier, but this is really outside of Ornament's area
  of responsibility.

In general, migrating away should not be too problematic. The components that
you will build with Ornament will naturally tend to be self-contained and
universal, and will therefore more or less always keep chugging along.

## Decorators

### API overview

| Decorator             | Class element               | `static` | `#private` | Symbols | Summary                                                                                                                           |
| --------------------- | --------------------------- | -------- | ---------- | ------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `@define()`           | Class                       | -        | -          | -       | Register a custom element class with a tag name and set it up for use with Ornament's other decorators                            |
| `@enhance()`          | Class                       | -        | -          | -       | Set up a custom element class for use with Ornament's other decorators, but do _not_ register it with a tag name                  |
| `@prop()`             | Accessor                    | ✕        | ✓          | ✓       | Define an accessor to work as an IDL attribute with a given data type                                                             |
| `@attr()`             | Accessor                    | ✕        | ✓[^1]      | ✓[^1]   | Define an accessor to work as a content attribute and associated IDL attribute with a given data type                             |
| `@state()`            | Accessor                    | ✕        | ✓          | ✓[^2]   | Track the accessor's value in the element's [CustomStateSet](https://developer.mozilla.org/en-US/docs/Web/API/CustomStateSet)     |
| `@reactive()`         | Method, Field[^3]           | ✕        | ✓          | ✓       | Run a method or class field function when accessors decorated with `@prop()` or `@attr()` change value (with optional conditions) |
| `@init()`             | Method, Field[^3]           | ✕        | ✓          | ✓       | Run a method or class field function after the class constructor finishes                                                         |
| `@connected()`        | Method, Field[^3]           | ✕        | ✓          | ✓       | Run a method or class field function when the element connects to the DOM                                                         |
| `@disconnected()`     | Method, Field[^3]           | ✕        | ✓          | ✓       | Run a method or class field function when the element disconnects from the DOM                                                    |
| `@adopted()`          | Method, Field[^3]           | ✕        | ✓          | ✓       | Run a method or class field function when the element is adopted by a new document                                                |
| `@formAssociated()`   | Method, Field[^3]           | ✕        | ✓          | ✓       | Run a method or class field function when the element is associated with a form element                                           |
| `@formReset()`        | Method, Field[^3]           | ✕        | ✓          | ✓       | Run a method or class field function when the element's form owner resets                                                         |
| `@formDisabled()`     | Method, Field[^3]           | ✕        | ✓          | ✓       | Run a method or class field function when the element's ancestor fieldset is disabled                                             |
| `@formStateRestore()` | Method, Field[^3]           | ✕        | ✓          | ✓       | Run a method or class field function when the element's `formStateRestoreCallback` fires                                          |
| `@subscribe()`        | Accessor, Method, Field[^3] | ✕        | ✓          | ✓       | Update a reactive accessor or run a method or class field function to react to changes to a signal or to events on an EventTarget |
| `@observe()`          | Method, Field[^3]           | ✕        | ✓          | ✓       | Run a method or class field function as a callback for an IntersectionObserver, MutationObserver, or ResizeObserver               |
| `@debounce()`         | Method, Field[^3]           | ✓        | ✓          | ✓       | Debounce a method or class field function, (including `static`)                                                                   |

[^1]:
    Can be `#private` or a symbol _if_ a non-private non-symbol getter/setter
    pair for the attribute name exists and a content attribute name has been
    set using the `as` option.

[^2]: Can be a symbol _if_ a string value has been provided for the state field

[^3]: Class field values must be of type `function`

### `@define(tagName: string, options: ElementDefinitionOptions = {}, registry: CustomElementRegistry = window.customElements)`

**Class decorator** to register a class as a custom element, basically an
alternative syntax for [`customElements.define()`](https://developer.mozilla.org/en-US/docs/Web/API/CustomElementRegistry/define);

```javascript
import { define } from "@sirpepe/ornament";

@define("my-test")
class MyTest extends HTMLElement {}

console.log(document.createElement("my-test")); // instance of MyTest
```

`@define()` also sets up attribute observation for use with the
`@attr()` decorator, prepares the hooks for
lifecycle decorators like `@connected()` and ensures that property upgrades for
previously undefined elements happen in a predictable fashion. Ornament's
features will only work if the component class is decorated with either
`@define()` or `@enhance()`.

<details>
<summary>What are safe upgrades?</summary>

HTML tags can be used even if the browser does not (yet) know about them, and
this also works with web components - the browser can upgrade custom elements
event after the parser has processed them as unknown elements.
[But this can lead to unexpected behavior](https://codepen.io/SirPepe/pen/poqLege?editors=0010)
when properties are set on elements that have not yet been properly defined,
shadowing relevant accessors on the prototype:

```javascript
const x = document.createElement("hello-world");
// "x" = unknown element = object with "HTMLElement.prototype" as prototype

x.data = 42;
// "x" now has an _own_ property data=42

// Implements an accessor for hello-world. The getters and
// setters end up as properties on the prototype
class HelloWorld extends HTMLElement {
  accessor data = 23;
}

window.customElements.define("hello-world", HelloWorld);
// It is now clear that "x" should have had "HelloWorld.prototype" as its
// prototype all along

window.customElements.upgrade(x);
// "x" now gets "HelloWorld.prototype" as its prototype (with the accessor)

console.log(x.data);
// logs 42, bypassing the getter - "x" itself has an own property "data", the
// accessor on the prototype is shadowed
```

Ornament ensures safe upgrades, always making sure that no prototype accessors
for attributes are ever shadowed by properties defined before an element was
properly upgraded.

</details>

<details>
<summary>Notes for TypeScript</summary>

You should add your custom element's interface to `HTMLElementTagNameMap` to
make it work with native DOM APIs:

```typescript
@define("my-test")
export class MyTest extends HTMLElement {
  foo = 1;
}

declare global {
  interface HTMLElementTagNameMap {
    "my-test": MyTest;
  }
}

let test = document.createElement("my-test");
console.log(test.foo); // only type checks with the above interface declaration
```

</details>

If you want to run your component code in a non-browser environment like JSDOM,
you can pass the JSDOM's CustomElementRegistry as the third argument to
`@define()`.

### `@enhance()`

**Class decorator** to set up attribute observation and lifecycle hooks
_without_ registering the class as a custom element.

```javascript
import { enhance } from "@sirpepe/ornament";

@enhance()
class MyTest extends HTMLElement {}

// MyTest can only be instantiated when it has been registered as a custom
// element. Because we use @enhance() instead of @define() in this example, we
// have to take care of this manually.
window.customElements.define("my-test", MyTest);

console.log(document.createElement("my-test")); // instance of MyTest
```

This decorator is only really useful if you need to handle element registration
in some other way than what `@define()` provides. It is safe to apply
`@enhance()` more than once on a class, or on both (or either) a base class and
subclass:

```javascript
import { enhance } from "@sirpepe/ornament";

// Not useful, but also not a problem
@enhance()
@enhance()
@enhance()
class MyTest0 extends HTMLElement {}

// Works
@enhance()
class Base1 extends HTMLElement {}
class MyTest1 extends Base1 {}

// Works
class Base2 extends HTMLElement {}
@enhance()
class MyTest2 extends Base2 {}

// Works
@enhance()
class Base3 extends HTMLElement {}
@enhance()
class MyTest3 extends Base3 {}
```

Remember that Ornament's features will only work if the component class is
decorated with either `@define()` or `@enhance()`.

### `@prop(transformer: Transformer<any, any>)`

**Accessor decorator** to define an IDL property on the custom element class
_without_ an associated content attribute. Such a property is more or less a
regular accessor with two additional features:

- it uses **transformers** for type checking and validation
- changes cause class members decorated with `@reactive()` to run

Example:

```javascript
import { define, prop, number } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  // Applies the number transformer to ensure that foo is always a number
  @prop(number()) accessor foo = 23;

  // Automatically runs when "foo" (or any accessor decorated with @prop() or
  // @attr()) changes
  @reactive()
  log() {
    console.log(`Foo changed to ${this.foo}`);
  }
}

let testEl = document.createElement("my-test");
console.log(testEl.foo); // logs 23
testEl.foo = 42; // logs "Foo changed to 42"
console.log(testEl.foo); // logs 42
testEl.foo = "asdf"; // throw exception (thanks to the number transformer)
```

Accessors defined with `@prop()` work as a _JavaScript-only API_. Values can
only be accessed through the accessor's getter, invalid values are rejected by
the setter with exceptions. `@prop()` can be used on private accessors or
symbols without problem.

Note that you can still define your own accessors, getters, setters etc. as you
would usually do. They will still work as expected, but they will not cause
`@reactive()` methods to run.

### `@attr(transformer: Transformer<any, any>, options: AttrOptions = {})`

**Accessor decorator** to define an IDL attribute with a matching content
attribute on the custom element class. This results in something very similar to
accessors decorated with `@prop()`, but with the following additional features:

- Its value can be initialized from a content attribute, if the attribute is present
- Changes to the content attribute's value (eg. via `setAttribute()`) update the value of the IDL attribute to match (depending on the options and the transformer)

<details>
<summary>What's the deal with content attributes?</summary>

Getting attribute handling on Web Components right is _hard_, because many
different APIs and states need to interact in just the right way and the related
code tends to end up scattered across various class members. Attributes on HTML
elements have two faces: the _content attribute_ and the _IDL attribute_.
Content attributes are always strings and are defined either via HTML or via DOM
methods like `setAttribute()`. IDL attributes can be accessed via object
properties such as `someElement.foo` and may be of any type. Both faces of
attributes need to be implemented and properly synced up for an element to be
truly compatible with any software out there - a JS frontend framework may work
primarily with IDL attributes, while HTML authors or server-side rendering
software will work with content attributes.

Keeping content and IDL attributes in sync can entail any or all of the
following tasks:

- Updating the content attribute when the IDL attribute gets changed (eg. update the HTML attribute `id` when running `element.id = "foo"` in JS)
- Updating the IDL attribute when the content attribute gets changed (eg. `element.id` should return `"bar"` after `element.setAttribute("id", "bar")`)
- Converting types while updating content and/or IDL attributes (an attribute may be a `number` as an IDL attribute, but content attributes are by definition always strings)
- Rejecting invalid types on the IDL setter (as opposed to converting types from content to IDL attributes which, like all of HTML, never throws an error)
- Connecting IDL and content attributes with different names (like how the content attribute `class` maps to the IDL attribute `className`)
- Fine-tuning the synchronization behavior depending on circumstances (see the interaction between the `value` content and IDL attributes on `<input>`)
- Remembering to execute side effects (like updating Shadow DOM) when any IDL and/or content attribute changes

This is all _very_ annoying to write by hand, but because the above behavior is
more or less the same for all attributes, it is possible to to simplify the
syntax quite a bit:

```javascript
import { attr, define number } from "@sirpepe/ornament";

@define("my-test")
class MyTest extends HTMLElement {
  @attr(number({ min: -100, max: 100 })) accessor value = 0;

  @reactive()
  log() {
    console.log(this.value);
  }
}
```

The line starting with with `@attr` gets you a content and a matching IDL
attribute named `value`, which...

- Always reflects a number between `-100` and `100`
- Initializes from the content attribute and falls back to the initializer value `0` if the attribute is missing or can't be interpreted as a number
- Automatically updates the content attribute with the stringified value of the IDL attribute when the IDL attribute is updated
- Automatically updates the IDL attribute when the content attribute is updated (it parses the attribute value into a number and clamps it to the specified range)
- Implements getters and setters for the IDL attributes, with the getter always returning a number and the setter rejecting invalid values (non-numbers or numbers outside the specified range of `[-100, 100]`)
- Causes the method marked `@reactive()` to run on update

You can use `@prop()` for standalone IDL attribute (that is, DOM properties
without an associated content attributes), swap out the `number()` transformer
for something else, or combine any of the above with hand-written logic.

</details>

```javascript
import { define, attr, number } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  // Applies the number transformer to ensure that content attribute values get
  // parsed into numbers and that new non-number values passed to the IDL
  // attribute's setter get rejected
  @attr(number()) accessor foo = 23; // 23 = fallback value

  // Automatically runs when "foo", or any accessor decorated with @prop() or
  // @attr(), changes (plus once on element initialization)
  @reactive() log() {
    console.log(`Foo changed to ${this.foo}`);
  }
}

document.body.innerHTML = `<my-test foo="42"></my-test>`;
let testEl = document.querySelector("my-test");
console.log(testEl.foo); // logs 42 (initialized from the attribute)
testEl.foo = 1337; // logs "Foo changed to 1337"
console.log(testEl.foo); // logs 1337
console.log(testEl.getAttribute("foo")); // logs "1337"
testEl.foo = "asdf"; // throw exception (thanks to the number transformer)
testEl.setAttribute("foo", "asdf"); // works, content attributes can be any string
console.log(testEl.foo); // logs 23 (fallback value)
```

Accessors defined with `@attr()` work like all other supported attributes on
built-in elements. Content attribute values (which are always strings) get
parsed by the transformer, which also deals with invalid values in a graceful
way (ie without throwing exceptions). Values can also be accessed through the
IDL property's accessor, where invalid values _are_ rejected with exceptions by
the setter.

`@attr()` can only be used on private accessors or symbols only if the following
holds true:

1. The option `as` _must_ be set
2. A non-private, non-symbol getter/setter pair for the attribute name defined in the option `as` _must_ exist on the custom element class

Content attributes always have public IDL attribute APIs, and ornament enforces
this. A private/symbol attribute accessor with a manually-provided public facade
may be useful if you want to attach some additional logic to the public API
(= hand-written getters and setters) while still having the convenience of of
using `@attr` on an `accessor`.

Note that you can still define your own attribute handling with
`attributeChangedCallback()` and `static get observedAttributes()` as you would
usually do. This will keep working work as expected, but changes to such
attributes will not cause `@reactive()` methods to run.

#### Options for `@attr()`

- **`as` (string, optional)**: Sets an attribute name different from the accessor's name, similar to how the `class` content attribute works for the `className` IDL attribute on built-in elements. If `as` is not set, the content attribute's name will be equal to the accessor's name. `as` is required when the decorator is applied to a symbol or private property.
- **`reflective` (boolean, optional)**: If `false`, prevents the content attribute from updating when the IDL attribute is updated, similar to how `value` works on `input` elements. Defaults to true.

### `@state(options: StateOptions = {})`

**Accessor decorator** that tracks the accessor's value in the element's
[CustomStateSet](https://developer.mozilla.org/en-US/docs/Web/API/CustomStateSet).
By default, the state's name is the decorated member's name and `Boolean` is
used to decide whether a state should be added or removed from the set.

```javascript
import { define, state } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  @state()
  accessor foo = 0;
  // Default: tracks the state "foo" by transforming the value with Boolean()

  @state({ name: "isOdd", toBoolean: (value) => value % 2 !== 0 })
  accessor bar = 0;
  // Custom: tracks "bar" as "isOff" by transforming the value with toBoolean()
}

let testEl = document.createElement("my-test");

// Custom state "foo" is not set, since Boolean(0) === false
console.log(testEl.matches(":state(foo)")); // > false

// Custom state "isOdd" is not set, since (value % 2 !== 0) === false
console.log(testEl.matches(":state(isOdd)")); // > false

testEl.foo = 1;
testEl.bar = 1;

// Custom state "foo" is set, since Boolean(1) === true
console.log(testEl.matches(":state(foo)")); // > true

// Custom state "isOdd" is set, since (value % 2 !== 0) === true
console.log(testEl.matches(":state(isOdd)")); // > true
```

The decorator works with private accessors. If no `name` option is provided, the
custom state name includes the `#` sign. Use on symbol accessors requires the
`name` option.

To properly combine with `@prop()` and `@attr()`, `@state()` should be applied
to the accessor last to benefit from the type checking and/or conversion
provided from the other decorators:

```javascript
import { define, state, prop, number } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  @prop(number({ min: 0 })) // <- @prop() comes first
  @state({ toBoolean: (x) => x % 2 === 0 }) // <- @state() comes last
  accessor foo = 0;
}

const testEl = new Test();
// state "foo" is true

testEl.foo = 1;
// state "foo" is false

try {
  testEl.foo = -2; // <- this fails
} catch {
  // state "foo" on el still false; @prop intercepted the set operation
}
```

#### Options for `@state()`

- **`name` (string, optional)**: name of the state in the CustomStateSet. If `name` is not set, the state's name will be equal to the accessor's name. `name` is required when the decorator is applied to a symbol.
- **`toBoolean` (((value, instance) => boolean), optional)**: Function to transform the accessor's value into a boolean, which in turn decides whether a state should be added or removed from the set. Defaults to the `Boolean` function. Called with `this` set to the component instance.

### `@reactive(options: ReactiveOptions = {})`

**Method and class field decorator** that runs class members when accessors
decorated with `@prop()` or `@attr()` change their values:

```javascript
import { define, reactive, prop, number } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  @prop(number()) accessor foo = 0;
  @prop(number()) accessor bar = 0;

  @reactive()
  log() {
    console.log(`foo is now ${this.foo}, bar is now ${this.bar}`);
  }
}

let testEl = document.createElement("my-test");
testEl.foo = 1;
testEl.bar = 2;

// first logs "foo is now 1, bar is now 0"
// then logs "foo is now 1, bar is now 2"
```

Decorated members are called with no arguments. They react to changes to the
instances' internal state and should therefore be able to access all relevant
data through `this`. In many cases you may want to apply `@reactive()` to
methods decorated with `@debounce()` to prevent excessive
calls.

The `predicate` and/or `keys` options can be used to control whether the
decorated method or function reacts to an update. For the decorated member to
run, the following needs to be true:

1. `options.keys` must either have been omitted or must contain the IDL or
   content attribute name that changed
2. `options.excludeKeys` must either have been omitted or must not contain the
   IDL or content attribute name that changed
3. `options.predicate` must either have been omitted or must return true when
   called immediately before the function is scheduled to run

#### Options for `@reactive()`

- **`keys` (Array\<string | symbol\>, optional)**: List of attributes (defined by `@prop()` or `@attr()`) to monitor. Can include private names and symbols. Defaults to monitoring all content and IDL attributes defined by `@prop()` or `@attr()`.
- **`excludeKeys` (Array\<string | symbol\>, optional)**: List of attributes (defined by `@prop()` or `@attr()`) not to monitor. Can include private names and symbols. Defaults to an empty array.
- **`predicate` (Function `(this: T, prop: string | symbol, newValue: any, instance: T) => boolean`)**: If provided, controls whether or not the decorated method is called for a given change. Note that this function is not part of the class declaration itself and can therefore _not_ access private fields on `instance`, but the predicate function gets passed the affected IDL property's name and new value.

### `@init()`

**Method and class field decorator** that runs class members when the class
constructor finishes. This has the same effect as adding method calls to the end
of the constructor's body.

```javascript
import { define, init } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  constructor() {
    super();
    console.log(23);
  }

  @init()
  log() {
    console.log(42);
  }
}

let testEl = document.createElement("my-test");
// first logs 23, then logs 42
```

This decorator is particularly useful if you need to run `@reactive()` methods
once on component initialization.

Decorated members are run with no arguments and _always_ right after the
constructor finishes, even methods and class field functions decorated with
`@debounce()`.

### `@connected()`

**Method and class field decorator** that runs class members when the component
connects to the DOM and the component's `connectedCallback()` fires:

```javascript
import { define, connected } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  @connected() log() {
    console.log("Connected!");
  }
}

let testEl = document.createElement("my-test");
document.body.append(testEl);
// testEl.log logs "Connected!"
```

Decorated members are run with no arguments. You can also still use the regular
`connectedCallback()`.

### `@disconnected()`

**Method and class field decorator** that runs decorated class members when the
component disconnects from the DOM and the component's `disconnectedCallback()`
fires:

```javascript
import { define, adopted } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  @disconnected() log() {
    console.log("Disconnected!");
  }
}

let testEl = document.createElement("my-test");
document.body.append(testEl);
testEl.remove();
// testEl.log logs "Disconnected!"
```

Decorated members are run with no arguments. You can also still use the regular
`disconnectedCallback()`.

### `@adopted()`

**Method and class field decorator** that runs decorated class members when the
component is moved to a new document and the component's `adoptedCallback()`
fires:

```javascript
import { define, adopted } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  @adopted() log() {
    console.log("Adopted!");
  }
}

let testEl = document.createElement("my-test");
const newDocument = new Document();
newDocument.adoptNode(testEl);
// testEl.log logs "Adopted!"
```

Decorated members are run with no arguments. You can also still use the regular
`adoptedCallback()`.

### `@formAssociated()`

**Method and class field decorator** that runs decorated class members when a
form-associated component's form owner changes and its
`formAssociatedCallback()` fires:

```javascript
import { define, formAssociated } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  static formAssociated = true;
  @formAssociated() log(newOwner) {
    console.log(newOwner); // null or HTMLFormElement
  }
}

let testEl = document.createElement("my-test");
let form = document.createElement("form");
form.append(testEl);
// testEl.log logs "form"
```

Decorated members are passed the new form owner (if any) as an argument. You can
also still use the regular `formAssociatedCallback()`.

### `@formReset()`

**Method and class field decorator** that runs decorated class members when a
form-associated component's form owner resets and its `formResetCallback()`
fires:

```javascript
import { define, formReset } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  static formAssociated = true;
  @formReset() log() {
    console.log("Reset!");
  }
}

let testEl = document.createElement("my-test");
let form = document.createElement("form");
form.append(testEl);
form.reset();
// ... some time passes...
// testEl.log logs "Reset!"
```

Decorated members are run with no arguments. You can also still use the regular
`formResetCallback()`.

Note that form reset events are observably asynchronous, unlike all other
lifecycle events. This is due to the form reset algorithm itself being async.

### `@formDisabled()`

**Method and class field decorator** that runs decorated class members when a
form-associated component's fieldset gets disabled and its
`formDisabledCallback()` fires:

```javascript
import { define, formDisabled } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  static formAssociated = true;
  @formDisabled() log(state) {
    console.log("Disabled via fieldset:", state); // true or false
  }
}

let testEl = document.createElement("my-test");
let fieldset = document.createElement("fieldset");
let form = document.createElement("form");
form.append(fieldset);
fieldset.append(testEl);
fieldset.disabled = true;
// testEl.log logs "Disabled via fieldset: true"
```

Decorated members are passed the new form disabled state as an argument. You
can also still use the regular `formDisabledCallback()`.

### `@formStateRestore()`

**Method and class field decorator** that causes runs decorated class methods
when a form-associated component's `formStateRestoreCallback()` fires. This does
not work in Chrome-based browsers as of November 2023.

### `@subscribe(...args)`

**Accessor, method or class field decorator** that subscribes to either
[Event Targets](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget) or
[signals](https://github.com/preactjs/signals), depending on the arguments. If
the decorated class member is a method or a function, it runs when the
EventTarget emits a new event or when the signal receives a new value. If the
decorated member is an accessor, it gets updated with the last event object (for
event targets) or signal values (for signals). You can decorate the accessor
with `@prop()` to cause methods decorated with `@reactive()` to run when its
value changes.

#### Subscribe to EventTargets: `@subscribe(targetOrTargetFactory: EventTarget | ((instance: T) => EventTarget) | Promise<EventTarget>, eventNames: string, options: EventSubscribeOptions = {})`

Subscribe the decorated class member to one or more events an EventTarget.
[EventTarget](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget) is
an interface that objects such as HTMLElement, Window, Document and _many_ more
objects implement. You can also create a vanilla event target or extend the
`EventTarget` class:

```javascript
import { define, subscribe } from "@sirpepe/ornament";

const myTarget = new EventTarget();

@define("my-test")
class Test extends HTMLElement {
  @subscribe(myTarget, "foo")
  log(evt) {
    // evt = Event({ name: "foo", target: myTarget })
    // this = Test instance
    console.log(`'${evt.type}' event fired!`);
  }
}

let testEl = document.createElement("my-test");

myTarget.dispatchEvent(new Event("foo"));

// testEl.log logs "'foo' event fired!"
```

To subscribe to multiple events, pass a single string with the event names
separated by whitespace:

```javascript
import { define, subscribe } from "@sirpepe/ornament";

const myTarget = new EventTarget();

@define("my-test")
class Test extends HTMLElement {
  @subscribe(myTarget, "foo bar") #a() {} // subscribed to both "foo" and "bar"
}
```

You can also provide a target-producing factory or promise in place of the
target itself:

```javascript
import { define, subscribe } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  // "window" is a perfectly valid event target
  @subscribe(window, "update") #a() {} // same effect as below
  @subscribe(() => window, "update") #b() {} // same effect as above
  @subscribe(Promise.resolve(window), "update") #c() {} // same effect as above
}
```

The target-producing factory function can be used to access targets that depend
on the element instance, such as the element's shadow root. The factory function
gets called each time an element initializes, with its first argument set to the
instance.

<details>
<summary>Notes for TypeScript</summary>

An event target can actually be delivered by an _arbitrarily_ long chain of
nested functions and promises. This is annoying to handle on the type level,
you'll just have to `any` your way around that or provide this capability in
a type-safe wrapper.

Making the `@subscribe()` decorator type-safe for use with events is a gnarly
prospect. Given an event target and an event name, the decorator _can't_ know
what type of event the method must expect. Therefore the following is possible
by default:

```typescript
import { define, subscribe } from "@sirpepe/ornament";

let target = document.createElement("div");

@define("my-test")
class Test extends HTMLElement {
  @subscribe(target, "click")
  #handleClicks(evt: MouseEvent) {} // This type checks, as it should

  @subscribe(target, "click")
  #handleAnimations(evt: AnimationEvent) {} // This type checks too!
}
```

A mapping between event names and corresponding event types (such as `"click"`
→ `MouseEvent`) exists for specific cases. For example `HTMLElementEventMap`
contains the mappings for events emitted by HTML elements. But because
`@subscribe()` can work with _any event target_, the existence or relevance of
such a mapping can't be assumed. The only way around this is to create an
abstraction for specific use cases where such a mapping is available. This can
be based on `@subscribe()` itself:

```typescript
// Create a variant of @subscribe() specific to DOM events
const listen = <
  T extends HTMLElement,
  K extends keyof HTMLElementEventMap,
>(
  source: HTMLElement,
  ...eventNames: K[]
) =>
  subscribe<T, HTMLElement, HTMLElementEventMap[K]>(
    source,
    eventNames.join(" "),
  );

const eventSource = document.createElement("div");
class Test extends HTMLElement {
  // Works: "click" is a MouseEvent
  @listen(eventSource, "click")
  handleClick(evt: MouseEvent) {}

  // Works: all event types listed by name are covered in the union
  @listen(eventSource, "transitionstart", "animationstart")
  handleAnimationStart(evt: AnimationEvent | TransitionEvent) {}

  // Type error: "focus" is not a mouse event
  @listen(eventSource, "focus")
  handleFocus(evt: MouseEvent) {}

  // Type error: type "TransitionEvent" is not covered
  @listen(eventSource, "transitionend", "animationend")
  handleAnimationEnd(evt: AnimationEvent) {}

  // Type error: "asdf" is not a DOM event
  @listen(eventSource, "asdf")
  handleAsdf(evt: Event) {}
```

</details>

##### Options for `@subscribe()` for EventTarget

- **`targetOrTargetFactory` (EventTarget | Promise\<EventTarget\> | ((instance: T) => EventTarget) | Promise\<EventTarget\>)**: The event target (or event-target-returning function/promise) to subscribe to
- **`eventNames` (string)**: The event(s) to listen to. To subscribe to multiple events, pass a single string with the event names separated by whitespace
- **`options` (object, optional)**: Event handling options, consisting of...
  - **predicate (function `(this: T, event: Event, instance: T) => boolean`, optional)**: If provided, controls whether or not the decorated method is called for a given event. Gets passed the element instance and the event object, and must return a boolean. Note that this method always handles the raw event object, before and eventual `transform()` is applied.
  - **transform (function `<U>(this: T, event: Event, instance: T) => U`, optional)**: If provided, transforms the event object into something else. The decorated class element must be compatible with the type returned from `transform()`.
  - **activateOn (Array\<string\>, optional):** Ornament event on which to activate the subscription (that is, when to actually start listening on the EventTarget). Defaults to `["init", "connected"]`.
  - **deactivateOn (Array\<string\>, optional):** Ornament event on which to deactivate the subscription (when to call `removeEventListener()` on the EventTarget). Defaults to `["disconnected"]`.
  - **capture (boolean, optional):** [option for `addEventListener()`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#parameters)
  - **once (boolean, optional):** [option for `addEventListener()`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#parameters)
  - **passive (boolean, optional):** [option for `addEventListener()`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#parameters)
  - **signal (AbortSignal, optional):** [option for `addEventListener()`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#parameters)

#### Subscribe to Signals: `@subscribe(signal: SignalLike<any>, options: SignalSubscribeOptions = {})`

Subscribe to a signal:

```javascript
import { define, subscribe } from "@sirpepe/ornament";
import { signal } from "@preact/signals-core";

const counter = signal(0);
@define("my-test")
class Test extends HTMLElement {
  @subscribe(counter)
  test() {
    console.log(counter.value);
  }
}
const instance = new Test();
counter.value = 1;
counter.value = 2;
counter.value = 3;
// logs 0, 1, 2, 3
```

Any signal object that implements the following API should work:

```typescript
type Signal<T> = {
  // Takes an update callback and returns an unsubscribe function
  subscribe(callback: () => void): () => void;
  // Represents the current value
  value: T;
};
```

Because signals permanently represent reactive values, subscribing itself causes
the method to be called with the then-current signal value. This is in contrast
to subscribing to Event Targets, which do not represent values, but just happen
to throw events around.

##### Options for `@subscribe()` for signals

- **`signal` (Signal)**: The signal to subscribe to
- **`options` (object, optional)**: Update handling options, consisting of...
  - **predicate (function `(this: T, value, instance: T) => boolean`, optional)**: If provided, controls whether or not the decorated method is called for a given signal update. Gets passed the element instance and the signal's value, and must return a boolean. Note that this method always handles the raw signal value, before and eventual `transform()` is applied.
  - **transform (function `<U>(this: T, value, instance: T) => U`, optional)**: If provided, transforms the signal value into something else. The decorated class element must be compatible with the type returned from `transform()`.
  - **activateOn (Array\<string\>, optional):** Ornament event on which to activate the subscription (that is, when to actually subscribe to the Signal). Defaults to `["init", "connected"]`.
  - **deactivateOn (Array\<string\>, optional):** Ornament event on which to unsubscribe from the signal. Defaults to `["disconnected"]`.

### `@debounce(options: DebounceOptions = {})`

**Method and class field decorator** for debouncing method/function invocation:

```javascript
import { define, debounce } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  // Debounce a class method
  @debounce()
  test1(x) {
    console.log(x);
  }
  // Debounce a class field function
  @debounce() test2 = (x) => console.log(x);
}

const el = new Test();

el.test1(1);
el.test1(2);
el.test1(3);
// only logs "3"

el.test2("a");
el.test2("b");
el.test2("c");
// only logs "c"
```

`@debounce()` works with class methods, static methods, and class field
functions.

<details>
<summary>Notes for TypeScript</summary>

Debouncing a method or class field function makes it impossible for the method
or function to return anything but `undefined`. TypeScript does currently not
allow decorators to modify its target's type, so `@debounce()` can't do that. If
you apply `@debounce()` to a method `(x: number) => number`, TypeScript will
keep using this signature, even though the decorated method will no longer be
able to return anything but `undefined`.

</details>

#### Options for `@debounce()`

- **`fn` (function, optional)**: The debounce function to use. Defaults to `debounce.raf()`. The following debounce functions are available:
  - `debounce.raf()`: uses `requestAnimationFrame()`
  - `debounce.timeout(ms: number)`: uses `setTimeout()`
  - `debounce.asap()`: runs the function after the next microtask

### `@observe(ctor: ObserverConstructor, options: ObserverOptions = {})`

**Method and class field decorator** that sets up a [MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver), [ResizeObserver](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver), or [IntersectionObserver](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API) with the element instance as the target and the decorated method as the callback. This enables the component to observe itself:

```javascript
import { define, observe } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  // Pass the observer constructor and relevant options
  @observe(MutationObserver, { childList: true })
  reactToChanges(mutations, observer) {
    // "mutations" = array of MutationRecord objects
    // "observer" = the observer instance
    console.log(mutations);
  }
}

const el = new Test();
el.innerText = "Test"; // cause mutation

// Test.reactToChanges() gets called asynchronously by the observer
```

`@observe()` always observes the element that the decorated method belongs to and its reactions are always observably (heh) asynchronous. The decorator does little more than create an observer object with the options provided and the decorated method as the callback function. In theory this should work with every kind of DOM-related observer, but has only been tested with MutationObserver, ResizeObserver and IntersectionObserver so far.

#### Options for `@observe()`

- **`Ctor` (function)**: The observer constructor function (probably one of `MutationObserver`, `ResizeObserver`, and `IntersectionObserver`)
- **`options` (object, optional)**: A mixin type consisting of
  - All options for the relevant observer type (see MDN for options for [MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/observe#options), [ResizeObserver](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver/IntersectionObserver#options), [IntersectionObserver](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver/observe#options))
  - **`predicate` (function `(instance: T, records, observer) => boolean`)**: If provided, controls whether or not an observer callback invocation calls the decorated method. Gets passed the observer's callback arguments (an array of records and the observer object) as well as the element instance and must return a boolean.
  - **activateOn (Array\<string\>, optional):** Ornament event on which to start observing the element. Defaults to `["init", "connected"]`.
  - **deactivateOn (Array\<string\>, optional):** Ornament event on which to stop observing the element. Defaults to `["disconnected"]`.

## Transformers

Transformers define how the accessor decorators `@attr()` and `@prop()`
implement attribute handling and type transformations. This includes converting
content attributes from and to IDL attributes, type checks on IDL setters, and
running side effects.

### Transformers overview

| Transformer | Type                                           | Options                              |
| ----------- | ---------------------------------------------- | ------------------------------------ |
| `string()`  | `string`                                       |                                      |
| `href()`    | `string` (URL)                                 | `location`                           |
| `bool()`    | `boolean`                                      |                                      |
| `number()`  | `number`                                       | `min`, `max`, `allowNaN`, `nullable` |
| `int()`     | `bigint`                                       | `min`, `max`, `nullable`             |
| `json()`    | Any (JSON serializable for use with `@attr()`) | `reviver`, `replacer`                |
| `list()`    | Array                                          | `separator`, `transform`             |
| `literal()` | Any                                            | `values`, `transform`                |
| `any()`     | `any`                                          |                                      |
| `event()`   | `function \| null`                             |                                      |

A transformer is just a bag of functions with the following type signature:

```typescript
export type Transformer<
  T extends HTMLElement,
  Value,
  IntermediateValue = Value,
> = {
  // Validates and/or transforms a value before it is used to initialize the
  // accessor. Can also be used to run a side effect when the accessor
  // initializes. Defaults to the identity function.
  init: (
    this: T,
    value: Value,
    context: ClassAccessorDecoratorContext<T, Value>,
    isContentAttribute: boolean,
  ) => Value;
  // Turns content attribute values into IDL attribute values. Must never throw
  // exceptions, and instead always just deal with its input. Must not cause any
  // observable side effects. May return NO_VALUE in case the content attribute
  // can't be parsed, in which case the @attr() decorator must not change the
  // IDL attribute value
  parse: (this: T, value: string | null) => Value | typeof NO_VALUE;
  // Decides if setter inputs, which may be of absolutely any type, should be
  // accepted or rejected. Should throw for invalid values, just like setters on
  // built-in elements may. Must not cause any observable side effects.
  validate: (
    this: T,
    value: unknown,
    isContentAttribute: boolean,
  ) => asserts value is IntermediateValue;
  // Transforms values that were accepted by validate() into the proper type by
  // eg. clamping numbers, normalizing strings etc.
  transform: (this: T, value: IntermediateValue) => Value;
  // Turns IDL attribute values into content attribute values (strings), thereby
  // controlling the attribute representation of an accessor together with
  // updateContentAttr(). Must never throw, defaults to the String() function
  stringify: (this: T, value: Value) => string;
  // Determines whether a new attribute value is equal to the old value. If this
  // method returns true, reactive callbacks will not be triggered. Defaults to
  // simple strict equality (===).
  eql: (this: T, a: Value, b: Value) => boolean;
  // Optionally run a side effect immediately before the accessor's setter is
  // invoked. Required by the event transformer.
  beforeSet: (
    this: T,
    value: Value,
    context: ClassAccessorDecoratorContext<T, Value>,
    attributeRemoved: boolean,
  ) => void;
  // Optionally transform the getter's response. Required by the href
  // transformer.
  transformGet: (this: T, value: Value) => Value;
  // Decides if, based on a new value, an attribute gets updated to match the
  // new value (true/false) or removed (null). Only gets called when the
  // transformer's eql() method returns false. Defaults to a function that
  // always returns true.
  updateContentAttr: (
    oldValue: Value | null,
    newValue: Value | null,
  ) => boolean | null;
};
```

Because transformers need to potentially do a lot of type juggling and
bookkeeping, they are somewhat tricky to get right, but they are also always
only a few self-contained lines of code. If you want to extend Ornament, you
should simply clone one of the built-in transformers and modify it to your
liking.

### Notes for all transformers

#### For use with both `@prop()` and `@attr()`

In principle all transformers can be used with both `@prop()` and `@attr()`.
Very few transformers are limited to use with either decorator, such as
`event()` (which makes very little sense outside of content attributes).

The accessor's initial value serves as fallback value in case no other data is
available (eg. when a content attribute gets removed). Transformers validate
their initial value and most transformers contain reasonable default values
(`""` for `string()`, `0` for `number()` etc.).

#### For use with `@attr()`

A content attribute's IDL attribute value can be unset to the accessor's initial
value by removing a previously set content attribute:

As an example:

```javascript
import { define, attr, string } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  @attr(string()) accessor foo = "default value";
  @attr(string()) accessor bar = "default value";
  @attr(string()) accessor baz;
}

document.body.innerHTML += `<my-test foo="other value"></my-test>`;
```

The attributes `foo`, `bar` and `baz` behave as follows:

- The element initializes with a content attribute **`foo`** already set in HTML. The IDL attribute `foo` will therefore (because it uses the string type via the `string()` transformer) contain `"other value"`. Should the content attribute `foo` get removed, the IDL attribute will contain `"default value"`.
- The content attribute **`bar`** is not set in HTML, which will result in the IDL attribute `bar` containing the accessor's default value `"default value"`.
- The content attribute **`baz`** is also not set in HTML _and_ the accessor has no initial value, so the `string()` transformer's built-in fallback value `""` gets used.

### Transformer `string()`

Implements a string attribute or property. Modeled after built-in string
attributes such as `id` and `lang`, it will always represent a string and
stringify any and all non-string values.

```javascript
import { define, attr, string } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  @attr(string()) accessor foo = "default value";
}
```

#### Behavior overview for transformer `string()`

| Operation                | IDL attribute value     | Content attribute (when used with `@attr()`) |
| ------------------------ | ----------------------- | -------------------------------------------- |
| Set IDL attribute to `x` | `String(x)`             | IDL attribute value                          |
| Set content attribute    | Content attribute value | As set (equal to IDL attribute value)        |
| Remove content attribute | Initial value or `""`   | Removed                                      |

### Transformer `href({ location = window.location }: { location?: Location } = {})`

Implements a string attribute or property that works exactly like the `href`
attribute on `<a>` in that it automatically turns relative URLs into absolute
URLs.

```javascript
import { define, attr, href } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  @attr(href()) accessor foo = "";
}

let testEl = new Test();

// Assuming that the page is served from localhost:
console.log(testEl.foo); // > ""
testEl.foo = "asdf";
console.log(testEl.foo); // > "http://localhost/asdf"
testEl.foo = "https://example.com/foo/bar/";
console.log(testEl.foo); // > "https://example.com/foo/bar/"
```

If you want to run your component code in a non-browser environment like JSDOM,
you can pass the JSDOM's `window.location` as the option `location`.

#### Behavior overview for transformer `href()`

| Operation                                      | IDL attribute value         | Content attribute (when used with `@attr()`) |
| ---------------------------------------------- | --------------------------- | -------------------------------------------- |
| Set IDL attribute to absolute URL (string)     | Absolute URL                | IDL attribute value                          |
| Set IDL attribute to any other value `x`       | Relative URL to `String(x)` | IDL attribute value                          |
| Set content attribute to absolute URL (string) | Absolute URL                | As set                                       |
| Set content attribute to any other string `x`  | Relative URL to `x`         | As set                                       |
| Remove content attribute                       | Initial value or `""`       | Removed                                      |

### Transformer `number(options: NumberOptions = {})`

Implements a number attribute with optional range constraints.

```javascript
import { define, attr, number } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  // With default options (see below)
  @attr(number()) accessor foo = 0;

  // With all options set
  @attr(number({ min: 0, max: 10 })) accessor bar = 0;
}
```

Non-numbers get converted to numbers. The transformer allows `null` and
`undefined` (with the latter converting to `null`) if the option `nullable` is
set to `true`. If converting a non-number to a number results in `NaN` and the
option `allowNaN` is not set to `true`, the property setter and the accessor's
initializer throw exceptions.

#### Options for transformer `number()`

- **`min` (number, optional)**: Smallest possible value. Defaults to `-Infinity`. Content attribute values less than `min` get clamped, IDL attribute values get validated and (if too small) rejected with an exception. Can be omitted or set to `null` or `undefined` to signify no minimum value.
- **`max` (number, optional)**: Largest possible value. Defaults to `Infinity`. Content attribute values greater than `max` get clamped, IDL attribute values get validated and (if too large) rejected with an exception. Can be omitted or set to `null` or `undefined` to signify no maximum value.
- **`allowNaN` (boolean, optional)**: Whether or not `NaN` is allowed. Defaults to `false`.
- **`nullable` (boolean, optional)**: Whether or not `null` and `undefined` (with the latter converting to `null`) are allowed. Defaults to `false`.

#### Behavior overview for transformer `number()`

| Operation                                   | IDL attribute value                                          | Content attribute (when used with `@attr()`)                         |
| ------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------- |
| Set IDL attribute to value `x`              | `minmax(opts.min, opts.max, toNumber(x, allowNaN))`          | String(IDL attribute value)                                          |
| Set IDL attribute to out-of-range value     | RangeError                                                   | String(IDL attribute value)                                          |
| Set IDL attribute to `null` or `undefined`  | `null` is `nullable` is true, otherwise `0`                  | Removed if `nullable` is true, otherwise String(IDL attribute value) |
| Set content attribute to value `x`          | `minmax(opts.min, opts.max, toNumber(x, allowNaN))`          | As set                                                               |
| Set content attribute to non-numeric value  | No change, or NaN if option `allowNaN` is `true`             | As set                                                               |
| Set content attribute to out-of-range value | No change                                                    | As set                                                               |
| Remove content attribute                    | `null` is `nullable` is true, otherwise initial value or `0` | Removed                                                              |

### Transformer `int(options: IntOptions = {})`

Implements a bigint attribute. Content attribute values are expressed as plain
numeric strings without the trailing `n` used in JavaScript's BigInt literal
syntax.

```javascript
import { define, attr, int } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  // With default options (see below)
  @attr(int()) accessor foo = 0n;

  // With all options set
  @attr(int({ min: 0n, max: 10n, nullable: false })) accessor bar = 0n;
}
```

The transformer allows `null` and `undefined` (with the latter converting to
`null`) if the option `nullable` is set to `true`. In all other cases, the IDL
attribute setter throws an exception when its input cannot be converted to
BigInt.

#### Options for transformer `int()`

- **`min` (bigint, optional)**: Smallest possible value. Defaults to the minimum possible bigint value. Content attribute values less than `min` get clamped, IDL attribute values get validated and (if too small) rejected with an exception. Can be omitted or set to `null` or `undefined` to signify no minimum value.
- **`max` (bigint, optional)**: Largest possible value. Defaults to the maximum possible bigint value. Content attribute values greater than `max` get clamped, IDL attribute values get validated and (if too large) rejected with an exception. Can be omitted or set to `null` or `undefined` to signify no maximum value.
- **`nullable` (boolean, optional)**: Whether or not `null` and `undefined` (with the latter converting to `null`) are allowed. Defaults to `false`.

#### Behavior overview for transformer `int()`

| Operation                                  | IDL attribute value                                          | Content attribute (when used with `@attr()`)                         |
| ------------------------------------------ | ------------------------------------------------------------ | -------------------------------------------------------------------- |
| Set IDL attribute to value `x`             | `minmax(ops.min, opts.max, BigInt(x))`                       | String(IDL attribute value)                                          |
| Set IDL attribute to out-of-range value    | RangeError                                                   | String(IDL attribute value)                                          |
| Set IDL attribute to `null` or `undefined` | `null` is `nullable` is true, otherwise `0n`                 | Removed if `nullable` is true, otherwise String(IDL attribute value) |
| Set IDL attribute to non-int value         | `BigInt(x)`                                                  | String(IDL attribute value)                                          |
| Set content attribute to value `x`         | `minmax(opts.min, opts.max, BigInt(x))`                      | As set                                                               |
| Set non-int content attribute              | Clamp to Int if float, otherwise no change                   | As set                                                               |
| Remove content attribute                   | `null` is `nullable` is true, otherwise initial value or `0` | Removed                                                              |

### Transformer `bool()`

Implements a boolean attribute. Modeled after built-in boolean attributes such
as `disabled`. Changes to the IDL attribute values _toggle_ the content
attribute and do not just change the content attribute's value.

```javascript
import { define, attr, bool } from "@sirpepe/ornament";

class DemoElement extends HTMLElement {
  @attr(bool()) accessor foo = false;
}
```

In this case, the IDL attribute `foo` always represents a boolean. Any
non-boolean value gets coerced to booleans. If the content attribute `foo` gets
set to any value (including the empty string), `foo` returns `true` - only a
missing content attribute counts as `false`. Conversely, the content attribute
will be set to the empty string when the IDL attribute is `true` and the
attribute will be removed when the IDL attribute is `false`.

If you want your content attribute to represent `"false"` as a string value,
you can use the `literal()` transformer with the strings `"true"` and `"false"`.

#### Behavior overview for transformer `bool()`

| Operation                      | IDL attribute value | Content attribute (when used with `@attr()`)                         |
| ------------------------------ | ------------------- | -------------------------------------------------------------------- |
| Set IDL attribute to value `x` | `Boolean(x)`        | Removed when IDL attribute is `false`, otherwise set to empty string |
| Set content attribute to `x`   | `true`              | As set                                                               |
| Remove content attribute       | `false`             | Removed                                                              |

### Transformer `list(options: ListOptions  = {})`

Implements an attribute with an array of values, defined by another transformer.
The `list()` transformer passes individual items to the transformer passed in
the options and deals with content attributes by splitting and/joining
stringified array contents:

```javascript
import { define, attr, list, number } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  @attr(list({ transform: number(), separator: "," })) accessor numbers = [0];
}
```

This parses the content attribute `numbers` as a comma-separated list of
strings, which are in turn parsed into numbers by the `number()` transformer
passed to the `list()` transformers options. If the content attribute gets set
to something other than a comma-separated list of numeric strings,
the attribute's value resets back to the initial value `[0]`. Any attempt at
setting the IDL attribute to values other arrays of will result in an exception
outright. Depending on the transformer the array's content may be subject to
further validation and/or transformations.

Note that when parsing a content attribute string, values are trimmed and empty
strings are filtered out before they are passed on to the inner transformer:

```javascript
import { define, attr, list, number } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  @attr(list({ transform: number() })) accessor foo = [0];
}
const el = new Test();
el.setAttribute("foo", "   1, , ,,2   ,3     ");
console.log(el.foo); // > [1, 2, 3]
```

#### Options for `list(options?)`

- **`separator` (string, optional)**: Separator string. Defaults to `","`
- **`transform` (Transformer)**: Transformer to use, eg. `string()` for a list of strings, `number()` for numbers etc.

#### Behavior overview for transformer `list()`

| Operation                | IDL attribute value                                                                                                         | Content attribute (when used with `@attr()`)         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Set IDL attribute        | Exception is not an array, otherwise array with content guarded by `options.transformer.validate`                           | IDL attribute values joined with `options.separator` |
| Set content attribute    | Attribute value is split on the separator, then trimmed, then non-empty strings are passed into `options.transformer.parse` | As set                                               |
| Remove content attribute | Initial value or empty array                                                                                                | Removed                                              |

### Transformer `literal(options: LiteralOptions = {})`

Implements an attribute with a finite number of valid values. Should really be
called "enum", but that's a reserved word in JavaScript. It works by declaring
the valid list of values and a matching transformer. If, for example, the list
of valid values consists of strings, then the `string()` transformer is the
right transformer to use:

```javascript
import { define, attr, literal, string } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  @attr(literal({ values: ["A", "B"], transform: string() })) accessor foo =
    "A";
}
```

In this case, the content attribute can be set to any value (as is usual in
HTML), but if the content attribute gets set to a value other than `A` or `B`,
the IDL attribute's value will remain unchanged. Any attempt at setting the
IDL attribute to values other than `A` or `B` will result in an exception.

The default value is either the value the accessor was initialized with or, if
the accessor has no initial value, the first element in `values`.

<details>
<summary>Notes for TypeScript</summary>

To use `literal()` with literal union types, make sure that the `values` option
is _not_ subject to type widening, eg. via `as const`:

```javascript
@define("test-element")
class TestElement extends HTMLElement {

  // Works: values is ["a", "b"]
  @prop(literal({ values: ["a", "b"] as const, transform: string() }))
  accessor bah: "a" | "b" = "a";

  // Errors: values is string[]
  @prop(literal({ values: ["a", "b"], transform: string() }))
  accessor bbb: "a" | "b" = "a";
}
```

The ordering of `values` is not important.

</details>

#### Options for `literal(options?)`

- **`values` (array)**: List of valid values. Must contain at least one element.
- **`transform` (Transformer)**: Transformer to use, eg. `string()` for a list of strings, `number()` for numbers etc.

#### Behavior overview for transformer `literal()`

| Operation                      | IDL attribute value                                                                                      | Content attribute (when used with `@attr()`) |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Set IDL attribute value to `x` | Exception if not in `options.values`, otherwise defined by `options.transformer.validate`                | Defined by `options.transformer.stringify`   |
| Set content attribute to `x`   | Parsed by `options.transformer.parse`. If the result is in `options.values`, result, otherwise no change | As set                                       |
| Remove attribute               | Initial value or first element in `options.values`                                                       | Removed                                      |

### Transformer `json(options: JSONOptions = {})`

Implements an attribute that can take any value. When used with `@attr()`, the
value must be serializable with JSON in order to be reflected as a content
attribute. When used with `@prop()`, no restrictions apply.

```javascript
import { define, attr, prop, json } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  // Must be valid JSON when used with @attr()
  @attr(json()) accessor foo = { user: "", email: "" };
  // When used with prop, any value can be used
  @prop(json()) accessor foo = { value: 42n };
}
```

Content attributes, defined with `@attr()`, are parsed with `JSON.parse()`. In
this case, any invalid JSON is represented with the data used to initialize the
accessor. Using the IDL attribute's setter with inputs than can't be serialized
with JSON.`stringify()` throws errors. This transformer is really just a wrapper
around `JSON.parse()` and `JSON.stringify()` without any object validation.
Equality is checked with `===`.

<details>
<summary>Notes for TypeScript</summary>
Even though the transformer will accept literally any JSON-serializable value at
runtime, TypeScript may infer a more restrictive type from the accessor's
initial value. Decorators can't currently change the type of class members they
are applied to, so you man need to provide a type annotation.
</details>

#### Options for `json(options?)`

- **`reviver` (function, optional)**: The `reviver` argument to use with `JSON.parse()`, if any. Only of use when used with `@attr()`
- **`replacer` (function, optional)**: The `replacer` argument to use with `JSON.stringify()`, if any. Only of use when used with `@attr()`

#### Behavior overview for transformer `json()` (when used with `@attr()`)

| Operation                      | IDL attribute value                                                    | Content attribute                                 |
| ------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------- |
| Set IDL attribute value to `x` | `JSON.parse(JSON.stringify(x))`                                        | `JSON.stringify(idlValue, null, options.reviver)` |
| Set content attribute to `x`   | No change if invalid JSON, otherwise `JSON.parse(x, options.receiver)` | As set                                            |
| Remove content attribute       | Initial value or `undefined`                                           | Removed                                           |

#### Behavior overview for transformer `json()` (when used with `@prop()`)

| Operation                      | IDL attribute value | Content attribute |
| ------------------------------ | ------------------- | ----------------- |
| Set IDL attribute value to `x` | `x`                 | -                 |

### Transformer `any()`

Implements a transformer that does no type checking at all and falls back to
the global `String` function for serializing to content attributes. Use this if
you really don't care about types.

```javascript
import { define, prop, any } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  @prop(any()) accessor whatever: any = 42;
}
```

Transformers returned from calling `any()` make for great prototypes for your
own custom transformer. Just note that transformers are bags of functions and
_not_ classes, so you will need to use `Object.setPrototypeOf()` and friends to
"extend" transformers.

<details>
<summary>Notes for TypeScript</summary>
Even though the transformer will accept literally any value at runtime, TS may
infer a more restrictive type from the accessor's initial values. Decorators
can't currently change the type of class members they are applied to, so you may
need to provide an `any` type annotation.
</details>

### Transformer `event()`

Implements old-school inline event handler attributes in the style of
`onclick="console.log(42)"`. To work properly, this should only be used in
conjunction with `@attr()` (with reflectivity enabled) and on a non-private,
non-static accessor that has a name starting with `on`:

```javascript
import { define, attr, eventHandler } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  @attr(event()) accessor onfoo: ((evt: Event) => void) | null = null;
}
```

This can then be used in HTML:

```html
<my-test onfoo="console.log('Foo event:', event)"></my-test>
<script>
  document.querySelector("my-test").dispatchEvent(new Event("foo"));
  // Logs "'Foo event:', Event{type: "foo"}"
</script>
```

Or in JavaScript:

```javascript
const testEl = document.createElement("my-test");
testEl.onfoo = (event) => console.log("Foo event:", event);
testEl.dispatchEvent(new Event("foo"));
// Logs "'Foo event:', Event{type: "foo"}"
```

Regular "proper" `addEventListener()` is obviously also always available.

It should be noted that for built-in events that bubble, inline event handlers
can be added to _any_ element in order to facilitate event delegation. These
event handlers are considered global event handlers, and all custom inline event
handlers are obviously not global - they can only be used on the components that
explicitly implement them.

#### Behavior overview for transformer `event()`

The behavior of `event()` matches the behavior of built-in event handlers like
`onclick`.

## Metadata

HTML elements do usually not expose any metadata, even though knowing the names
and data types for content attributes would be quite useful sometimes. Ornament
exposes a few metadata helper functions that help in scenarios where
meta-programming components (eg. SSR) is required.

### `getTagName(instanceOrCtor)`

Given an instance or custom element constructor, this function returns
**the element's tag name**. It returns `null` if the object in question is not
a custom element defined via `@define()`:

```javascript
import { define, getTagName } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {}

console.log(getTagName(Test));
// > "my-test"

console.log(getTagName(new Test()));
// > "my-test"
```

This serves roughly the same function as the standard
[CustomElementRegistry.getName() method](https://developer.mozilla.org/en-US/docs/Web/API/CustomElementRegistry/getName)
but does not require access to the specific CustomElementRegistry that the
element is registered with.

### `listAttributes(instanceOrCtor)`

**Lists the content attribute names** that were defined via `@attr()` on the
custom element (or constructor) in question:

```javascript
import { define, attr, string, listAttributes } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  @attr(string()) accessor foo = "";
  @attr(string(), { as: "asdf" }) accessor bar = "";
}

console.log(listAttributes(Test));
// > ["foo", "asdf"]

console.log(listAttributes(new Test()));
// > ["foo", "asdf"]
```

This is roughly analogous to the `observedAttributes` static property on custom
element classes, but only lists content attributes defined with ornament's
`@attr()` - manually defined attributes and IDL attributes defined with
`@prop()` are excluded.

### `getAttribute(instanceOrCtor, contentAttributeName)`

**Returns the IDL attribute name and transformer** used to define a content
attribute:

```javascript
import { define, attr, number, getAttribute } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  // Requires non-negative values
  @attr(number({ min: 0 }), { as: "asdf" }) accessor bar = 0;
}

const { prop, transformer } = getAttribute(Test, "asdf");

console.log(prop);
// > "bar" - the backend accessor for the content attribute "asdf"

transformer.parse("-1");
// > 0; input clamped to valid value

transformer.validate(-1, true);
// Throws an error; the transformer only accepts nonnegative numbers
```

This is particularly useful if you need access to the parsing and
stringification logic for content attributes for eg. SSR.

## Event Bus

Ornament runs intra-component communication over an internal event bus. You will
almost certainly never need to access it directly, but there is is an API just
in case.

| Event              | Cause                                     | Event type                          | Payload (`args` property on the event object)                        |
| ------------------ | ----------------------------------------- | ----------------------------------- | -------------------------------------------------------------------- |
| `init`             | Constructor ran to completion             | `OrnamentEvent<"init">`             | `[]`                                                                 |
| `connected`        | `connectedCallback()` fired               | `OrnamentEvent<"connected">`        | `[]`                                                                 |
| `disconnected`     | `disconnectedCallback()` fired            | `OrnamentEvent<"disconnected">`     | `[]`                                                                 |
| `adopted`          | `adoptedCallback()` fired                 | `OrnamentEvent<"adopted">`          | `[]`                                                                 |
| `prop`             | IDL attribute change (`@prop` or `@attr`) | `OrnamentEvent<"prop">`             | `[Name: string \| symbol, NewValue: any]`                            |
| `attr`             | Content attribute change (`@attr`)        | `OrnamentEvent<"attr">`             | `[Name: string, OldValue: string \| null, NewValue: string \| null]` |
| `formAssociated`   | `formAssociatedCallback()` fired          | `OrnamentEvent<"formAssociated">`   | `[Owner: HTMLFormElement \| null]                                    |
| `formReset`        | `formResetCallback()` fired               | `OrnamentEvent<"formReset">`        | `[]`                                                                 |
| `formDisabled`     | `formDisabledCallback()` fired            | `OrnamentEvent<"formDisabled">`     | `[Disabled: boolean]`                                                |
| `formStateRestore` | `formStateRestoreCallback()` fired        | `OrnamentEvent<"formStateRestore">` | `[Reason: "autocomplete" \| "restore"]`                              |

<details>
<summary>Notes for TypeScript</summary>

You can declare additions to the global interface `OrnamentEventMap` to extend
this list with your own events.

</details>

### `trigger(instance, name, ...payload)`

Dispatches an event on the event bus for the component `instance`. The arguments
`payload` must be all the for the `args` property on the event object on the
event object (eg. a single boolean for for `formDisabled`).

```javascript
import { trigger } from "@sirpepe/ornament";

// Dispatches an "connected" event. This will run all methods on "someElement"
// that were decorated with @connect().
trigger(someElement, "connected"); // note no args

// Dispatches an "prop" event. This will run all methods on "someElement"
// that were decorated with @reactive(), provided the "foo" key is not excluded
// in the setup of the @reactive decorator
trigger(someElement, "prop", "foo", 42); // note args for prop name and value
```

### `listen(instance, name, callback, options?)`

Listens to events on the event bus for the component `instance`. The event bus
is an instance of `EventTarget`, which means that you can pass any and all
[event listener options](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#options)
as the last argument.

```javascript
import { listen } from "@sirpepe/ornament";

// Listen for "prop" event on the event bus for "someElement"
listen(someElement, "prop", (evt) => {
  const [name, value] = event.args;
  window.alert(`Attribute ${name} was changed to ${value}!`);
});
```

### class `OrnamentEvent<K extends keyof OrnamentEventMap>`

Event type used on the internal event bus. Only really useful if you want to
create your own events while using TypeScript.

## Other utilities

### `getInternals(instance: HTMLElement): ElementInternals`

Get the [ElementInternals](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals)
for a component instance. While `getInternals()` be called as often as required,
component's `attachInternals()` methods are still single-use:

```javascript
import { define, getInternals } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {}
const testEl = new Test();

const internals1 = getInternals(testEl);
const internals2 = testEl.attachInternals();
console.log(internals1 === internals2); // > true

getInternals(testEl); // works a second time
getInternals(testEl); // works a third time
testEl.attachInternals()).to.throw(); // > Exception on second use
```

## Symbols

### `NO_VALUE`

Transformers can return a special symbol to indicate that they were unable to
parse an input. This symbol is exported by Ornament as `NO_VALUE` and is also
available behind the key `"ORNAMENT_NO_VALUE"` in the global symbol registry.

### `METADATA`

Ornament, being a collection of decorators, stores its metadata in
[Decorator Metadata](https://github.com/tc39/proposal-decorator-metadata). To
avoid collisions with other libraries, the actual metadata is hidden behind a
symbol that is exported by Ornament as `ORNAMENT_METADATA_KEY` or available
behind the key `"ORNAMENT_METADATA_KEY"` in the global symbol registry. The
contents of the metadata record should not be considered part of Ornament's
stable API and could change at any moment. Use the metadata API instead.

## Troubleshooting

### TypeError: Cannot read private member from an object whose class did not declare it

This usually happens when methods decorated with `@init()` run at inopportune
times. Consider the following example:

```javascript
import { define, init } from "@sirpepe/ornament";

function otherDecorator(target) {
  return class OtherMixin extends target {
    #secret = 42;
    get foo() {
      return this.#secret; // <- Fails because @init() runs too early
    }
  };
}

@otherDecorator
@define("foo-bar") // If this was before @otherDecorator it would work
class Test extends HTMLElement {
  @init() // Runs after the constructor of Test has run, does not wait for the mixin class
  method() {
    console.log(this.foo);
  }
}

new Test();
```

In this scenario, `@define()` sets up to trigger `@init()` once the constructor
of `Test` has finished. Inside `Test`, the method `method()` accesses the getter
`foo` which is provided by the decorator `@otherDecorator`. The getter in turn
tries to accesses the private field `#secret`, but fails with an exception.
This happens because `@define()` installs logic that triggers the init event on
the constructor for class `Test`, but the resulting class gets extended in turn
by `OtherMixin`.

```pseudocode
OtherMixinConstructor(
  DefineMixinConstructor(
    TestConstructor(
      HTMLElementConstructor()
    )
    // <---- init event happens here, after TestConstructor has run
  )
  // <---- finishes only after the init event has happened
)
```

This results in the event running before the private field `#secret` is fully
initialized. The simplest way to remedy this situation is to apply
`@otherDecorator` first. You might also want to consider using `@connected()`
instead of `@init()`.

This is not a bug in Ornament, but rather a simple effect of how mixin classes
are subclasses of their targets. Because `@init()` is equivalent to calling the
decorated method in the constructor, the effect can be reproduced [without involving Ornament at all:](https://babeljs.io/repl#?browsers=defaults&build=&builtIns=false&corejs=3.21&spec=false&loose=false&code_lz=GYVwdgxgLglg9mABAEwKYTgJwIZSwCim0wHNUoBKRAbwChFFNyRMkIAbbAZy8QBF0WXFgCyMAB4wkqcVFRhkvIqXI16DRAGIu6JlEQBeRABYATAG51DMvuCpcLVPip0NGvSyRQAFjC4A6bV1ySzcAX3UwywiGWgABNAwcPExaDm5eAEE1BgwwLihMEGgCFytEPK44dlR_djgSQl8AuwcmClDECIjaMFQAd0RM50sgA&debug=false&forceAllTransforms=false&modules=false&shippedProposals=false&circleciRepo=&evaluate=true&fileSize=false&timeTravel=false&sourceType=module&lineWrap=true&presets=env%2Creact%2Cstage-2&prettier=false&targets=&version=7.24.5&externalPlugins=%40babel%2Fplugin-proposal-decorators%407.23.9&assumptions=%7B%7D)

```javascript
function decorator(target) {
  return class DecoratorMixin extends target {
    #secret = 42;
    get feature() {
      return this.#secret;
    }
  };
}

@decorator
class A {
  constructor() {
    console.log(this.feature);
  }
}

new A();
```

## Cookbook

### Debounced reactive

`@reactive()` causes its decorated method to get called for once for _every_
attribute and property change. This is sometimes useful, but sometimes you will
want to batch method calls for increased efficiency. This is easy if you combine
`@reactive()` with `@debounce()`:

```javascript
import { define, prop, reactive, debounce int } from "@sirpepe/ornament";

@define("my-test")
export class TestElement extends HTMLElement {
  @prop(int()) accessor value = 0;

  @reactive()
  @debounce()
  #log() {
    console.log("Value is now", this.value);
  }
}

let el = new TestElement();
el.value = 1;
el.value = 2;
el.value = 2;

// Only logs "Value is now 3"
```

### Rendering shadow DOM with uhtml

Ornament does not directly concern itself with rendering Shadow DOM, but you
can combine Ornament with suitable libraries such as
[uhtml](https://github.com/WebReflection/uhtml):

```javascript
import { render, html } from "uhtml";
import { define, prop, reactive, debounce int } from "@sirpepe/ornament";

@define("counter-element")
export class CounterElement extends HTMLElement {
  @prop(int()) accessor value = 0;

  @reactive()
  @debounce()
  #render() {
    render(
      this.shadowRoot ?? this.attachShadow({ mode: "open" }),
      html`
        Current value: ${this.value}
        <button .click={() => ++this.value}>Add 1</button>
      `
    );
  }
}
```

This component uses an event handler to update the decorated accessor `value`,
which in turn causes the `@reactive()` method `#render()` to update the UI
accordingly - debounced with `@debounce()` for batched updates.

### Rendering shadow DOM with Preact

You can also use [Preact](https://preactjs.com/) to render shadow DOM:

```javascript
import { define, attr, number, reactive, connected } from "@sirpepe/ornament";
import { Fragment, h, render } from "preact";

@define("click-counter")
class ClickCounter extends HTMLElement {
  #shadow = this.attachShadow({ mode: "closed" });

  @attr(number({ min: 0 }), { reflective: false }) accessor up = 0;
  @attr(number({ min: 0 }), { reflective: false }) accessor down = 0;

  @connected()
  @reactive()
  render() {
    render(
      <>
        <button onClick={() => this.up++}>+1</button>
        Total: <b>{this.up + this.down}</b>
        <button onClick={() => this.down--}>-1</button>
      </>,
      this.#shadow,
    );
  }
}
```

In the case of Web Components and Ornament, it makes some sense to use class
members for local state instead of hooks.

### Read-only property

You can create a writable private accessor with `@prop()` and manually expose a
public getter. This keeps reactive functions working, but only allows readonly
access from outside the component:

```javascript
import { define, attr, reactive, string } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  // Writable, but private
  @prop(string()) accessor #foo = "Starting value";

  // Provides public readonly access to #foo
  get foo() {
    return this.#foo;
  }

  change() {
    this.#foo++;
  }

  // Reacts to changes to #foo, which can only be caused by calling the method
  // `change()`
  @reactive()
  log() {
    console.log(this.#foo);
  }
}
```

### Custom logic in IDL attributes

The point of the `accessor` keyword is to generate a getter, setter, and private
property in a way that makes it easy to apply a decorator to everything at once.
But because the getters and setters are auto-generated, there is no
non-decorator way to attach custom logic to `accessor` members. To work around
this for IDL attributes defined via `@attr()` or `@prop()`, you can build a
and decorate a private or symbol accessor that you then expose with a custom
facade:

```javascript
@define("my-test")
class Test extends HTMLElement {
  // Implements a content attribute "foo" with getters and setters at #secret
  @attr(string(), { as: "foo" }) accessor #secret = "A";

  // To provide public IDL attributes, we just write a getter/setter pair with
  // names matching the content attribute
  get foo() {
    console.log("Custom getter logic!");
    return this.#secret; // accesses the getter decorated with @attr()
  }

  set foo(value) {
    console.log("Custom seter logic!");
    this.#secret = value; // accesses the setter decorated with @attr()
  }
}
```

Notes for `@attr()`:

1. The option `as` is _mandatory_ when you use `@attr()` on a private or symbol accessor
1. Ornament throws exceptions if the class does not implement a public API for a content attribute defined with `@attr()` on a private or symbol accessor

### Event delegation

The following example captures all `input` events fired by
`<input type="number">` in the document:

```javascript
import { define, subscribe } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  @subscribe(document.documentElement, "input", {
    predicate: (evt) => evt.target.matches("input[type-number]"),
  })
  log(evt) {
    console.log(evt); // "input" events
  }
}
```

If you'd rather catch event happening in the component's shadow dom, the syntax
gets a bit more gnarly at first:

```javascript
import { define, subscribe } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  root = this.attachShadow({ mode: "open" });
  @subscribe((instance) => this.root, "input", {
    predicate: (evt) => evt.target.matches("input[type-number]"),
  })
  log(evt) {
    console.log(evt); // "input" events
  }
}
```

Decorators like `@subscribe` run when the class definition initializes, and at
that point, no class instances (and no shadow DOM to subscribe to) exist. We
must therefore provide a function that can return the event target on
initialization. To make this less of an eyesore, it makes sense to create a
custom decorator for event delegation based on `@subscribe`:

```javascript
import { define, subscribe } from "@sirpepe/ornament";

const handle = (eventName, selector) =>
  subscribe((instance) => this.root, eventName, {
    predicate: (evt) => evt.target.matches(selector),
  });

@define("my-test")
class Test extends HTMLElement {
  root = this.attachShadow({ mode: "open" });

  @handle("input", "input[type-number]") // Much better!
  log(evt) {
    console.log(evt); // "input" events
  }
}
```

Note that the function that `@subscribe` takes to access event targets can _not_
access a classes private fields. The shadow root has to be publicly accessible
(unless you want to mess around with WeakMaps storing ShadowRoots indexed by
element instances or something similar).

Also note that not all events bubble, so you might want to use event capturing
instead:

```javascript
import { define, subscribe } from "@sirpepe/ornament";

// This can now handle all events from the shadow root
const capture = (eventName, selector) =>
  subscribe((instance) => this.root, eventName, {
    predicate: (evt) => evt.target.matches(selector),
    capture: true,
  });
```

Also also note that only composed events propagate through shadow boundaries,
which may become important if you want to nest components with shadow dom and
also want to use event delegation.

### Custom defaults

If you don't like Ornament's defaults, remember that decorators and transformers
are just functions. This means that you can use partial application to change
the default options:

```javascript
import {
  define,
  attr,
  reactive as baseReactive,
  string,
} from "@sirpepe/ornament";

// @reactive with "keys" always set to ["foo"]
const reactive = (options) => baseReactive({ ...options, keys: ["foo"] });

@define("my-test")
class Test extends HTMLElement {
  @prop(string()) accessor foo = "A"; // included in options.keys
  @prop(string()) accessor bar = "A"; // excluded from options.keys

  @reactive()
  log() {
    console.log("Hello");
  }
}

let test = new Test();
test.foo = "B"; //  logs "Hello"
test.bar = "B"; //  does not log anything
```

The same approach works when you want to create specialized decorators from
existing ones...

```javascript
import { define, subscribe } from "@sirpepe/ornament";

// A more convenient decorator for event delegation
function listen(event, selector = "*") {
  return subscribe(document.documentElement, "input", (evt) =>
    evt.target.matches(selector),
  );
}

@define("my-test")
class Test extends HTMLElement {
  @listen("input", "input[type-number]")
  log(evt) {
    console.log(evt);
  }
}
```

... or when you want to create your own transformers:

```javascript
import { define, attr, number } from "@sirpepe/ornament";

function nonnegativeNumber(otherOptions) {
  return number({ ...otherOptions, min: 0 });
}

@define("my-test")
class Test extends HTMLElement {
  @attr(nonnegativeNumber({ max: 1337 }))
  accessor foo = 42;
}
```

You can also compose decorators, since they are just functions over a target and
a context object:

```javascript
import { reactive as baseReactive, connected } from "@sirpepe/ornament";

// Combines @reactive() and @connected() into one handy decorator that runs
// methods when components connect AND when their attributes change
function reactive() {
  return function (target, context) {
    return baseReactive()(connected()(target, context), context);
  };
}
```

And while we are at it, why not compose _and_ partially apply decorators:

```javascript
import {
  reactive as baseReactive,
  connected,
  debounce,
} from "@sirpepe/ornament";

// Combines @reactive(), @connected() and @debounce():
// - reacts to attribute updates (only while the component is connected)
// - and runs its target method at most once per frame
// - and also when the component connects
const reactive = () => (target, context) =>
  baseReactive({ predicate: ({ isConnected }) => isConnected })(
    connected()(debounce({ fn: debounce.raf() })(target, context), context),
    context,
  );
```

Also remember that transformer functions return plain objects that you can
modify for one-off custom transformers:

```javascript
import { define, attr, string } from "@sirpepe/ornament";

// The built-in string transformer always represents strings, but we want to
// allow `null` in this case
let nullableString = {
  ...string(),
  validate(value) {
    if (value === null || typeof value === "undefined") {
      return value;
    }
    return String(value);
  },
};

@define("my-test")
class Test extends HTMLElement {
  @attr(nullableString())
  accessor foo = "Hello";
}
```

Ornament's building blocks are extremely basic and you should hack, combine and
extend them to get the most out of your components.
