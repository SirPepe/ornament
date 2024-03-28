# Changelog

## v 1.0.0

* **Breaking**: Methods decorated with `@reactive()` can no longer run on init.
  The `initial` option has been removed. Use `@init()` instead.
* **Feature**: new decorator `@init()` runs methods on instance initialization
  (that is, when the constructor has completed)
