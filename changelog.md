# Changelog

## 3.0.0

### BREAKING: revamped function signatures for transforms and predicates in several options objects

Ornament has many APIs that take functions that either transform some value or
act as a predicate. The following example uses the `transform` option for the
`@subscribe()` decorator to extract information from an event:

```javascript
// Ornament 2.x
@define("my-element")
class MyElement extends HTMLElement {
  // Note: "evt" is the _second_ argument to "transform" ⮧
  @subscribe(document, "input", { transform: (instance, evt) => evt.target })
  lastInputUsed = null;
}
```

In Ornament 2.x, functions like this received _the component instance_ as their
first arguments and not the actual data that they are most likely concerned
with. Their `this` value, which one would _expect_ to be the component instance,
was `undefined`. This is not very ergonomic and runs counter to similar APIs in
almost all libraries and web standards. To remedy this, Ornament 3.x changes the
function signatures on the following APIs:

| API                                               | Before                                                                         | After                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `@reactive()`, option `predicate`                 | `(this: undefined, instance: T, key: string \| symbol, value: any) => boolean` | `(this: T, key: string \| symbol, value: any, instance: T) => boolean;` |
| `@subscribe()` to Signal, option `predicate`      | `(this: undefined, instance: T, value: V) => boolean`                          | `(this: T, value: V, instance: T) => boolean`                           |
| `@subscribe()` to Signal, option `transform`      | `(this: undefined, instance: T, value: V) => boolean`                          | `(this: T, value: V, instance: T) => boolean`                           |
| `@subscribe()` to EventTarget, option `predicate` | `(this: undefined, instance: T, event: Event) => boolean`                      | `(this: T, event: Event, instance: T) => boolean`                       |
| `@subscribe()` to EventTarget, option `transform` | `(this: undefined, instance: T, event: Event) => boolean`                      | `(this: T, event: Event, instance: T) => boolean`                       |
| `@state()`, option `toBoolean`                    | `(this: undefined, value: V, instance: T) => boolean`                          | `(this: T, value: V, instance: T) => boolean`                           |

## 2.2.2

### BUGFIX: fix `attachInternals()` breaking under convoluted circumstances

I certain convoluted, but not entirely impossible scenarios calling
`attachInternals()` could fail, complaining about
`TypeError: object is not the right class`. Ornament's `@enhance()` and
`@define()` inject a mixin class into component's class hierarchies which, among
other things, overrides [`attachInternals()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/attachInternals)
in a way that makes Ornament's `getInternals()` work while still keeping
`attachInternals()` single-use. This was tracked in a private field in Ornament
< 2.2.2., but private fields can fail when class hierarchies become too...
interesting. Specifically the following failed:

```javascript
function whatever() {
  return function (target) {
    @enhance()
    class Mixin extends target {}
    return Mixin;
  };
}

class Base extends HTMLElement {}

@whatever()
class Test extends Base {
  constructor() {
    super();
    this.attachInternals(); // <- Error
  }
}

window.customElements.define(generateTagName(), Test);
const testEl = new Test();
```

By swapping the private field for yet another symbol, this problem is avoided
in Ornament 2.2.2.

## 2.2.1

### BUGFIX: enable multiple bundles of Ornament to co-exist

By turning several symbols used in Ornament's plumbing into _registered_
symbols, use cases where multiple bundles of Ornament have to co-exist on one
page now work. The different bundles can not track each other's metadata,
events, component initialization status, and more - as long as they are roughly
compatible. This update contains no breaking changes and the bug it fixes is,
frankly, something that nobody should ever have noticed.

## 2.2.0

### FEATURE: new decorator `@state()`

`@state()` is a new accessor decorator that tracks the accessor's value in the element's [CustomStateSet](https://developer.mozilla.org/en-US/docs/Web/API/CustomStateSet):

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

`@state()` can be combined with `@prop()` and `@attr()`, but it does not have
to be.

### Feature: `getInternals(instance: HTMLElement): ElementInternals`

The utility function `getInternals()` provides easy access to a component's
[ElementInternals](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals).
In contrast to the regular `attachInternals()` method, `getInternals()` be as
often as required:

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

## 2.1.0

### FEATURE: Website

[Ornament now has a sort-of proper web page!](https://sirpepe.github.io/use-ornament/)
The page is generated straight from the readme file and does not add much.

### FEATURE: Customizable environment

Two functions have received backwards-compatible updates to make them work in
environments where the `window` object is not the global object. This is only
relevant if you run your component code in eg. Node.js with
[JSDOM](https://github.com/jsdom/jsdom) or similar to do SSR. The affected
functions are:

- **decorator `@define()`**: now takes an optional third argument to customize
  which `CustomElementRegistry` to use. Defaults to `window.customElements`.
- **transformer `href()`**: now takes an optional options object with a field
  `location` that can customize the `Location` object to use. Defaults to
  `window.location`.

This will be useful if you want to run your components outside of browsers and
of no concern if you don't.

### FEATURE: `predicate` option for `@observe()`

You can now control if an invocation of an observer callback should cause an
invocation of the decorated method or class field function:

```javascript
import { define, observe } from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  @observe(MutationObserver, {
    childList: true,
    // Only call the decorated method when the records contain removals
    predicate: (element, records, observer) => {
      const removals = records.filter((r) => r.removedNodes.length > 0);
      return removals.length > 0;
    },
  })
  reactToUpdate(records, observer) {
    console.log("Something happened!");
  }
}

