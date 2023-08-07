import {
  type ClassAccessorDecorator,
  type FunctionFieldOrMethodDecorator,
  type FunctionFieldOrMethodContext,
  type Method,
  type Transformer,
  assertContext,
} from "./types";

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
const OBSERVER_CALLBACKS = new WeakMap<HTMLElement, CallbackMap>();

// Callbacks to fire when connected or disconnected
const CONNECTED_CALLBACKS = new WeakMap<HTMLElement, (() => void)[]>();
const DISCONNECTED_CALLBACKS = new WeakMap<HTMLElement, (() => void)[]>();

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

// Reactivity notifications for @reactive
class ReactivityEvent extends Event {
  readonly key: string | symbol;
  constructor(key: string | symbol) {
    super("__ornament-reactivity");
    this.key = key;
  }
}

declare global {
  interface ElementEventMap {
    "__ornament-reactivity": ReactivityEvent;
  }
}

// The class decorator @define() defines a custom element and also injects a
// mixin class that hat deals with attribute observation and reactive
// init callback handling.
export function define<T extends CustomElementConstructor>(
  this: unknown,
  tagName: string
): (target: T, context: ClassDecoratorContext<T>) => T {
  return function (target: T, context: ClassDecoratorContext<T>): T {
    assertContext(context, "@define", "class");

    // Define the custom element after all other decorators have been applied
    context.addInitializer(function () {
      window.customElements.define(tagName, this);
    });

    // User-defined custom element behaviors that need to be integrated into the
    // mixin class.
    const originalObservedAttributes = (target as any).observedAttributes ?? [];
    const originalAttributeChangedCallback =
      target.prototype.attributeChangedCallback;
    const originalConnectedCallback = target.prototype.connectedCallback;
    const originalDisconnectedCallback = target.prototype.disconnectedCallback;
    const originalToStringTag = Object.getOwnPropertyDescriptor(
      target.prototype,
      Symbol.toStringTag
    );

    // Installs the mixin class. This kindof changes the type of the input
    // constructor T, but as TypeScript can currently not use class decorators
    // to change the type, we don't bother. The changes are really small, too.
    // See https://github.com/microsoft/TypeScript/issues/51347
    return class Mixin extends target {
      // Component set-up in the constructor (which here is the super
      // constructor) must not trigger reactive methods. Conversely, initial
      // calls to reactive methods must happen immediately after the (super-)
      // constructor's set-up is completed.
      constructor(...args: any[]) {
        super(...args);
        // Perform the initial calls to reactive methods for this instance. The
        // callbacks are bound methods, so there is no need to handle "this"
        for (const callback of REACTIVE_INIT_CALLBACKS.get(this) ?? []) {
          callback();
        }
        REACTIVE_INIT_CALLBACKS.delete(this);
        // Mark the end of the constructor and the initial reactive calls,
        // allow the element to receive reactivity events.
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
            (part) =>
              part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase()
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
        if (
          originalAttributeChangedCallback &&
          originalObservedAttributes.includes(name)
        ) {
          originalAttributeChangedCallback.call(this, name, oldVal, newVal);
        }
        const callbacks = OBSERVER_CALLBACKS.get(this);
        if (!callbacks) {
          return;
        }
        const callback = callbacks.get(name);
        if (!callback) {
          return;
        }
        callback.call(this, name, oldVal, newVal);
      }

      connectedCallback(): void {
        if (originalConnectedCallback) {
          originalConnectedCallback.call(this);
        }
        // The callbacks are bound methods, so there is no need to handle "this"
        for (const callback of CONNECTED_CALLBACKS.get(this) ?? []) {
          callback();
        }
      }

      disconnectedCallback(): void {
        if (originalDisconnectedCallback) {
          originalDisconnectedCallback.call(this);
        }
        // The callbacks are bound methods, so there is no need to handle "this"
        for (const callback of DISCONNECTED_CALLBACKS.get(this) ?? []) {
          callback();
        }
      }
    };
  };
}

type ReactiveOptions = {
  initial?: boolean;
  keys?: (string | symbol)[];
};

type ReactiveDecorator<T extends HTMLElement> = (
  value: () => any,
  context: ClassMethodDecoratorContext<T, () => any>
) => void;

export function reactive<T extends HTMLElement>(
  this: unknown,
  options: ReactiveOptions = {}
): ReactiveDecorator<T> {
  const initial = options.initial ?? true;
  return function (_, context): void {
    assertContext(context, "@reactive", "method", { private: true });
    context.addInitializer(function () {
      const value = context.access.get(this);
      // Register the callback that performs the initial method call
      if (initial) {
        const method = DEBOUNCED_METHOD_MAP.get(value) ?? value;
        const callbacks = REACTIVE_INIT_CALLBACKS.get(this);
        if (callbacks) {
          callbacks.push(method.bind(this));
        } else {
          REACTIVE_INIT_CALLBACKS.set(this, [method.bind(this)]);
        }
      }
      // Start listening for reactivity events that happen after reactive init
      this.addEventListener("__ornament-reactivity", (evt) => {
        if (
          REACTIVE_READY.has(this) &&
          (!options.keys || options.keys.includes(evt.key))
        ) {
          value.call(this);
        }
      });
    });
  };
}

