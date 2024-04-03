# Changelog

## v 1.0.0

* **Breaking**: Methods decorated with `@reactive()` can no longer run on init. The `initial` option has been removed. Use `@init()` instead.
* **Feature**: new decorator `@init()` runs methods and class field functions on instance initialization (that is, when the constructor has completed)
* **Feature**: decorators `@connected()`, `@disconnected()`, `@adopted()`, `@formAssociated()`, `@formReset()`, `@formDisabled()`, `@formStateRestore()` and `@reactive()` now also works on class field functions
* **Feature**: decorator `@debounce()` now also works on static methods and static class field functions
* **Bugfix**: [@connected() on private methods throws when an already-connected component initializes](https://github.com/SirPepe/ornament/issues/7)