const instance = new Test();
document.body.append(instance);

const el = document.createElement("div");
instance.append(el); // no nodes removed = no output

// Wait some time (mutation observers batch mutations)

el.remove(); // el removed = "Something happened!"
```

This makes it more feasible to combine `@observe()` with `@reactive()` on
methods that need to react to changes but that should not be overburdened with
figuring out whether or not the root cause is actually cause for a reaction.
This work belongs to the decorators, and has always been supported via a
predicate in the options for `@reactive()`. Now `@observe()` can do the same!

### FEATURE: Component metadata

Ornament, being a collection of decorators, now stores its metadata in
[Decorator Metadata](https://github.com/tc39/proposal-decorator-metadata). This
gets rid of a few janky workarounds and saves a few bytes in the process, but is
not really noticeable in and of itself. What is _actually_ new is an API to
access (some of) the available component metadata:

```javascript
import {
  define,
  attr,
  string,
  number,
  getTagName,
  listAttributes,
  getAttribute,
} from "@sirpepe/ornament";

@define("my-test")
class Test extends HTMLElement {
  @attr(string()) accessor foo = "";
  @attr(number({ min: 0 }), { as: "asdf" }) accessor bar = "";
}

console.log(getTagName(Test)); // > "my-test"

console.log(listAttributes(Test)); // > ["foo", "asdf"]

const { prop, transformer } = getAttribute(Test, "asdf");
// prop = "bar" = name of the public accessor for the content attribute "asdf"
// transformer = the transformer for the content attribute "asdf"

transformer.parse("-1");
// > 0; input clamped to valid value

transformer.validate(-1, true);
// Throws an error; the transformer only accepts nonnegative numbers
```

This should be useful if you need access to the parsing and stringification
logic for content attributes to do eg. SSR.

### Other changes in 2.1.0

Bump dependencies, play a little code golf, tweak and expand readme, run tests
against playwright's "webkit" browser too - for whatever that's worth.

## 2.0.0

### BREAKING: Event name mapping removed from `@subscribe()`

`@subscribe()` no longer has support for mapping an event to a specific matching event subtype (like `"click"` to `MouseEvent`). This feature was added in 1.2.0 and required supplying up to 5 type parameters, which was extremely clunky and it did not even work all that well. The core of the issue is that `@subscribe()` can subscribe to _any_ event target, and any event target can in principle dispatch _any_ event. The only way to truly solve this is to build abstractions for specific use cases:

```typescript
// Subscribes to DOM events in particular
const listen = <T extends HTMLElement, K extends keyof HTMLElementEventMap>(
  source: HTMLElement,
  ...eventNames: K[]
) =>
  subscribe<T, HTMLElement, HTMLElementEventMap[K]>(
    source,
    eventNames.join(" "),
  );
