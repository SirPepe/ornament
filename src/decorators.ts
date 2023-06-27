import type {
  ClassAccessorDecorator,
  FunctionFieldOrMethodDecorator,
  FunctionFieldOrMethodContext,
  Method,
  Transformer,
} from "./types";

// Accessor decorators initialize *after* custom elements access their
// observedAttributes getter, so there is no way to associate observed
// attributes with specific elements or constructors from inside the @attr()
// decorator. All we can do is to track *all* attributes defined by @attr() and
// decide in the attribute changed callback whether they are *actually* observed
// by a given element.
const ALL_OBSERVABLE_ATTRIBUTES = new Set<string>();

// Map of attribute to handling callbacks mapped by element. The mixin classes
// actual attributeChangedCallback to decide whether an attribute reaction
// must run an effect defined by @attr().
type AttributeChangedCallback = (
  name: string,
  oldValue: string | null,
  newValue: string | null
) => void;
type CallbackMap = Map<string, AttributeChangedCallback>; // attr name -> cb
const OBSERVER_CALLBACKS_BY_INSTANCE = new WeakMap<HTMLElement, CallbackMap>();

// Maps custom elements to a list of callbacks that trigger their @reactive()
// method's initial calls (for methods that need such a call)
const REACTIVE_INIT_CALLBACKS = new WeakMap<HTMLElement, (() => any)[]>();

// Set of instance that have had their reactivity initialize (by running their
// constructor to completion). Only elements in this set receive reactivity
// events. This enables setting properties in the constructor without triggering
// @reactive()
const REACTIVE_READY = new WeakSet<object>();

// Maps debounced methods to original methods. Needed for initial calls of
// @reactive() methods, which are not supposed to be async.
const DEBOUNCED_METHOD_MAP = new WeakMap<Method<any, any>, Method<any, any>>();

// Installs a mixin class that deals with attribute observation and reactive
// init callback handling.
function mixin<T extends CustomElementConstructor>(Ctor: T): T {
  const originalObservedAttributes = (Ctor as any).observedAttributes ?? [];
  const originalCallback = Ctor.prototype.attributeChangedCallback;

  return class SchleifchenMixin extends Ctor {
    constructor(...args: any[]) {
      super(...args);
      for (const callback of REACTIVE_INIT_CALLBACKS.get(this) ?? []) {
        callback.call(this);
      }
      REACTIVE_INIT_CALLBACKS.delete(this);
      REACTIVE_READY.add(this);
    }

    static get observedAttributes(): string[] {
      return [...originalObservedAttributes, ...ALL_OBSERVABLE_ATTRIBUTES];
    }

    attributeChangedCallback(
      this: HTMLElement,
      name: string,
      oldVal: string | null,
      newVal: string | null
    ): void {
      if (originalCallback && originalObservedAttributes.includes(name)) {
        originalCallback.call?.(this, name, oldVal, newVal);
      }
      const callbacks = OBSERVER_CALLBACKS_BY_INSTANCE.get(this);
      if (!callbacks) {
        return;
      }
      const callback = callbacks.get(name);
      if (!callback) {
        return;
      }
      callback.call(this, name, oldVal, newVal);
    }
  };
}

// All elements that use @reactive share an event bus to keep things simple.
const eventBus = new EventTarget();

// Reactivity notifications for @reactive
class ReactivityEvent extends Event {
  readonly source: HTMLElement;
  readonly key: string | symbol;
  constructor(source: HTMLElement, key: string | symbol) {
    super("reactivity");
    this.source = source;
    this.key = key;
  }
}

// The class decorator @define defines a custom element with a given tag name
// and also injects the mixin class. This obviously changes this instance type
// of the CustomElementConstructor T, but TS can't currently model this:
// https://github.com/microsoft/TypeScript/issues/51347
export function define<T extends CustomElementConstructor>(
  tagName: string
): (target: T, context: ClassDecoratorContext<T>) => T {
  if (!/[a-z]+-[a-z]+/i.test(tagName)) {
    throw new Error(`Invalid custom element tag name "${tagName}"`);
  }
  return function (target: T, context: ClassDecoratorContext<T>): T {
    if (context.kind !== "class") {
      throw new TypeError(`Class decorator @define() used on ${context.kind}`);
    }
    context.addInitializer(function () {
      window.customElements.get(tagName) ??
        window.customElements.define(tagName, this);
    });
    return mixin(target);
  };
}

// Only add the mixin class to enable attribute observation and setup
// reactivity initialization callbacks, without registering a tag name.
export function enhance<T extends CustomElementConstructor>(): (
  target: T,
  context: ClassDecoratorContext<T>
) => T {
  return function enhanceDecorator(
    target: T,
    context: ClassDecoratorContext<T>
  ): T {
    if (context.kind !== "class") {
      throw new TypeError(`Class decorator @enhance() used on ${context.kind}`);
    }
    return mixin(target);
  };
}

