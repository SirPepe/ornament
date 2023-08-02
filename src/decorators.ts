import type {
  ClassAccessorDecorator,
  FunctionFieldOrMethodDecorator,
  FunctionFieldOrMethodContext,
  Method,
  Transformer,
} from "./types";
import { tagNameFromConstructor } from "./lib";

// Accessor decorators initialize *after* custom elements access their
// observedAttributes getter, so there is no way to associate observed
// attributes with specific elements or constructors from inside the @attr()
// decorator. Instead we simply track *all* attributes defined by @attr() (on
// any class) and decide *inside the attribute changed callback* whether they
// are *actually* observed by a given element.
const ALL_OBSERVABLE_ATTRIBUTES = new Set<string>();

// Map of attribute to handling callbacks mapped by element. The mixin classes'
// actual attributeChangedCallback() to decide whether an attribute reaction
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

// A developer might want to initialize properties decorated with @prop() in
// their custom element constructors. This should NOT trigger reactivity events,
// as this is initialization and not a *change*. To make sure that reactivity
// events only happen once an element's constructor has run to completion, the
// following set tracks all elements where this has happened. Only elements in
// this set receive reactivity events.
const REACTIVE_READY = new WeakSet<HTMLElement>();

// Maps debounced methods to original methods. Needed for initial calls of
// @reactive() methods, which are not supposed to be async.
const DEBOUNCED_METHOD_MAP = new WeakMap<Method<any, any>, Method<any, any>>();

// Installs a mixin class that deals with attribute observation and reactive
// init callback handling. This obviously changes the type of the input
// constructor, but as TypeScript can currently not use class decorators to
// change the type, we don't bother.
function mixin<T extends CustomElementConstructor>(Target: T): T {
  const originalObservedAttributes = (Target as any).observedAttributes ?? [];
  const originalCallback = Target.prototype.attributeChangedCallback;
  const originalToStringTag = Object.getOwnPropertyDescriptor(
    Target.prototype,
    Symbol.toStringTag
  );

  return class Mixin extends Target {
    constructor(...args: any[]) {
      super(...args);
      // Call all init callbacks for this instance
      for (const callback of REACTIVE_INIT_CALLBACKS.get(this) ?? []) {
        callback.call(this);
      }
      REACTIVE_INIT_CALLBACKS.delete(this);
      // Mark the end of the constructor, allow the element to receive
      // reactivity events
      REACTIVE_READY.add(this);
    }

    // Automatic string tag, unless the base class provides an implementation
    get [Symbol.toStringTag](): string {
      if (originalToStringTag && originalToStringTag.get) {
        return originalToStringTag.get.call(this);
      }
      const stringTag = this.tagName
        .split("-")
        .map(
          (part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase()
        )
        .join("");
      return "HTML" + stringTag + "Element";
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

// The class decorator @define() defines a custom element. The tag name can
// either be automatically derived from the class name or overridden manually.
// The decorator also injects the mixin class. This obviously changes this
// instance type of the CustomElementConstructor T, but TS can't currently model
// this: https://github.com/microsoft/TypeScript/issues/51347
export function define<T extends CustomElementConstructor>(
  tagName?: string
): (target: T, context: ClassDecoratorContext<T>) => T {
  return function (target: T, context: ClassDecoratorContext<T>): T {
    if (context.kind !== "class") {
      throw new TypeError(`Class decorator @define() used on ${context.kind}`);
    }
    if (!tagName) {
      const fromConstructor = tagNameFromConstructor(target);
      if (!fromConstructor) {
        throw new Error(
          "Failed to derive custom element tag name from class name. Explicitly pass a tag name to @define() to fix this error"
        );
      }
      tagName = fromConstructor;
    }
    if (!/[a-z]+-[a-z]+/i.test(tagName)) {
      throw new Error(`Invalid custom element tag name "${tagName}"`);
    }
    context.addInitializer(function () {
      window.customElements.get(tagName as string) ??
        window.customElements.define(tagName as string, this);
    });
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