type SubscriptionData = [EventTarget, string, (...args: any[]) => any];
const unsubscribeRegistry = new FinalizationRegistry<SubscriptionData>(
  ([target, event, callback]) => target.removeEventListener(event, callback)
);

type SubscribeDecorator<T, E extends Event> = (
  value: Method<T, [E]>,
  context: ClassMethodDecoratorContext<T>
) => void;

type LazyEventTarget<T extends EventTarget> = () => T;

export function subscribe<
  T extends HTMLElement,
  U extends EventTarget,
  E extends Event
>(
  this: unknown,
  target: U | LazyEventTarget<U>,
  event: string,
  predicate: (evt: E) => boolean = () => true
): SubscribeDecorator<T, E> {
  return function (_, context): void {
    assertContext(context, "@subscribe", "method", { private: true });
    context.addInitializer(function () {
      const value = context.access.get(this);
      const callback = (evt: any) => {
        if (predicate(evt)) {
          value.call(this, evt);
        }
      };
      if (typeof target === "function") {
        target = target();
      }
      unsubscribeRegistry.register(this, [target, event, callback]);
      target.addEventListener(event, callback);
    });
  };
}

export function connected<T extends HTMLElement>() {
  return function (
    _: Method<T, []>,
    context: ClassMethodDecoratorContext<T>
  ): void {
    assertContext(context, "@connected", "method", { private: true });
    context.addInitializer(function () {
      const value = context.access.get(this);
      const callbacks = CONNECTED_CALLBACKS.get(this);
      if (callbacks) {
        callbacks.push(value.bind(this));
      } else {
        CONNECTED_CALLBACKS.set(this, [value.bind(this)]);
      }
    });
  };
}

export function disconnected<T extends HTMLElement>() {
  return function (
    _: Method<T, []>,
    context: ClassMethodDecoratorContext<T>
  ): void {
    assertContext(context, "@disconnected", "method", { private: true });
    context.addInitializer(function () {
      const value = context.access.get(this);
      const callbacks = DISCONNECTED_CALLBACKS.get(this);
      if (callbacks) {
        callbacks.push(value.bind(this));
      } else {
        DISCONNECTED_CALLBACKS.set(this, [value.bind(this)]);
      }
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
  this: unknown,
  transformer: Transformer<T, V>,
  options: AttrOptions = {}
): ClassAccessorDecorator<T, V> {
  const getTransform = transformer.get ?? ((x: V) => x);
  const isReflectiveAttribute = options.reflective !== false;
  const updateAttrPredicate = transformer.updateAttrPredicate ?? (() => true);
  return function ({ get, set }, context): ClassAccessorDecoratorResult<T, V> {
    assertContext(context, "@attr", "accessor");

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
          oldAttrValue: string | null,
          newAttrValue: string | null
        ): void {
          if (name !== attrName || newAttrValue === oldAttrValue) {
            return; // skip irrelevant invocations
          }
          const oldValue = get.call(this);
          const newValue = transformer.parse.call(this, newAttrValue);
          if (transformer.eql.call(this, oldValue, newValue)) {
            return;
          }
          transformer.beforeSetCallback?.call(
            this,
            newValue,
            newAttrValue,
            context
          );
          set.call(this, newValue);
          this.dispatchEvent(new ReactivityEvent(context.name));
        };
        const instanceCallbacks = OBSERVER_CALLBACKS.get(this);
        if (instanceCallbacks) {
          instanceCallbacks.set(attrName, attributeChangedCallback);
        } else {
          OBSERVER_CALLBACKS.set(
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
        const oldValue = get.call(this);
        const newValue = transformer.validate.call(this, input);
        if (transformer.eql.call(this, oldValue, newValue)) {
          return;
        }
        transformer.beforeSetCallback?.call(this, newValue, input, context);
        set.call(this, newValue);
        if (isReflectiveAttribute) {
          const updateAttr = updateAttrPredicate.call(this, oldValue, newValue);
          if (updateAttr === null) {
            this.removeAttribute(attrName);
          } else if (updateAttr === true) {
            this.setAttribute(
              attrName,
              transformer.stringify.call(this, newValue)
            );
          }
        }
        this.dispatchEvent(new ReactivityEvent(context.name));
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
  this: unknown,
  transformer: Transformer<T, V>
): ClassAccessorDecorator<T, V> {
  const getTransform = transformer.get ?? ((x: V) => x);
  return function ({ get, set }, context): ClassAccessorDecoratorResult<T, V> {
    assertContext(context, "@prop", "accessor", { private: true });
    return {
      init(input) {
        transformer.beforeInitCallback?.call(this, input, input, context);
        return transformer.validate.call(this, input);
      },
      set(input) {
        const oldValue = get.call(this);
        const newValue = transformer.validate.call(this, input);
        if (transformer.eql.call(this, oldValue, newValue)) {
          return;
        }
        set.call(this, newValue);
        this.dispatchEvent(new ReactivityEvent(context.name));
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
  this: unknown,
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
    assertContext(context, "@debounce", ["field", "method"], {
      private: true,
      static: true,
    });
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
    }
    throw new TypeError(); // never happens
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
