// In some bundler happens to include Ornament more than once, we need to make
// sure that the metadata stores are globally unique.

import { EMPTY_OBJ } from "./lib.js";
import type { Method } from "./types.js";

export const METADATA_KEY: unique symbol = Symbol.for("ORNAMENT_METADATA");

type OrnamentMetadata = {
  // Associate event targets that the message bus uses with elements.
  targetMap: WeakMap<HTMLElement, EventTarget>;
  // Accessor decorators initialize *after* custom elements access their
  // observedAttributes getter. This means that, in the absence of the
  // decorators metadata feature, there is no way to associate observed
  // attributes with specific elements or constructors from inside the @attr()
  // decorator. Instead we simply track *all* attributes defined by @attr() on
  // any class and decide inside the attribute changed callback* whether they
  // are actually observed by a given element.
  observableAttributes: Set<string>;
  // Maps debounced methods to original methods. Needed for initial calls of
  // @reactive() methods, which are not supposed to be async.
  debouncedMethods: WeakMap<Method<any, any>, Method<any, any>>;
  // Unsubscribe from event targets or symbols when a method that @subscribe was
  // applied to gets GC's
  unsubscribeRegistry: FinalizationRegistry<() => void>;
};

declare global {
  interface Window {
    [METADATA_KEY]: OrnamentMetadata;
  }
}

if (!window[METADATA_KEY]) {
  window[METADATA_KEY] = EMPTY_OBJ as any;
}

window[METADATA_KEY].targetMap ||= new WeakMap<HTMLElement, EventTarget>();
window[METADATA_KEY].observableAttributes ||= new Set();
window[METADATA_KEY].debouncedMethods ||= new WeakMap();
window[METADATA_KEY].unsubscribeRegistry ||= new FinalizationRegistry((f) =>
  f(),
);
