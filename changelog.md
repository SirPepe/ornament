# Changelog

## v 1.2.0

* **Feature**: `@subscribe()` now lets you decide when/if a component should subscribe and unsubscribe from an event target or signal. It defaults to the internal `"init"` and `"connected"` events for subscribing and to `disconnected` for unsubscribing, but this can be changed in the options when calling `@subscribe()`.
* **Feature**: TypeScript can now verify whether methods that get subscribed to EventTargets via `@subscribe()` expect the right type of event. This only works if a mapping between event names and event object types for the event target exists (such as `HTMLElementEventMap`) and if that mapping, along with several more types, gets passed to `@subscribe()` as type parameters. This is by itself very inconvenient, but can be made bearable by building abstractions on top.
* **Docs**: Mention the fact that `@subscribe()` can listen to more than one event!
* **Other**: Bump dependencies.

## v 1.1.0

* **Feature**: `@subscribe()` can now also take promises for event targets and promise-returning factories as its first argument.
* **Bugfix**: Ensure that *all* methods decorated with `@init()` in *all* classes in an inheritance chain only fire when the *last* enhanced constructor finishes. Previously, methods decorated with `@init()` fired when their specific constructor finished, or not at all if the class was not decorated. This ensures a consistent behavior for more convoluted inheritance chains.
* **Other**: Bump dependencies, play some code golf, tweak error messages.

## v 1.0.0

* **Breaking**: Methods decorated with `@reactive()` can no longer run on init. The `initial` option has been removed. Use `@init()` instead.
* **Feature**: new decorator `@init()` runs methods and class field functions on instance initialization (that is, when the constructor has completed).
* **Feature**: decorators `@connected()`, `@disconnected()`, `@adopted()`, `@formAssociated()`, `@formReset()`, `@formDisabled()`, `@formStateRestore()`, `@subscribe()` and `@reactive()` now also work on class field functions.
* **Feature**: decorator `@debounce()` now also works on static methods and static class field functions.
* **Bugfix**: [@connected() on private methods throws when an already-connected component initializes.](https://github.com/SirPepe/ornament/issues/7)
