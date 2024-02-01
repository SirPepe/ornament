# Ornament

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/logo_dark.png">
  <img alt="" src="./assets/logo.png">
</picture>

Unopinionated, pareto-optimal, tiny (<= 4k) anti-framework for building vanilla
web component infrastructure:

```javascript
import { define, attr, string, number, reactive } from "@sirpepe/ornament";

// Register the element with the specified tag name
@define("my-greeter")
class MyGreeter extends HTMLElement {
  // No built-in rendering functionality. Shadow DOM or light DOM? Template
  // library A, B, or C? Pick your own poison!
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
```

The code above

- registers the class `MyGreeter` with the tag name `my-greeter`
- implements two content attributes named `name` and `age`, which includes
  - initial values initialized from HTML (when possible)
  - content attribute change handling (via `setAttribute()` and the like)
  - DOM attribute change handling via a JavaScript getter/setter pair, with type checking/coercion included (`name` is always a string, `age` is always a number >= 0)
- implements a `greet()` method that...
  - automatically gets called when any of the attributes decorated with `@attr` change
  - automatically gets called when the element instance initializes
- does not add any abstractions to any native API at all

This translates to the following boilerplate monstrosity when written by hand:

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
    if (Number.isNaN(age)) { // Remember to keep NaN in check
      age = 0;
    }
    this.#age = 0;
    this.greet(); // Remember to run the method on initialization
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
    if (Number.isNaN(value) || value < 0) { // Remember to keep NaN in check
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
      if (Number.isNaN(value) || value < 0) { // Remember to keep NaN in check
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

Ornament aims to make *only the most tedious bits* of building vanilla web
components (attribute handling and lifecycle reactions) easy by adding some
primitives that really should be part of the standard, but aren't.

## Guide

### Installation

Install [@sirpepe/ornament](https://www.npmjs.com/package/@sirpepe/ornament)
with your favorite package manager. To get the decorator syntax working in 2024,
you will probably need [@babel/plugin-proposal-decorators](https://babeljs.io/docs/babel-plugin-proposal-decorators)
(with option `version` set to `"2023-05"`) or
[TypeScript 5.0+](https://devblogs.microsoft.com/typescript/announcing-typescript-5-0/#decorators)
(with the option `experimentalDecorators` turned *off*).

Apart from that, Ornament is just a bunch of functions. No further setup
required, no extra concepts to learn.

### General philosophy

The native APIs for web components are verbose and imperative, but lend
themselves to quite a bit of streamlining with
[the upcoming syntax for ECMAScript Decorators](https://2ality.com/2022/10/javascript-decorators.html).
The native APIs are also missing a few important primitives. Ornament's goal is
to provide the missing primitives and to streamline the developer experience.
Ornament is **not a framework** but instead aims to be:

- **as stable as possible** by remaining dependency-free and keeping its own code to an absolute minimum
- **fast and lean** by being nothing more than just a bag of relatively small and simple functions
- **malleable** by being easy to extend, easy to customize (through partial application) and easy to get rid of
- **universal** by adhering to (the spirit of) web standards, thereby staying compatible with vanilla web component code as well as all sorts of web frameworks
- equipped with useful type definitions (and work within the constraints of TypeScript)

Ornament is *infrastructure for web components* and not a framework itself. It
makes dealing with the native APIs bearable and leaves building something
actually sophisticated up to you. Ornament does not come with *any* of the
following:

- state management (even though it is simple to connect components to signals or event targets)
- rendering (but it works well with [uhtml](https://github.com/WebReflection/uhtml), [Preact](https://preactjs.com/) and similar libraries)
- built-in solutions for client-side routing, data fetching, or anything beyond the components themselves
- any preconceived notions about what should be going on server-side
- specialized syntax for every (or any specific) use case

You can (and probably have to) therefore pick or write your own solutions for
the above features. Check out `main.js` in `examples/todo-list/src` for an
example!

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
  fine. Ornament *extends* what you can do with custom elements, it does not
  abstract anything away.
- Much of your migration will depend on **how you build on top of Ornament.**
  You should keep reusable components and app-specific state containers
  separate, just as you would do in e.g. React. This will make maintenance and
  eventual migration much easier, but this is really outside of Ornament's area
  of responsibility.

In general, migrating away should not be too problematic. The components that
you will build with Ornament will naturally tend to be self-contained and
universal, and will therefore more or less always keep chugging along.

### Component registration

Using [`customElements.define()`](https://developer.mozilla.org/en-US/docs/Web/API/CustomElementRegistry/define)
is no too bad, but setting a custom element's tag name should really be part of
the class declaration. The `@define()` decorator provides just that:

```javascript
import { define } from "@sirpepe/ornament";

@define("my-test")
class MyTest extends HTMLElement {}
```

### Safe upgrades

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

### Lifecycle callbacks

By centralizing event handling to lifecycle callbacks, native web component APIs
force you to scatter function calls across multiple methods:

```javascript
class MyComponent extends HTMLElement {
  thisNeedsToRunWhenTheElementConnectsOrDisconnects() {
    console.log(this.isConnected);
  }

  connectedCallback() {
    this.thisNeedsToRunWhenTheElementConnectsOrDisconnects();
  }

  disconnectedCallback() {
    this.thisNeedsToRunWhenTheElementConnectsOrDisconnects();
  }
}
```

Ornaments lifecycle decorators enable you to declare what events a method should
react to on the method itself:

```javascript
import { define, connected, disconnected } from "@sirpepe/ornament";

@define("my-test")
class MyComponent extends HTMLElement {
  @connected()
  @disconnected()
  thisNeedsToRunWhenTheElementConnectsOrDisconnects() {
    console.log(this.isConnected);
  }
}
```

### Attribute handling

Getting attribute handling on Web Components right is *hard*, because many
different APIs and states need to interact in just the right way and the related
code tends to end up scattered across various class members. Attributes on HTML
elements have two faces: the *content attribute* and the *IDL attribute*.
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

This is all *very* annoying to write by hand, but because the above behavior is
more or less the same for all attributes, it is possible to to simplify the
syntax quite a bit:

```javascript
import { attr, define number } from "@sirpepe/ornament";

@define("my-test")
class MyTest extends HTMLElement {
  @attr(number({ min: -100, max: 100 })) accessor value = 0;
  @reactive log() {
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

## Decorators

### API overview

| Decorator             | Class element       | `static` | `#private` | Symbols          |
| --------------------- | ------------------- | -------- | ---------- | ---------------- |
| `@define()`           | Class               | -        | -          | -                |
| `@enhance()`          | Class               | -        | -          | -                |
| `@attr()`             | Accessor            | ✕        | ✓[^1]      | ✓[^1]            |
| `@prop()`             | Accessor            | ✕        | ✓          | ✓                |
| `@reactive()`         | Method              | ✕        | ✓          | -                |
| `@connected()`        | Method              | ✕        | ✓          | -                |
| `@disconnected()`     | Method              | ✕        | ✓          | -                |
| `@adopted()`          | Method              | ✕        | ✓          | -                |
| `@formAssociated()`   | Method              | ✕        | ✓          | -                |
| `@formReset()`        | Method              | ✕        | ✓          | -                |
| `@formDisabled()`     | Method              | ✕        | ✓          | -                |
| `@formStateRestore()` | Method              | ✕        | ✓          | -                |
| `@subscribe()`        | Method              | ✕        | ✓          | -                |
| `@debounce()`         | Method, Class Field | ✕        | ✓          | ✓ (Class fields) |

[^1]: Can be `#private` or a symbol *if* a non-private non-symbol getter/setter
      pair for the attribute name exists and a content attribute name has been
      set using the `as` option.

### `@define(tagName: string, options: ElementDefinitionOptions = {})`

**Class decorator** to register a class as a custom element. This also sets up
attribute observation for use with the [@attr()](#attrtransformer-options)
decorator and prepares the hooks for lifecycle decorators like `@connected()`.

```javascript
import { define } from "@sirpepe/ornament";

@define("my-test")
class MyTest extends HTMLElement {}

console.log(document.createElement("my-test")); // instance of MyTest
```

**Note for TypeScript:** you should add your custom element's interface to
`HTMLElementTagNameMap` to make it work with native DOM APIs:

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

It is entirely possible to register base class and subclasses with separate tag
names.

### `@enhance()`

**Class decorator** to set up attribute observation and lifecycle hooks
*without* registering the class as a custom element.

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
in some other way that what `@define()` provides. It is safe to apply
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

### `@prop(transformer: Transformer)`

**Accessor decorator** to define an IDL property on the custom element class
*without* an associated content attribute. Such a property is more or less a
regular accessor with two additional features:

- it uses [transformers](#transformers) for type checking and validation
- changes cause [@reactive()](#reactiveoptions) methods to run

Example:

```javascript
import { define, prop, number } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  // Applies the number transformer to ensure that foo is always a number
  @prop(number()) accessor foo = 23;

  // Automatically runs when "foo" (or any accessor decorated with @prop() or
  // @attr()) changes
  @reactive() log() {
    console.log(`Foo changed to ${this.foo}`);
  }
}

let testEl = document.createElement("my-test");
console.log(testEl.foo); // logs 23
testEl.foo = 42; // logs "Foo changed to 42"
console.log(testEl.foo); // logs 42
testEl.foo = "asdf"; // throw exception (thanks to the number transformer)
```

Accessors defined with `@prop()` work as a *JavaScript-only API*. Values can
only be accessed through the accessor's getter, invalid values are rejected by
the setter with exceptions. `@prop()` can be used on private accessors or
symbols without problem.

Note that you can still define your own accessors, getters, setters etc. as you
would usually do. They will still work as expected, but they will not cause
`@reactive()` methods to run.

### `@attr(transformer: Transformer, options: AttrOptions = {})`

**Accessor decorator** to define an IDL attribute with a matching content
attribute on the custom element class. This results in something very similar to
accessors decorated with `@prop()`, but with the following additional features:

- Its value can be initialized from a content attribute, if the attribute is present
- Changes to the content attribute's value update the value of the IDL attribute to match (depending on the options and the transformer)

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
testEl.setAttribute("foo", "asdf") // works, content attributes can be any string
console.log(testEl.foo); // logs 23 (fallback value)
```

Accessors defined with `@attr()` work like all other supported attributes on
built-in elements. Content attribute values (which are always strings) get
parsed by the transformer, which also deals with invalid values in a graceful
way (ie without throwing exceptions). Values can also be accessed through the
IDL property's accessor, where invalid values *are* rejected with exceptions by
the setter.

`@attr()` can only be used on private accessors or symbols only if the following
holds true:

1. The option `as` *must* be set
2. A non-private, non-symbol getter/setter pair for the attribute name defined in the option `as` *must* exist on the custom element class

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

### `@reactive(options: ReactiveOptions = {})`

**Method decorator** that causes class methods to run when accessors decorated
with `@prop()` or `@attr()` change their values:

```javascript
import { define, reactive, prop, number } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  @prop(number()) accessor foo = 0;
  @prop(number()) accessor bar = 0;

  @reactive({ initial: false }) log() { // note "initial: false"
    console.log(`foo is now ${this.foo}, bar is now ${this.bar}`);
  }
}

let testEl = document.createElement("my-test");
testEl.foo = 1;
testEl.bar = 2;

// first logs "foo is now 1, bar is now 0"
// then logs "foo is now 1, bar is now 2"
```

Reactive methods are called with no arguments. They react to changes to the
instances' internal state and should therefore be able to access all relevant
data through `this`.

Unless the `initial` option is set to `false` (provided `options.predicate` was
omitted or returns `true`), the decorated method will run once upon the
element's constructor finishing. In many cases you may want to apply
`@reactive()` to methods decorated with [@debounce()](#reactiveoptions) to
prevent excessive calls.

The `predicate` and/or `keys` options can be used to control whether the
function reacts to an update. For the function to run, the following needs to be
true:

1. `options.keys` must either have been omitted or must contain the IDL or
   content attribute name that changed
2. `options.excludeKeys` must either have been omitted or must not contain the
   IDL or content attribute name that changed
3. `options.predicate` must either have been omitted or must return true when
   called immediately before the function is scheduled to run

#### Options for `@reactive()`

- **`initial` (boolean, optional)**: Whether or not to run the function when the element's constructor finishes, before any actual changes to any decorated accessor. Defaults to `true`
- **`keys` (Array\<string | symbol\>, optional)**: List of attributes (defined by `@prop()` or `@attr()`) to monitor. Can include private names and symbols. Defaults to monitoring all content and IDL attributes defined by `@prop()` or `@attr()`.
- **`excludeKeys` (Array\<string | symbol\>, optional)**: List of attributes (defined by `@prop()` or `@attr()`) not to monitor. Can include private names and symbols. Defaults to an empty array.
- **`predicate` (Function `(instance: T) => boolean`)**: If provided, controls whether or not the decorated method is called for a given change

### `@connected()`

**Method decorator** that causes decorated class methods to run when the
component connects to the DOM  and the component's `connectedCallback()` fires:

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

### `@disconnected()`

**Method decorator** that causes decorated class methods to run when the
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

### `@adopted()`

**Method decorator** that causes decorated class methods to run when the
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

### `@formAssociated()`

**Method decorator** that causes decorated class methods to run when a
form-associated component's form owner changes and its `formAssociatedCallback()`
fires:

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

### `@formReset()`

**Method decorator** that causes decorated class methods to run when a
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

Not that form reset events are observably asynchronous, unlike all other
lifecycle events. This is due to the form reset algorithm itself being async.

### `@formDisabled()`

**Method decorator** that causes decorated class methods to run when a
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

### `@formStateRestore()`

**Method decorator** that causes decorated class methods to run when a
form-associated component's `formStateRestoreCallback()` fires. This is not
supported in Chrome-based browsers as of November 2023.

### `@subscribe(...args)`

**Method decorator** that causes decorated class methods to subscribe to either
[Event Targets](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget) or
[signals](https://github.com/preactjs/signals), depending on the arguments. The
subscriptions activate when an element's constructor completes and the all
listeners automatically unsubscribe when the subscribed element gets garbage
collected.

#### Subscribe to EventTargets: `@subscribe(targetOrTargetFactory, eventNames, options?)`

Subscribe to one or more events an EventTarget. `EventTarget` is an interface
that objects such as HTMLElement, Window, Document and *many* more objects
implement. You can also create a vanilla event target by calling
`new EventTarget()`...

```javascript
import { define, subscribe } from "@sirpepe/ornament";

const myTarget = new EventTarget();

@define("my-test")
class Test extends HTMLElement {
  @subscribe(myTarget, "foo") log(evt) {
    // evt = Event({ name: "foo", target: myTarget })
    // this = Test instance
    console.log(`'${evt.type}' event fired!`);
  }
}

let testEl = document.createElement("my-test");

myTarget.dispatchEvent(new Event("foo"));

// testEl.log logs "'foo' event fired!"
```

... or you can build an event bus that implements EventTarget together with
`@subscribe()` to keep your various components in sync:

```javascript
import { define, subscribe } from "@sirpepe/ornament";

class DataSource extends EventTarget {
  #value = 0;
  get value() {
    return this.#value;
  }
  set value(newValue) {
    this.#value = newValue;
    this.dispatchEvent(new Event("change"));
  }
}

const source = new DataSource();

@define("my-test")
class Test extends HTMLElement {
  #shadow = this.attachShadow({ mode: "open" });

  @subscribe(source, "change") #update() {
    this.#shadow.innerHTML = `Value is now ${source.value}`;
  }
}

let a = document.createElement("my-test");
let b = document.createElement("my-test");

source.value = 42;
```

Both instances of `my-test` are now subscribed to `change` events on the data
source and their shadow DOM content stays in sync.

To subscribe to multiple events, pass a single string with the event names
separated by whitespace.

You can also provide a target-producing factory in place of the target itself:

```javascript
import { define, subscribe } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  // "window" is a perfectly valid event target
  @subscribe(window, "update") #a() {} // same effect as below
  @subscribe(() => window, "update") #b() {} // same effect as above
}
```

The target-producing factory can be used to access targets that depend on the
element instance, such as the element's shadow root. The factory function gets
called each time an element initializes, with its first argument set to the
instance.

##### Options for `@subscribe()` for EventTarget

- **`targetOrTargetFactory` (EventTarget | (instance: T) => EventTarget)**: The event target (or event-target-returning function) to subscribe to
- **`eventNames` (string)**: The event(s) to listen to. To subscribe to multiple events, pass a single string with the event names separated by whitespace
- **`options` (object, optional)**: Event handling options, consisting of...
  - **predicate (function `(instance: T, event: Event) => boolean`, optional)**: If provided, controls whether or not the decorated method is called for a given event. Gets passed the element instance and the event object, and must return a boolean
  - **capture (boolean, optional):** [option for `addEventListener()`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#parameters)
  - **once (boolean, optional):** [option for `addEventListener()`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#parameters)
  - **passive (boolean, optional):** [option for `addEventListener()`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#parameters)
  - **signal (AbortSignal, optional):** [option for `addEventListener()`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#parameters)

#### Subscribe to Signals: `@subscribe(signal, options?)`

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
  - **predicate (function `(instance: T, value) => boolean`, optional)**: If provided, controls whether or not the decorated method is called for a given signal update. Gets passed the element instance and the signal's value, and must return a boolean

### `@debounce(options?)`

**Method and class field decorator** for debouncing method/function invocation:

```javascript
import { define, debounce } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  // Debounce a class method
  @debounce() test1(x) {
    console.log(x);
  }
  // Debounce a class field function
  @debounce() test2 = (x) => {
    console.log(x);
  }
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

**Note for TypeScript:** Debouncing a method or class field function makes it
impossible for the method/function to return anything but `undefined`.
TypeScript does currently not allow decorators to modify its target's type, so
`@debounce()` can't do that. If you apply `@debounce()` to a method
`(x: number) => number`, TypeScript will keep using this signature, even though
the decorated method will no longer be able to return anything but `undefined`.

#### Options for `@debounce()`

- **`fn` (function, optional)**: The debounce function to use. Defaults to `debounce.raf()`. The following debounce functions are available:
  - `debounce.raf()`: uses `requestAnimationFrame()`
  - `debounce.timeout(ms: number)`: uses `setTimeout()`
  - `debounce.asap()`: runs the function after the next microtask

## Transformers

Transformers define how the accessor decorators `@attr()` and `@prop()`
implement attribute and property handling. This includes converting content
attributes from and to IDL attributes, type checks on IDL setters, and running
side effects.

### Transformers overview

| Transformer       | Type                                           | Options                              |
| ------------------| -----------------------------------------------|--------------------------------------|
| `string()`        | `string`                                       |                                      |
| `href()`          | `string` (URL)                                 |                                      |
| `bool()`          | `boolean`                                      |                                      |
| `number()`        | `number`                                       | `min`, `max`, `allowNaN`, `nullable` |
| `int()`           | `bigint`                                       | `min`, `max`, `nullable`             |
| `json()`          | Any (JSON serializable for use with `@attr()`) | `reviver`, `replacer`                |
| `list()`          | Array                                          | `separator`, `transform`             |
| `literal()`       | Any                                            | `values`, `transform`                |
| `any()`           | `any`                                          |                                      |
| `event()`         | `function | null`                              |                                      |

A transformers is just a bag of functions with the following type signature:

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
Very few transformers are limited to use with either decorator, such als
`event()` (which makes very little sense outside of content attributes).

The accessor's initial value serves as fallback value in case no other data is
available (eg. when a content attribute gets removed). Transformers validate
their initial value and most transformers contain reasonable default values
(`""` for `string()`, `0` for `number()` etc.).

#### For use with `@attr()`

A content attribute's IDL attribute value can be unset to the accessor's initial
value by removing a previously set the content attribute.

As an example:

```javascript
import { define, attr, string } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  @attr(string()) accessor foo = "default value";
  @attr(string()) accessor bar = "default value";
  @attr(string()) accessor baz;
}

document.body.innerHTML += `<my-test foo="other value"></my-test>`
```

The attributes `foo`, `bar` and `baz` behave as follows:

- The element initializes with a content attribute **`foo`** already set. The IDL attribute `foo` will therefore (because it uses the string type via the `string()` transformer) contain `"other value"`. Should the content attribute `foo` get removed, the IDL attribute will contain `"default value"`.
- The content attribute **`bar`** is not set, which will result in the IDL attribute `bar` containing the accessor's default value `"default value"`.
- The content attribute **`baz`** is also not set *and* the accessor has no initial value, so the `string()` transformer's built-in fallback value `""` gets used.

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

| Operation                        | IDL attribute value      | Content attribute (when used with `@attr()`) |
| ---------------------------------| -------------------------|----------------------------------------------|
| Set IDL attribute to `x`         | `String(x)`              | IDL attribute value                          |
| Set content attribute            | Content attribute value  | As set (equal to IDL attribute value)        |
| Remove content attribute         | Initial value or `""`    | Removed                                      |

### Transformer `href()`

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
testEl.foo = "asdf"
console.log(testEl.foo); // > "http://localhost/asdf"
testEl.foo = "https://example.com/foo/bar/"
console.log(testEl.foo); // > "https://example.com/foo/bar/"
```

#### Behavior overview for transformer `href()`

| Operation                                      | IDL attribute value         | Content attribute (when used with `@attr()`) |
| -----------------------------------------------| ----------------------------|----------------------------------------------|
| Set IDL attribute to absolute URL (string)     | Absolute URL                | IDL attribute value                          |
| Set IDL attribute to any other value `x`       | Relative URL to `String(x)` | IDL attribute value                          |
| Set content attribute to absolute URL (string) | Absolute URL                | As set                                       |
| Set content attribute to any other string `x`  | Relative URL to `x`         | As set                                       |
| Remove content attribute                       | Initial value or `""`       | Removed                                      |

### Transformer `number(options?)`

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
| --------------------------------------------| -------------------------------------------------------------|----------------------------------------------------------------------|
| Set IDL attribute to value `x`              | `minmax(opts.min, opts.max, toNumber(x, allowNaN))`          | String(IDL attribute value)                                          |
| Set IDL attribute to out-of-range value     | RangeError                                                   | String(IDL attribute value)                                          |
| Set IDL attribute to `null` or `undefined`  | `null` is `nullable` is true, otherwise `0`                  | Removed if `nullable` is true, otherwise String(IDL attribute value) |
| Set content attribute to value `x`          | `minmax(opts.min, opts.max, toNumber(x, allowNaN))`          | As set                                                               |
| Set content attribute to non-numeric value  | No change, or NaN if option `allowNaN` is `true`             | As set                                                               |
| Set content attribute to out-of-range value | No change                                                    | As set                                                               |
| Remove content attribute                    | `null` is `nullable` is true, otherwise initial value or `0` | Removed                                                              |

### Transformer `int(options?)`

Implements a bigint attribute. Content attribute values are expressed as plain
numeric strings without the tailing `n` used in JavaScript bigints.

```javascript
import { define, attr, int } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  // With default options (see below)
  @attr(int()) accessor foo = 0n;

 // With all options set
  @attr(int({ min: 0n, max: 10n })) accessor bar = 0n;
}
```

The transformer allows `null` and `undefined` (with the latter converting to
`null`) if the option `nullable` is set to `true`. In all other cases, the IDL#
attribute setter throws an exception when its input cannot be converted to
bigint.

#### Options for transformer `int()`

- **`min` (bigint, optional)**: Smallest possible value. Defaults to the minimum possible bigint value. Content attribute values less than `min` get clamped, IDL attribute values get validated and (if too small) rejected with an exception. Can be omitted or set to `null` or `undefined` to signify no minimum value.
- **`max` (bigint, optional)**: Largest possible value. Defaults to the maximum possible bigint value. Content attribute values greater than `max` get clamped, IDL attribute values get validated and (if too large) rejected with an exception. Can be omitted or set to `null` or `undefined` to signify no maximum value.
- **`nullable` (boolean, optional)**: Whether or not `null` and `undefined` (with the latter converting to `null`) are allowed. Defaults to `false`.

#### Behavior overview for transformer `int()`

| Operation                                  | IDL attribute value                                          | Content attribute (when used with `@attr()`)                         |
| -------------------------------------------| -------------------------------------------------------------|----------------------------------------------------------------------|
| Set IDL attribute to value `x`             | `minmax(ops.min, opts.max, BigInt(x))`                       | String(IDL attribute value)                                          |
| Set IDL attribute to out-of-range value    | RangeError                                                   | String(IDL attribute value)                                          |
| Set IDL attribute to `null` or `undefined` | `null` is `nullable` is true, otherwise `0n`                 | Removed if `nullable` is true, otherwise String(IDL attribute value) |
| Set IDL attribute to non-int value         | `BigInt(x)`                                                  | String(IDL attribute value)                                          |
| Set content attribute to value `x`         | `minmax(opts.min, opts.max, BigInt(x))`                      | As set                                                               |
| Set non-int content attribute              | Clamp to Int if float, otherwise no change                   | As set                                                               |
| Remove content attribute                   | `null` is `nullable` is true, otherwise initial value or `0` | Removed                                                              |

### Transformer `bool()`

Implements a boolean attribute. Modeled after built-in boolean attributes such
as `disabled`. Changes to the IDL attribute values *toggle* the content
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
| -------------------------------| --------------------|----------------------------------------------------------------------|
| Set IDL attribute to value `x` | `Boolean(x)`        | Removed when IDL attribute is `false`, otherwise set to empty string |
| Set content attribute to `x`   | `true`              | As set                                                               |
| Remove content attribute       | `false`             | Removed                                                              |

### Transformer `list(options?)`

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

- **`separator` (string, optional)**: Seperator string. Defaults to `","`
- **`transform` (Transformer)**: Transformer to use, eg. `string()` for a list of strings, `number()` for numbers etc.

#### Behavior overview for transformer `list()`

| Operation                | IDL attribute value                                                                                                         | Content attribute (when used with `@attr()`)         |
| -------------------------|-----------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------|
| Set IDL attribute        | Exception is not an array, otherwise array with content guarded by `options.transformer.validate`                           | IDL attribute values joined with `options.separator` |
| Set content attribute    | Attribute value is split on the separator, then trimmed, then non-empty strings are passed into `options.transformer.parse` | As set                                               |
| Remove content attribute | Initial value or empty array                                                                                                | Removed                                              |

### Transformer `literal(options?)`

Implements an attribute with a finite number of valid values. Should really be
called "enum", but that's a reserved word in JavaScript. It works by declaring
the valid list of values and a matching transformer. If, for example, the list
of valid values consists of strings, then the `string()` transformer is the
right transformer to use:

```javascript
import { define, attr, literal, string } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  @attr(literal({ values: ["A", "B"], transform: string() })) accessor foo = "A";
}
```

In this case, the content attribute can be set to any value (as is usual in
HTML), but if the content attribute gets set to a value other than `A` or `B`,
the IDL attribute's value will remain unchanged. Any attempt at setting the
IDL attribute to values other than `A` or `B` will result in an exception.

The default value is either the value the accessor was initialized with or, if
the accessor has no initial value, the first element in `values`.

#### Options for `literal(options?)`

- **`values` (array)**: List of valid values. Must contain at least one element.
- **`transform` (Transformer)**: Transformer to use, eg. `string()` for a list of strings, `number()` for numbers etc.

#### Behavior overview for transformer `literal()`

| Operation                      | IDL attribute value                                                                                      | Content attribute (when used with `@attr()`) |
| -------------------------------| ---------------------------------------------------------------------------------------------------------|----------------------------------------------|
| Set IDL attribute value to `x` | Exception if not in `options.values`, otherwise defined by `options.transformer.validate`                | Defined by `options.transformer.stringify`   |
| Set content attribute to `x`   | Parsed by `options.transformer.parse`. If the result is in `options.values`, result, otherwise no change | As set                                       |
| Remove attribute               | Initial value or first element in `options.values`                                                       | Removed                                      |

### Transformer `json()`

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

**Note for TypeScript:** Even though the transformer will accept literally any
JSON-serializable value at runtime, TS may infer a more restrictive type from
the accessor's initial values. Decorators can't currently change the type of
class members they are applied to, so you man need to provide a type annotation.

#### Options for `json(options?)`

- **`reviver` (function, optional)**: The `reviver` argument to use with `JSON.parse()`, if any. Only of use when used with `@attr()`
- **`replacer` (function, optional)**: The `replacer` argument to use with `JSON.stringify()`, if any. Only of use when used with `@attr()`

#### Behavior overview for transformer `json()` (when used with `@attr()`)

| Operation                      | IDL attribute value                                                    | Content attribute                                 |
| -------------------------------| -----------------------------------------------------------------------|---------------------------------------------------|
| Set IDL attribute value to `x` | `JSON.parse(JSON.stringify(x))`                                        | `JSON.stringify(idlValue, null, options.reviver)` |
| Set content attribute to `x`   | No change if invalid JSON, otherwise `JSON.parse(x, options.receiver)` | As set                                            |
| Remove content attribute       | Initial value or `undefined`                                           | Removed                                           |

#### Behavior overview for transformer `json()` (when used with `@prop()`)

| Operation                      | IDL attribute value | Content attribute |
| -------------------------------| --------------------|-------------------|
| Set IDL attribute value to `x` | `x`                 | -                 |

### Transformer `any()`

Implements a transformer that does no type checking at all and falls back to
the global `String` function for serializing to content attributes. Use this if
you really don't care about types:

```javascript
import { define, prop, any } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  @prop(any()) accessor whatever: any = 42;
}
```

Transformers returned from calling `any()` make for great prototypes for your
own custom transformer. Just note that transformers are bags of functions and
*not* classes, so you will need to use `Object.setPrototypeOf()` and friends to
"extend" transformers.

**Note for TypeScript:** Even though the transformer will accept literally any
value at runtime, TS may infer a more restrictive type from the accessor's
initial values. Decorators can't currently change the type of class members they
are applied to, so you man need to provide an `any` type annotation.

### Transformer `event()`

Implements old-school inline event handler attributes in the style of
`onclick="console.log(42)"`. To work properly, this should only be used in
conjunction with `@attr()` (with reflectivity enabled) and on an accessor that
has a name starting with `on`:

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
can be added to *any* element in order to facilitate event delegation. These
event handlers are considered global event handlers, and all custom inline event
handlers are obviously not global - they can only be used on the components that
explicitly implement them.

#### Behavior overview for transformer `event()`

The behavior of `event()` matches the behavior of built-in event handlers like
`onclick`.

## Event Bus

Ornament runs intra-component communication over an internal event bus. You will
almost certainly never need to access it directly, but there is is an API just
in case.

| Event              | Cause                                     | Event type                        | Payload (`args` property on the event object)                        |
| ------------------ | ------------------------------------------|---------------------------------- |----------------------------------------------------------------------|
| `init`             | Constructor ran to completion             | OrnamentEvent<"init">             | `[]`                                                                 |
| `connected`        | `connectedCallback()` fired               | OrnamentEvent<"connected">        | `[]`                                                                 |
| `disconnected`     | `disconnectedCallback()` fired            | OrnamentEvent<"disconnected">     | `[]`                                                                 |
| `adopted`          | `adoptedCallback()` fired                 | OrnamentEvent<"adopted">          | `[]`                                                                 |
| `prop`             | IDL attribute change (`@prop` or `@attr`) | OrnamentEvent<"prop">             | `[Name: string \| symbol, NewValue: any]`                            |
| `attr`             | Content attribute change (`@attr`)        | OrnamentEvent<"attr">             | `[Name: string, OldValue: string \| null, NewValue: string \| null]` |
| `formAssociated`   | `formAssociatedCallback()` fired          | OrnamentEvent<"formAssociated">   | `[Owner: HTMLFormElement \| null]                                    |
| `formReset`        | `formResetCallback()` fired               | OrnamentEvent<"formReset">        | `[]`                                                                 |
| `formDisabled`     | `formDisabledCallback()` fired            | OrnamentEvent<"formDisabled">     | `[Disabled: boolean]`                                                |
| `formStateRestore` | `formStateRestoreCallback()` fired        | OrnamentEvent<"formStateRestore"> | `[Reason: "autocomplete" \| "restore"]`                              |

**Note for TypeScript:** you can declare additions to the global interface
`OrnamentEventMap` to extend this list with your own events.

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
  const [ name, value ] = event.args;
  window.alert(`IDL attribute ${name} was changed to ${value}!`);
});
```

### class `OrnamentEvent<K extends keyof OrnamentEventMap>`

Event type used on the internal event bus. Only really useful if you want to
create your own events while using TypeScript.

## Symbols

### `NO_VALUE`

Transformers can return a special symbol to indicate that they were unable to
parse an input. This symbol is exported by Ornament as `NO_VALUE` or available
under the key `"ORNAMENT_NO_VALUE"` in the global symbol registry.

## Cookbook

### Debounced reactive

`@reactive()` causes its decorated method to get called for once for *every*
attribute and property change. This is sometimes useful, but sometimes you will
want to batch method calls for increased efficiency. This is easy if you combine
`@reactive()` with `@debounce()`:

```javascript
import { define, prop, reactive, debounce int } from "@sirpepe/ornament";

@define("my-test")
export class TestElement extends HTMLElement {
  @prop(int()) accessor value = 0;

  @reactive({ initial: false }) @debounce() #log() {
    console.log("Value is now", this.value);
  }
}

let el = new TestElement();
el.value = 1;
el.value = 2;
el.value = 2;

// Only logs "Value is now 3"
```

The order of the decorators im important here: `@reactive()` *must* be applied
to a method decorated with `@debounce()` for everything to work properly. The
initial method call of a `reactive()` method is not debounced and will keep
happening once the element's constructor runs to completion.
</details>

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

If you want to use [Preact](https://preactjs.com/) to render shadow DOM, it
makes sense of build root component with Preact and use Ornament ony as a
wrapper to provide attribute data as top-level props:

```javascript
import { define, reactive, attr, number } from "@sirpepe/ornament";
import { render, h, Fragment } from "preact";
import { useState } from "preact/hooks";

// Preact root component
function ShadowDom(props) {
  const [count, setCount] = useState(0);
  return (
    <button onClick={() => setCount(count + 1)}>
      Value {count ** props.exponent}
    </button>
  );
}

// Web component wrapper to translate attributes to props
@define("my-component")
export class MyComponent extends HTMLElement {
  #shadow = this.attachShadow({ mode: "open" });

  @attr(number()) accessor exponent = 1;

  @reactive()
  #reRender() {
    return render(<ShadowDom exponent={this.exponent} />, this.#shadow);
  }
}

```

### Read-only property

You can create a writable private accessor with `@prop()` and manually expose a
public getter. This keeps reactive functions working, but only allows readonly
access from outside the component:

```javascript
import { define, attr, reactive, string } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  @prop(string()) accessor #foo = "Starting value";

  // Provides readonly access to #foo
  get foo() {
    return this.#foo;
  }

  change() {
    this.#foo++;
  }

  // Reacts to changes to #foo, which can only be caused by calling the method
  // `change()`
  @reactive() log() {
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
    console.log("Custom logic!");
    return this.#secret; // accesses the getter decorated with @attr()
  }

  set foo(value) {
    console.log("Custom logic!");
    this.#secret = value; // accesses the setter decorated with @attr()
  }
}
```

Notes for `@attr()`:

1. The option `as` is *mandatory* when you use `@attr()` on a private or symbol accessor
1. Ornament throws exceptions if the class does not implement a public API for a content attribute defined with `@attr()` on a private or symbol accessor

### Event delegation

The following example captures all `input` events fired by
`<input type="number">` in the document:

```javascript
import { define, subscribe } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  @subscribe(
    document.documentElement,
    "input",
    {
      predicate: (evt) => evt.target.matches("input[type-number]")
    },
  )
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
  @subscribe(
    (instance) => this.root,
    "input",
    {
      predicate: (evt) => evt.target.matches("input[type-number]")
    },
  )
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
  subscribe(
    (instance) => this.root,
    eventName,
    {
      predicate: (evt) => evt.target.matches(selector)
    },
  );

@define("my-test")
class Test extends HTMLElement {
  root = this.attachShadow({ mode: "open" });

  @handle("input", "input[type-number]") // Much better!
  log(evt) {
    console.log(evt); // "input" events
  }
}
```

Note that the function that `@subscribe` takes to access event targets can *not*
access a classes private fields. The shadow root has to be publicly accessible
(unless you want to mess around with WeakMaps storing ShadowRoots indexed by
element instances or something similar).

Also note that not all events bubble, so you might want to use event capturing
instead:

```javascript
import { define, subscribe } from "@sirpepe/ornament";

// This can now handle all events from the shadow root
const capture = (eventName, selector) =>
  subscribe(
    (instance) => this.root,
    eventName,
    {
      predicate: (evt) => evt.target.matches(selector),
      capture: true,
    }
  );
```

Also also note that only composed events propagate through shadow boundaries,
which may become important if you want to nest components with shadow dom and
also want to use event delegation

### Custom defaults

If you don't like ornament's defaults, remember that decorators and transformers
are just functions. This means that you can use partial application to change
the default options:

```javascript
import { define, attr, reactive as baseReactive, string } from "@sirpepe/ornament";

// @reactive with "initial" always set to false
const reactive = baseReactive.bind(null, { initial: false });

@define("my-test")
class Test extends HTMLElement {
  @prop(string()) accessor foo = "A";

  @reactive() log() {
    console.log(this.foo);
  }
}

let test = new Test();
test.foo = "B"; //  only logs "B"
```

The same approach works when you want to create specialized decorators from
existing ones...

```javascript
import { define, subscribe } from "@sirpepe/ornament";

// A more convenient decorator for event delegation
function listen(event, selector = "*") {
  return subscribe(
    document.documentElement,
    "input",
    (evt) => evt.target.matches(selector)
  )
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

Also, remember that transformer functions return plain objects that you can
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

### Catching initial attribute reactions using the event bus

If you try to catch initial attribute updates in your element's constructor,
you will be disappointed:

```javascript
import { define, attr, string, listen } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  @attr(string()) accessor foo = "a";
  constructor() {
    super();
    // This looks like it should work, but the callback function will never fire
    listen(this, "prop", () => console.log(this.foo), { once: true });
  }
}
```

This happens because the *initial* attribute reactions are not actually
dispatched via the event bus. Reactive callbacks are instead listening for the
`init` event, which in turn is dispatched once the classes' constructors have
run to completion. This enables you to set up your elements state in the
constructor without worrying about causing reactive callbacks to run. The
downside is the minor inconsistency that not *all* attribute reactions can be
caught with the `prop` event. You can use the `init` event instead.