```

The decorator `listen()` can only handle event targets that are DOM elements, but can also better constrain its input.

### FEATURE: `transform` option for `@subscribe()`

The new `transform` option for `@subscribe()` enables methods to accept data that has been computed from an event object or signal value, rather than the event object or signal value itself:

```typescript
const counter = signal(0);

@define("test-element")
class Test extends HTMLElement {
  // Subscribes to the signal, transforms every new value into a String
  @subscribe(counter, { transform: (_, v) => String(v) })
  test(value: string) {
    console.log(value);
  }
}

const instance = new Test();
// > logs the string "0"
```

### FEATURE: `@subscribe()` now works for accessors

This essentially copies the last event or signal value straight into the class, triggering methods decorated with `@reactive()` in the process:

```typescript
const target = new EventTarget();

@define("test-element")
class Test extends HTMLElement {
  @subscribe(target, "foo") accessor test: Event | null = null;
  @reactive() react = () => console.log(this.test);
}

const instance = new Test();
const event = new Event("foo");
target.dispatchEvent(event);
// Logs the object "event"

instance.test === event; // > true
```

### Other changes in 2.0.0

[Fix support for line breaks as separators in event strings for `@subscribe()`](https://github.com/SirPepe/ornament/issues/9) and bump dependencies.

## v 1.3.0

### FEATURE: New decorator `@observe()`

Ever wanted to have an element observe itself? The new decorator `@observe()` registers a [MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver), [ResizeObserver](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver), or [IntersectionObserver](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API) to use the decorated method as its callback. It then starts to observe the element for whatever the observer observes (resizes, mutations etc.):

```typescript
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

Similar to `@subscribe` you can decide when/if observation should start and end in the options, which are also the options for the observers.

### Other changes in 1.3.0

Bump dependencies, re-organize tests, use an eslint/prettier setup that matches the current century, and add some more hype to the readme.

## v 1.2.0

### FEATURE: subscription management for `@subscribe`

`@subscribe()` now lets you decide when/if a component should subscribe and unsubscribe from an event target or signal. It defaults to the internal `"init"` and `"connected"` events for subscribing and to `disconnected` for unsubscribing, but this can be changed in the options when calling `@subscribe()`.

### FEATURE: better type safety for `@subscribe`

TypeScript can now verify whether methods that get subscribed to EventTargets via `@subscribe()` expect the right type of event. This only works if a mapping between event names and event object types for the event target exists (such as `HTMLElementEventMap`) and if that mapping, along with several more types, gets passed to `@subscribe()` as type parameters. This is by itself very inconvenient, but can be made bearable by building abstractions on top.

### Other changes in 1.2.0

Mention the fact that `@subscribe()` can listen to more than one event in the docs, and bump dependencies.

## v 1.1.0

### FEATURE: Promises as inputs to `@subscribe()`

`@subscribe()` can now also take promises for event targets and promise-returning factories as its first argument.

### FEATURE: a more reliable `@init()`

Ornament now ensures that _all_ methods decorated with `@init()` in _all_ classes in an inheritance chain only fire when the _last_ enhanced constructor finishes. Previously, methods decorated with `@init()` fired when their specific constructor finished, or not at all if the class was not decorated. This ensures a consistent behavior for more convoluted inheritance chains.

### Other changes in 1.1.0

Bump dependencies, play some code golf, and tweak error messages.

## v 1.0.0

### BREAKING: removed `initial` option for `@reactive()`

Methods decorated with `@reactive()` can no longer run on init. The `initial` option has been removed. Use `@init()` instead.

### FEATURE: new decorator `@init()`

The new decorator `@init()` runs methods and class field functions on instance initialization (that is, when the constructor has completed).

### FEATURE: more compatible decorators

The decorators `@connected()`, `@disconnected()`, `@adopted()`, `@formAssociated()`, `@formReset()`, `@formDisabled()`, `@formStateRestore()`, `@subscribe()` and `@reactive()` now also work on class field functions. The decorator `@debounce()` now also works on static methods and static class field functions.

### Other changes in 1.0.0

[Fix `@connected()` throwing on private methods when an already-connected component initializes.](https://github.com/SirPepe/ornament/issues/7)
