# Schleifchen 🎀

A set of decorators and associated functions to make building vanilla web
components a little less painful. Where you would previously have had to write
the following boilerplate monstrosity:

```javascript
// The following code is *required* to create a new element with a single string
// attribute that behaves like other string attributes on built-in elements (eg.
// the id attribute)

class GreeterElement extends HTMLElement {
  // Internal "name" state, initialized from the element's content attributes,
  // with a default value in case the content attribute is not set
  #name = this.getAttribute("name") || "";

  // DOM getter for the IDL property, required to make JS operations like
  // `console.log(el.name)` work
  get name() {
    return this.#name;
  }

  // DOM setter for the IDL property with type checking and/or conversion *and*
  // attribute updates, required to make JS operations like `el.name = "Alice"`
  // work
  set name(value) {
    value = String(value);
    this.#name = value;
    this.setAttribute("name", value);
  }

  // Attribute change handling, required to make JS operations like
  // `el.setAttribute("name", "Bob")` update the internal element state
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "name" && newValue !== this.#name) {
      this.#name = newValue;
    }
  }

  // Required for attribute change monitoring to work
  static get observedAttributes() {
    return ["name"];
  }
}

// Finally register the element, with an extra check to make sure that the
// tag name has not already been registered
if (!window.customElements.has("greeter-element")) {
  window.customElements.define("greeter-element", GreeterElement);
}
```

... you can now get away with just this:

```javascript
import { define, attr, string } from "@sirpepe/schleifchen"

// Register the element
@define("greeter-element")
class GreeterElement extends HTMLElement {
  // Define an accessor with an attribute decorator to get content attributes
  // handling as well as IDL getter and setter creation for (in this case)
  // arbitrary strings
  @attr(string()) accessor name = "Anonymous";
}
```