type ReactiveOptions<T extends HTMLElement> = {
  initial?: boolean;
  keys?: (string | symbol)[];
  predicate?: (this: T) => boolean;
};

type ReactiveDecorator<T extends HTMLElement> = (
  value: () => any,
  context: ClassMethodDecoratorContext<T, () => any>
) => void;

function createReactivePredicate<T extends HTMLElement>(
  options: ReactiveOptions<T> = {}
): (this: T, key: string | symbol) => boolean {
  const predicate = options.predicate ?? (() => true);
  const selectKeys = options.keys ?? [];
  if (selectKeys.length === 0) {
    return predicate;
  }
  return function reactivityPredicate(
    this: T,
    evtKey: string | symbol
  ): boolean {
    if (evtKey === "*") {
      return predicate.call(this);
    }
    return predicate.call(this) && selectKeys.some((key) => key === evtKey);
  };
}

export function reactive<T extends HTMLElement>(
  options: ReactiveOptions<T> = {}
): ReactiveDecorator<T> {
  const initial = options.initial ?? true;
  const predicate = createReactivePredicate(options);
  return function (value, context): void {
    if (context.kind !== "method") {
      throw new TypeError(
        `Method decorator @reactive() used on ${context.kind}`
      );
    }
    context.addInitializer(function () {
      // Register the callback that performs the initial method call
      if (initial) {
        const method = DEBOUNCED_METHOD_MAP.get(value) ?? value;
        const cb = () => {
          if (predicate.call(this, "*")) {
            method.call(this);
          }
        };
        const callbacks = REACTIVE_INIT_CALLBACKS.get(this);
        if (callbacks) {
          callbacks.push(cb);
        } else {
          REACTIVE_INIT_CALLBACKS.set(this, [cb]);
        }
      }
      // Start listening for reactivity events that happen after reactive init
      eventBus.addEventListener("reactivity", (evt: any) => {
        if (
          evt.source === this &&
          REACTIVE_READY.has(this) &&
          predicate.call(this, evt.key)
        ) {
          value.call(this);
        }
      });
    });
  };
}

// Accessor decorator @attr() defines a DOM attribute backed by an accessor.
// Because attributes are public by definition, it can't be applied to private
// accessors or symbol accessors.

type AttrOptions = {
  as?: string;
  reflective?: boolean; // defaults to true
};

export function attr<T extends HTMLElement, V>(
  transformer: Transformer<T, V>,
  options: AttrOptions = {}
): ClassAccessorDecorator<T, V> {
  const getTransform = transformer.get ?? ((x: V) => x);
  const isReflectiveAttribute = options.reflective !== false;
  const updateAttrPredicate = transformer.updateAttrPredicate ?? (() => true);
  return function ({ get, set }, context): ClassAccessorDecoratorResult<T, V> {
    if (context.kind !== "accessor") {
      throw new TypeError(`Accessor decorator @attr used on ${context.kind}`);
    }

    // Accessor decorators can be applied to private fields, but the APIs for
    // IDL attributes must be public.
    if (context.private) {
      throw new TypeError("Attributes defined by @attr must not be private");
    }

    // Accessor decorators can be applied to symbol accessors, but DOM attribute
    // names must be strings. As attributes always go along with public getters
    // and setters, the following check throws even if an alternative attribute
    // name was provided via the "as" option.
    if (typeof context.name === "symbol") {
      throw new TypeError("Attribute backends for @attr must not be symbols");
    }

    const attrName = options.as ?? context.name;

    // If the attribute needs to be observed, add the name to the set of all
    // observed attributes.
    if (isReflectiveAttribute) {
      ALL_OBSERVABLE_ATTRIBUTES.add(attrName);
    }

    // If the attribute needs to be observed and the accessor initializes,
    // register the attribute handler callback with the current element
    // instance - this initializer is earliest we have access to the instance.
    if (isReflectiveAttribute) {
      context.addInitializer(function () {
        const attributeChangedCallback = function (
          this: T,
          name: string,
          oldValue: string | null,
          newValue: string | null
        ): void {
          if (name !== attrName || newValue === oldValue) {
            return; // skip irrelevant invocations
          }
          const value = transformer.parse.call(this, newValue);
          if (value === get.call(this)) {
            return; // skip if new parsed value is equal to the old parsed value
          }
          transformer.beforeSetCallback?.call(this, value, newValue, context);
          set.call(this, value);
          eventBus.dispatchEvent(new ReactivityEvent(this, context.name));
        };
        const instanceCallbacks = OBSERVER_CALLBACKS_BY_INSTANCE.get(this);
        if (instanceCallbacks) {
          instanceCallbacks.set(attrName, attributeChangedCallback);
        } else {
          OBSERVER_CALLBACKS_BY_INSTANCE.set(
            this,
            new Map([[attrName, attributeChangedCallback]])
          );
        }
      });
    }

    return {
      init(input) {
        const attrValue = this.getAttribute(attrName);
        if (attrValue !== null) {
          const value = transformer.parse.call(this, attrValue);
          transformer.beforeInitCallback?.call(this, value, input, context);
          return value;
        }
        const value = transformer.validate.call(this, input);
        transformer.beforeInitCallback?.call(this, value, input, context);
        return value;
      },
      set(input) {
        const newValue = transformer.validate.call(this, input);
        transformer.beforeSetCallback?.call(this, newValue, input, context);
        set.call(this, newValue);
        if (isReflectiveAttribute) {
          const shouldUpdateAttr = updateAttrPredicate.call(this, newValue);
          if (shouldUpdateAttr === null) {
            this.removeAttribute(attrName);
          } else if (shouldUpdateAttr === true) {
            this.setAttribute(
              attrName,
              transformer.stringify.call(this, newValue)
            );
          }
        }
        eventBus.dispatchEvent(new ReactivityEvent(this, context.name));
      },
      get() {
        return getTransform.call(this, get.call(this));
      },
    };
  };
}

