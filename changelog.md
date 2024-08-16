# Changelog

## 2.1.0

### FEATURE: Decorator metadata

Ornament, being a collection of decorators, now stores its metadata in
[Decorator Metadata](https://github.com/tc39/proposal-decorator-metadata). To
avoid collisions with other libraries, the actual metadata is hidden behind a
symbol that is exported by Ornament as `METADATA` or available behind the key
`"ORNAMENT_METADATA"` in the global symbol registry. The contents of the
metadata record should not be considered part of Ornament's stable API and
could change at any moment. Use with caution!

### Other changes in 2.1.0

Bump dependencies, run tests against playwright's "webkit" browser too (for
whatever that's worth.)

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