Schleifchen uses [the latest ECMAScript Decorators API](https://2ality.com/2022/10/javascript-decorators.html)
as supported by [@babel/plugin-proposal-decorators](https://babeljs.io/docs/babel-plugin-proposal-decorators)
(with option `version` set to `""2023-05""`) and
[TypeScript 5.0+](https://devblogs.microsoft.com/typescript/announcing-typescript-5-0/#decorators)
(with the option `experimentalDecorators` turned *off*).

## Scope

Schleifchen is decidedly not a framework and its scope is strictly limited to
only the most tedious bits of building standards-compliant web components:
attribute and property handling.

Attributes have two faces: the *content attribute* and the *IDL attribute*.
Content attributes are always strings and are defined either via HTML or via
JavaScript methods like `setAttribute()`. IDL attributes (aka JavaScript
properties) can be accessed via properties such as `someElement.foo` and may be
of any type. Both faces of attributes need to be implemented for it to be truly
compatible with any software out there - a JS frontend framework may work
primarily with IDL attributes, while HTML authors or server-side rendering
software will work with content attributes. Content and IDL attributes need to
be synchronized, which can entail any of the following tasks:

- Updating the content attribute when the IDL attribute gets changed (eg. update the HTML attribute `id` when running `element.id = "foo"` in JS)
- Updating the IDL attribute when the content attribute gets changed (eg. `element.id` should return `"bar"` after `element.setAttribute("id", "bar")`)
- Converting types while updating content and/or IDL attributes (an attribute may be a `number` as an IDL attribute, but content attributes are by definition always strings)
- Rejecting invalid types on the IDL setter (as opposed to converting types from content to IDL attributes which, like all of HTML, never throws an error)
- Connecting IDL and content attributes with different names (like how the content attribute `class` maps to the IDL attribute `className`)
- Fine-tuning the synchronization behavior depending on circumstances (see the interaction between the `value` content and IDL attributes on `<input>`)

This is all very annoying to write by hand, but because the above behavior is
more or less the same for all attributes, it is possible to to simplify the
syntax quite a bit:

```javascript
import { attr, number } from "@sirpepe/schleifchen"

class MyElement extends HTMLElement {
  @attr(number({ min: -100, max: 100 })) accessor value = 0;
}
```

The line starting with with `@attr` gets you a content and IDL attribute named
`value`, which...

- Always reflects a number between `-100` and `100`
- Initializes from the content attribute and falls back to the initializer value `0` if the attribute is missing
- Automatically updates the content attribute with the stringified value of the IDL attribute when the IDL attribute is updated
- Automatically updates the IDL attribute when the content attribute is updated (it parses the attribute value into a number and clamps it to the specified range)
- Implements getters and setters for the IDL attributes, with the getter always returning a number and the setter rejecting invalid values (non-numbers or numbers outside the specified range)
- Causes @reactive() class methods to run on update (see [@reactive()](#reactiveoptions))

Schleifchen's decorators are meant to be easy to add, easy to extend, but also
*very* easy to remove or replace with more complicated hand-written logic.
Schleifchen still wants you to have full control over your components' behavior,
just with less boilerplate. If you just want to turn off your brain, churn out
components and keep praying for continued support of third-party software, you
are better off with a true framework like [lit](https://lit.dev/).

## Notable deviations from standard behavior

Schleifchen's built-in transformers perform a little bit more opinionated
handholding that is usual for built-in elements. For example, the
[number transformer](#transformer-numberoptions) never returns NaN, but instead
falls back to the accessor's initial value if it encounters an invalid value. If
this bothers you, don't worry: building your own transformers is easy!

## Decorators

### `@define(tagName)`

Class decorator to register a class as a custom element. This also sets up
attribute observation for use with [@attr()](#attrtransformer-options);

```javascript
import { define } from "@sirpepe/schleifchen"

@define("test-element")
class Test extends HTMLElement {}
```

### `@enhance()`

Class decorator to sets up attribute observation for use with
[@attr()](#attrtransformer-options), but without also registering the class as
a custom element. Use this in place of [@define()](#definetagname) in case you
want to deal with the custom element registry yourself and only need to get
`@attr()` working.

```javascript
import { enhance } from "@sirpepe/schleifchen"

@enhance()
class Test extends HTMLElement {}

// manually register the element
window.customElements.define("test-element", Test);
```

### `@prop(transformer)`

The accessor decorator `@prop()` defines a IDL property on the custom element
class *without* an associated content attribute. Such a property is more or less
a regular accessor with two additional features:

- it uses [transformers](#transformers) for type checking and validation
- changes cause [@reactive()](#reactiveoptions) methods to run

Example:

```javascript
import { define, prop, number } from "@sirpepe/schleifchen"

@define("test-element")
class Test extends HTMLElement {
  // Applies the number transformer to ensure that foo is always a number
  @prop(number()) accessor foo = 23;

  // Automatically runs when "foo" (or any accessor decorated with @prop() or
  // @attr()) changes
  @reactive() log() {
    console.log(`Foo changed to ${this.foo}`);
  }
}

let testEl = document.createElement("test-element");
console.log(testEl.foo); // logs 23
testEl.foo = 42; // logs "Foo changed to 42"
console.log(testEl.foo); // logs 42
testEl.foo = "asdf"; // throw exception (thanks to the number transformer)
```

Accessors defined with `@prop()` wor as a JavaScript-only API. Values can only
be accessed through the accessor's getter, invalid values are rejected with
exceptions. `@prop()` can be used on private accessors.

Note that you can still define your own accessors, getters, setters etc. as you
would usually do. They will still work as expected, but they will not cause
`@reactive()` methods to run.

### `@attr(transformer, options?)`

The accessor decorator `@attr()` defines a IDL attribute with a matching content
attribute on the custom element class. This results in something very similar to
properties defined with `@prop()`, but with the following additional features:

- Its value can be initialized from a content attribute, if the attribute is present
- Changes to the content attribute's value update the value of the IDL attribute to match (depending on the options and the transformer)

```javascript
import { define, attr, number } from "@sirpepe/schleifchen"

@define("test-element")
class Test extends HTMLElement {
  // Applies the number transformer to ensure that content attribute values get
  // parsed into numbers and that new non-number values passed to the IDL
  // attribute's setter get rejected
  @attr(number()) accessor foo = 23;

  // Automatically runs when "foo" (or any accessor decorated with @prop() or
  // @attr()) changes
  @reactive() log() {
    console.log(`Foo changed to ${this.foo}`);
  }
}

document.body.innerHTML = `<test-element foo="42"></test-element>`;
let testEl = document.body.children[0];
console.log(testEl.foo); // logs 42 (initialized from the attribute)
testEl.foo = 1337; // logs "Foo changed to 1337"
console.log(testEl.foo); // logs 1337
console.log(testEl.getAttribute("foo")); // logs "1337"
testEl.foo = "asdf"; // throw exception (thanks to the number transformer)
```

Accessors defined with `@attr()` works like all other supported attributes on
built-in elements. Content attribute values (which are always strings) get
parsed by the transformer, which also deals with invalid values in a graceful
way (ie without throwing exceptions). Values can also be accessed through the
IDL property's accessor, where invalid values *are* rejected with exceptions.
`@attr()` can *not* be used on private accessors or symbols.

Note that you can still define your own attribute handling with
`attributeChangedCallback()` and `static get observedAttributes()` as you would
usually do. This will keep working work as expected, but changes to such
attributes will not cause `@reactive()` methods to run.

#### Options for `@attr()`

- **`as` (string, optional)**: Sets an attribute name different from the accessor's name, similar to how the `class` content attribute works for the `className` IDL attribute on built-in elements. If `as` is not set, the content attribute's name will be equal to the accessor's name.
- **`reflective` (boolean, optional)**: If `false`, prevents the content attribute from updating when the IDL attribute is updated, similar to how `value` works on `input` elements. Defaults to true.

### `@reactive(options?)`

Method decorator that causes class methods to re-run when any accessor decorated
with `@prop()` or `@attr()` changes:

```javascript
import { define, prop, number } from "@sirpepe/schleifchen"

@define("test-element")
class Test extends HTMLElement {
  @prop(number()) accessor foo = 0;
  @prop(number()) accessor bar = 0;

  @reactive({ initial: false }) log() {
    console.log(`foo is now ${this.foo}, bar is now ${this.bar}`);
  }
}

let testEl = document.createElement("test-element");
testEl.foo = 1;
testEl.bar = 2;

// first logs "foo is now 1, bar is now 0"
// then logs "foo is now 1, bar is now 2"
```

Unless the `initial` option is set to `false` the decorated method will run once
the element initializes. In many cases you may want to apply `@reactive()` to
methods decorated with [@debounce()](#reactiveoptions) to prevent excessive
calls.

#### Options for `@reactive()`

- **`initial` (boolean, optional)**: Whether or not to run the function when the element initializes, before any actual changes to any decorated accessor. Defaults to `true`
- **`keys` (Array\<string | symbol\>, optional)**: List of attributes to monitor. Defaults to monitoring all content and IDL attributes.
- **`predicate` ((this: T) => boolean, optional)**: The predicate function, if provided, gets called each time a reactive method is scheduled to run. If the predicate function returns `false`, the function does not run. The predicate function is called with `this` set to the element instance. By default all reactive methods are called for each change of attributes listed in `options.keys`.

### `@debounce(options?)`

Method and class field decorator for debouncing method/function invocation:

```javascript
class Test extends HTMLElement {
  @debounce() test(x) {
    console.log(x);
  }
}
const el = new Test();
el.test(1);
el.test(2);
el.test(3);

// only logs "3"
```

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
implement attribute and property handling. Their type signature is as follows:

```typescript
export type Transformer<T extends HTMLElement, V> = {
  // parse() turns attribute values (usually string | null) into property
  // values. Must *never* throw exceptions, but always deal with its input in a
  // graceful way, just like the attribute handling in built-in elements works.
  parse: (this: T, value: unknown) => V;
  // Validates setter inputs, which may be of absolutely any type. May throw for
  // invalid values, just like setters on built-in elements may.
  validate: (this: T, value: unknown) => V;
  // Turns property values into attributes values (strings), thereby controlling
  // the attribute representation of an accessor together with
  // updateAttrPredicate(). Must never throw.
  stringify: (this: T, value?: V | null) => string;
  // Decides if, based on a new value, an attribute gets updated to match the
  // new value (true/false) or removed (null). Defaults to a function that
  // always returns true.
  updateAttrPredicate?: (this: T, value: V) => boolean | null;
  // Runs before accessor initialization and can be used to perform side effects
  // or to grab the accessors initial value as defined in the class.
  beforeInitCallback?: (
    this: T,
    value: V,
    defaultValue: V,
    context: ClassAccessorDecoratorContext<T, V>
  ) => void;
  // Runs before an accessor's setter sets a new value and can be used to
  // perform side effects
  beforeSetCallback?: (
    this: T,
    value: V,
    context: ClassAccessorDecoratorContext<T, V>
  ) => void;
};
```

If you want to extend Schleifchen, you should simply clone one of the built-in
transformers and modify it to your liking!

### Transformer `string()`

Implements a string attribute or property. Loosely modeled after built-in string
attributes such as `id` and `lang`.

```javascript
import { define, attr, string } from "@sirpepe/schleifchen"

@define("test-element")
class Test extends HTMLElement {
  @attr(string()) accessor foo = "default value";
}
```

In this case, the property `foo` always represents a string. Any non-string
value gets converted to strings. When used with `@attr()`, if the content
attribute gets removed, the value that was used to initialize the accessor (in
this case `"default value"`) is returned. The same happens when the IDL
attribute is set to `undefined`. If the accessor was not initialized with a
value, the empty string is used.

### Transformer `href()`

Implements a string attribute or property that works like `href` on `a` in that
it automatically turns relative URLs into absolute URLs.

```javascript
import { define, attr, href } from "@sirpepe/schleifchen"

@define("test-element")
class Test extends HTMLElement {
  @attr(href()) accessor foo = "";
}

let testEl = new Test();

// Assuming that the page is served from localhost:
console.log(testEl.foo); // > "http://localhost"
testEl.foo = "asdf"
console.log(testEl.foo); // > "http://localhost/asdf"
testEl.foo = "https://example.com/foo/bar/"
console.log(testEl.foo); // > "https://example.com/foo/bar/"
```

### Transformer `number(options?)`

Implements a number attribute.

```javascript
import { define, attr, number } from "@sirpepe/schleifchen"

@define("test-element")
class Test extends HTMLElement {
  // With default options (see below)
  @attr(number()) accessor foo = 0;

 // With all options set
  @attr(number({ min: 0, max: 10 })) accessor bar = 0;
}
```

Non-numbers get converted to numbers, but never to `NaN` - the property setter
throws an exception when its input converts to `NaN`. When used with `@attr()`,
if the content attribute gets removed or set to some non-numeric value, the
value that was used to initialize the accessor (in this case `0`) is returned.
The same happens when the IDL attribute is set to `undefined`.

#### Options for `number()`

- **`min` (number, optional)**: Smallest possible value. Defaults to `-Infinity`. Content attribute values less than `min` get clamped, IDL attribute values get validated and (if too small) rejected with an exception.
- **`max` (number, optional)**: Largest possible value. Defaults to `Infinity`. Content attribute values greater than `max` get clamped, IDL attribute values get validated and (if too large) rejected with an exception.

### Transformer `int(options?)`

Implements a bigint attribute. Content attribute values are expressed as plain
numeric strings without the tailing `n` used in JavaScript bigints.

```javascript
import { define, attr, int } from "@sirpepe/schleifchen"

@define("test-element")
class Test extends HTMLElement {
  // With default options (see below)
  @attr(int()) accessor foo = 0n;

 // With all options set
  @attr(int({ min: 0n, max: 10n })) accessor bar = 0n;
}
```

The IDL attribute setter throws an exception when its input cannot be converted
to bigint. When used with `@attr()`, if the content attribute gets removed or
set to some non-integer value, the value that was used to initialize the
accessor (in the above examples `0n`) is returned. The same happens when the IDL
attribute is set to `undefined`.

#### Options for `int()`

- **`min` (bigint, optional)**: Smallest possible value. Defaults to the minimum possible bigint value. Content attribute values less than `min` get clamped, IDL attribute values get validated and (if too small) rejected with an exception.
- **`max` (bigint, optional)**: Largest possible value. Defaults to the maximum possible bigint value. Content attribute values greater than `max` get clamped, IDL attribute values get validated and (if too large) rejected with an exception.

### Transformer `boolean()`

Implements a boolean attribute. Modeled after built-in boolean attributes such
as `disabled`. Changes to the IDL attribute values toggle the content attribute
and do not just change the content attribute's value.

```javascript
import { define, attr, boolean } from "@sirpepe/schleifchen"

class DemoElement extends HTMLElement {
  @attr(boolean()) accessor foo = false;
}
```

In this case, the IDL attribute `foo` always represents a boolean. Any
non-boolean value gets coerced to booleans. If the content attribute `foo` gets
set to any value (including the empty string), `foo` returns `true` - only a
missing content attribute counts as `false`.

### Transformer `literal(options)`

Implements an attribute with a finite number of valid values. Should really be
called "enum", but that's a reserved word in JavaScript. It works by declaring
the valid list of values and a matching transformer. If, for example, the list
of valid values consists of strings, then the `string()` transformer is the
right transformer to use:

```javascript
import { define, attr, literal, string } from "@sirpepe/schleifchen";

@define("test-element")
class Test extends HTMLElement {
  @attr(literal({ values: ["A", "B"], transformer: string() })) accessor foo = "A";
}
```

In this case, the content attribute can be set to any value (as is usual in
HTML), but if the content attribute gets set to a value other than `A` or `B`,
the IDL attribute's value will remain unchanged. Any attempt at setting the
IDL attribute to values other than `A` or `B` will result in an exception.

The default value is either the value the accessor was initialized with or, if
the accessor has no initial value, the first element in `values`.

#### Options for `literal()`

- **`values` (array)**: List of valid values. Must contain at least one element.
- **`transformer` (Transformer)**: Transformer to use, eg. `string()` for a list of strings, `number()` for numbers etc.

### Transformer `record()`

Implements a plain object attribute that gets reflected as a JSON content
attribute when used with `@attr()`. Such attributes do not exist in standard
HTML, but may be useful nevertheless:

```javascript
import { define, attr, record } from "@sirpepe/schleifchen";

@define("test-element")
class Test extends HTMLElement {
  @attr(record()) accessor foo = { user: "", email: "" };
}
```

Content attribute values are parsed with `JSON.parse()`. Invalid JSON is
represented with the object used to initialize the accessor, or the empty object
if the accessor has no initial value. Using the IDL attribute's setter with
non-objects throws TypeErrors. Note that this transformer is really just a
wrapper around `JSON.parse()` and `JSON.stringify()` without any object
validation.

### Transformer `event()`

Implements old-school inline event handler attributes in the style of
`onclick="console.log(42)"`. To work properly, this should only be used in
conjunction with `@attr()` (with reflectivity enabled) and on an accessor that
has a name starting with `on`:

```javascript
import { define, attr, eventHandler } from "@sirpepe/schleifchen";

@define("test-element")
class Test extends HTMLElement {
  @attr(event()) accessor onfoo: ((evt: Event) => void) | null = null;
}
```

This can then be used in HTML:

```html
<test-element onfoo="console.log('Foo event:', event)"></test-element>
<script>
  document.querySelector("test-element").dispatchEvent(new Event("foo"));
  // Logs "'Foo event:', Event{type: "foo"}"
</script>
```

Or in JavaScript:

```javascript
const testEl = document.createElement("test-element");
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

## Cookbook

### Debounced reactive

`@reactive()` causes its decorated method to get called for once for *every*
attribute change. This is sometimes useful, but sometimes you will want to batch
method calls for increased efficiency. This is easy if you combine `@reactive()`
with `@debounce()`:

```javascript
import { define, prop, reactive, debounce int } from "@sirpepe/schleifchen";

@define("test-element")
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

The order of the decorators im important here: the method needs to be
`@reactive()` needs to be applied to a method decorated with `@debounce()` for
everything to work properly. The initial method call of a `reactive()` method is
not debounced.

### Rendering shadow DOM

Schleifchen does not directly concern itself with rendering Shadow DOM, but you
can combine Schleifchen with suitable libraries such as
[uhtml](https://github.com/WebReflection/uhtml):

```javascript
import { render, html } from "uhtml";
import { define, prop, reactive, debounce int } from "@sirpepe/schleifchen";

@define("counter-element")
export class CounterElement extends HTMLElement {
  @prop(int()) accessor value = 0;

  @reactive() @debounce() #render() {
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
accordingly - debounced with `@debounce()` for batched updated.

### Read-only property

You can create a writable private accessor with `@prop()` and manually expose a
public getter. This keeps reactive functions working, but only allows readonly
access from outside the component:

```javascript
import { define, attr, string } from "@sirpepe/schleifchen";

@define("test-element")
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