// Accessor decorator @prop() returns a normal accessor, but with validation and
// reactivity added.

export function prop<T extends HTMLElement, V>(
  transformer: Transformer<T, V>
): ClassAccessorDecorator<T, V> {
  const getTransform = transformer.get ?? ((x: V) => x);
  return function ({ get, set }, context): ClassAccessorDecoratorResult<T, V> {
    if (context.kind !== "accessor") {
      throw new TypeError(`Accessor decorator @prop used on ${context.kind}`);
    }
    return {
      init(input) {
        transformer.beforeInitCallback?.call(this, input, input, context);
        return transformer.validate.call(this, input);
      },
      set(input) {
        const newValue = transformer.validate.call(this, input);
        set.call(this, newValue);
        eventBus.dispatchEvent(new ReactivityEvent(this, context.name));
      },
      get() {
        return getTransform.call(this, get.call(this));
      },
    };
  };
}

// Class field/method decorator @debounce() debounces functions.

type DebounceOptions = {
  fn?: (cb: () => void) => () => void;
};

function createDebouncedMethod<T, A extends unknown[]>(
  method: Method<T, A>,
  wait: (cb: () => void) => () => void
): Method<T, A> {
  let cancelWait: null | (() => void) = null;
  function debouncedMethod(this: T, ...args: A): any {
    if (cancelWait) {
      cancelWait();
    }
    cancelWait = wait(() => {
      method.call(this, ...args);
      cancelWait = null;
    });
  }
  DEBOUNCED_METHOD_MAP.set(debouncedMethod, method);
  return debouncedMethod;
}

export function debounce<T extends HTMLElement, A extends unknown[]>(
  options: DebounceOptions = {}
): FunctionFieldOrMethodDecorator<T, A> {
  const fn = options.fn ?? debounce.raf();
  function decorator(
    value: Method<T, A>,
    context: ClassMethodDecoratorContext<T, Method<T, A>>
  ): Method<T, A>;
  function decorator(
    value: undefined,
    context: ClassFieldDecoratorContext<T, Method<unknown, A>>
  ): (init: Method<unknown, A>) => Method<unknown, A>;
  function decorator(
    value: Method<T, A> | undefined,
    context: FunctionFieldOrMethodContext<T, A>
  ): Method<T, A> | ((init: Method<unknown, A>) => Method<unknown, A>) {
    if (context.kind === "field") {
      // Field decorator (bound methods)
      return function init(func: Method<unknown, A>): Method<unknown, A> {
        if (typeof func !== "function") {
          throw new TypeError(
            "@debounce() can only be applied to function class fields"
          );
        }
        return createDebouncedMethod(func, fn);
      };
    } else if (context.kind === "method") {
      // Method decorator
      if (typeof value === "undefined") {
        throw new Error("This should never happen");
      }
      return createDebouncedMethod(value, fn);
    } else {
      throw new TypeError(
        `Method/class field decorator @debounce() used on ${
          (context as any).kind
        }`
      );
    }
  }
  return decorator;
}

debounce.asap = function (): (cb: () => void) => () => void {
  return function (cb: () => void): () => void {
    let canceled = false;
    Promise.resolve().then(() => {
      if (!canceled) {
        cb();
      }
    });
    return () => {
      canceled = true;
    };
  };
};

debounce.raf = function (): (cb: () => void) => () => void {
  return function (cb: () => void): () => void {
    const handle = requestAnimationFrame(cb);
    return (): void => cancelAnimationFrame(handle);
  };
};

debounce.timeout = function (value: number): (cb: () => void) => () => void {
  return function (cb: () => void): () => void {
    const timerId = setTimeout(cb, value);
    return (): void => clearTimeout(timerId);
  };
};
