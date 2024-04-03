# Changelog

## v 1.0.0

* **Breaking**: Methods decorated with `@reactive()` can no longer run on init. The `initial` option has been removed. Use `@init()` instead.
* **Feature**: new decorator `@init()` runs methods and class field functions on instance initialization (that is, when the constructor has completed)
* **Feature**: lifecycle decorators `@connected()`, `@disconnected()`, `@adopted()`, `@formAssociated()`, `@formReset()`, `@formDisabled()` and `@formStateRestore()` now also work on class field functions
* **Bigfix**: [@connected() on private methods throws when an already-connected component initializes](https://github.com/SirPepe/ornament/issues/7)
