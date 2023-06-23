import type { ClassAccessorDecorator, Transformer } from "./types";

// Accessor decorators initialize *after* custom elements access their
// observedAttributes getter, so there is no way to associate observed
// attributes with specific elements or constructors from inside the @attr()
// decorator. All we can do is to track *all* attributes defined by @attr() and
// decide in the attribute changed callback whether they are *actually* observed
// by a given element.
const ALL_OBSERVABLE_ATTRIBUTES = new Set<string>();

// Map of attribute to handling callbacks mapped by element. This can be used in
// the actual attributeChangedCallback to decide whether an attribute reaction
// must run an effect defined by @attr().
type AttributeChangedCallback = (
  name: string,
  oldValue: string | null,
  newValue: string | null
) => void;
type CallbackMap = Map<string, AttributeChangedCallback>;
const OBSERVER_CALLBACKS_BY_INSTANCE = new WeakMap<HTMLElement, CallbackMap>();

// The only way to get attribute observation working properly is unfortunately
// to patch some class prototypes. The logic below is run bei both @define() or
// @enhance() an replaces a CustomElementConstructor's static observedAttributes
// and the prototype method attributeChangedCallback() with custom logic that
// preserves any user-defined behavior, but also adds functionality to make
// attribute tracking via @attr() work.
function patchAttributeObservability(target: any): void {
  const originalObservedAttributes = target.observedAttributes ?? [];
  Object.defineProperty(target, "observedAttributes", {
    get(): string[] {
      const attributes = [
        ...originalObservedAttributes,
        ...ALL_OBSERVABLE_ATTRIBUTES,
      ];
      return attributes;
    },
  });
  const originalAttributeChangedCb = target.prototype.attributeChangedCallback;
  Object.defineProperty(target.prototype, "attributeChangedCallback", {
    value: function attributeChangedCallback(
      name: string,
      oldVal: string | null,
      newVal: string | null
    ): void {
      if (originalObservedAttributes.includes(name)) {
        originalAttributeChangedCb?.call?.(this, name, oldVal, newVal);
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
    },
  });
}

// All elements that use @reactive share an event bus to keep things simple.
const eventBus = new EventTarget();

// Reactivity notifications for @reactive
class ReactivityEvent extends Event {
  #source: HTMLElement;
  #key: string | symbol;

  constructor(source: HTMLElement, key: string | symbol) {
    super("reactivity");
    this.#source = source;
    this.#key = key;
  }

  get source(): HTMLElement {
    return this.#source;
  }

  get key(): string | symbol {
    return this.#key;
  }
}

const asap = (callback: (...args: any[]) => any): (() => void) => {
  let canceled = false;
  Promise.resolve().then(() => {
    if (!canceled) {
      callback();
    }
  });
  return () => {
    canceled = true;
  };
};

// The class decorator @define defines a custom element with a given tag name
// and also patches the base class to make attribute observation possible.
export function define<T extends CustomElementConstructor>(
  tagName: string
): (target: T, context: ClassDecoratorContext<T>) => void {
  if (!/[a-z]+-[a-z]+/i.test(tagName)) {
    throw new Error(`Invalid custom element tag name "${tagName}"`);
  }
  return function (target: T, context: ClassDecoratorContext<T>): void {
    if (context.kind !== "class") {
      throw new TypeError(`Class decorator @define() used on ${context.kind}`);
    }
    patchAttributeObservability(target);
    context.addInitializer(function () {
      window.customElements.get(tagName) ??
        window.customElements.define(tagName, this);
    });
  };
}

// Only patch the target class to enable attribute observation
export function enhance<T extends CustomElementConstructor>() {
  return function enhanceDecorator(
    target: T,
    context: ClassDecoratorContext<T>
  ): void {
    if (context.kind !== "class") {
      throw new TypeError(`Class decorator @enhance() used on ${context.kind}`);
    }
    patchAttributeObservability(target);
  };
}

// The method decorator @reactive() calls the method is was applied onto every
// time an attribute defined with @prop() or @attr() changes its value.
// @reactive() methods should also sometimes perform an initial run with the
// reactive property's default values. This can obviously only be done once
// the reactive attributes have initialized, but this is surprisingly hard to
// get working properly. The approach chosen is as follows: reactive properties
// announce their existence when their decorators initializers run by calling
// registerReactiveProperty(). The number of reactive properties on each
// element is stored in reactiveInitCountdowns. When a reactive property
// initializes, this number gets decremented until it reaches 0 when all
// properties have initialized. This initialization of the property's values
// happens *after* the decorators call the callbacks added by addInitializer().
// Unfortunately, property initialization only really finalizes after the init()
// method returned by the accessor decorators - at a point where a decorator
// can't really inject any logic. To summarize:
//
//   1. accessor decorator's initializer called
//   2. accessor decorator's return value's init() called
//   3. accessor value initialized
//   4. initial call of @reactive methods should happen here
//
// Properties register with step 1, the initial call of @reactive methods should
// happen in step 4, but there is no way to hook into that. We can only add code
// in init(), essentially between steps 1 and 2. The closest we can get to
// step 4 is to take the initial call of an @reactive method for a spin across
// the microtask queue using asap(). This works great unless something changes
// before the initial call comes back from the microtask queue, like in this
// case:
//
// @define("test-element")
// class TestElement extends HTMLElement {
//   @prop(string()) accessor x = "A";
//   @reactive() test() {
//     console.log(this.x);
//   }
// }
// const el = new TestElement();
// el.x = "B";
//
// "el" initializes with "A" on "x", then "x" gets set to "B" immediately.
// Nevertheless "A" (or, in the case of @attr, the initial attribute value) is
// the initial value of "x" and "@reactive test()" should be called at a time
// when "x" is still "A". But when "@reactive test()" comes back from the
// microtask queue, "x" is "B". To fix this, any use of the setter for a
// reactive property must cause the initial call of of any methods marked as
// @reactive, unless this initial call has already happened.

const reactiveInitCountdowns = new WeakMap<HTMLElement, number>();
const reactiveInitCallbacks = new WeakMap<HTMLElement, (() => void)[]>();
const cancelReactiveInitCallbacks = new WeakMap<HTMLElement, () => void>();

function registerReactiveProperty(instance: HTMLElement): void {
  let value = reactiveInitCountdowns.get(instance) ?? 0;
  value++;
  reactiveInitCountdowns.set(instance, value);
}

// used in accessor decorator's init() to schedule initial calls of reactive
// methods asap.
function initReactiveProperty(instance: HTMLElement): void {
  let value = reactiveInitCountdowns.get(instance);
  if (typeof value === "number") {
    value--;
    if (value > 0) {
      reactiveInitCountdowns.set(instance, value);
    } else {
      reactiveInitCountdowns.delete(instance);
      const callbacks = reactiveInitCallbacks.get(instance);
      if (callbacks) {
        const cancelInitCallbacks = asap(() => {
          reactiveInitCallbacks.delete(instance);
          cancelReactiveInitCallbacks.delete(instance);
          for (const callback of callbacks) {
            callback();
          }
        });
        cancelReactiveInitCallbacks.set(instance, cancelInitCallbacks);
      }
    }
  }
}

// used in accessor decorator's set()/get() to immediately cause initial calls
// of reactive methods unless this has already happened, and cancel any pending
// initial calls.
function callReactiveMethodsInitiallyUnlessAlreadyInitialized(
  instance: HTMLElement
): void {
  const cancelPending = cancelReactiveInitCallbacks.get(instance);
  cancelReactiveInitCallbacks.delete(instance);
  if (cancelPending) {
    cancelPending();
    const callbacks = reactiveInitCallbacks.get(instance);
    reactiveInitCallbacks.delete(instance);
    if (!callbacks) {
      throw new Error();
    }
    for (const callback of callbacks) {
      callback();
    }
  }
}

function registerReactivityInitialCallCallback(
  instance: HTMLElement,
  callback: () => void
): void {
  const callbacks = reactiveInitCallbacks.get(instance);
  if (callbacks) {
    callbacks.push(callback);
  } else {
    reactiveInitCallbacks.set(instance, [callback]);
  }
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

function getPredicate<T extends HTMLElement>(
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
  const predicate = getPredicate(options);
  return function (value, context): void {
    if (context.kind !== "method") {
      throw new TypeError(`Method decorator @reactive used on ${context.kind}`);
    }
    context.addInitializer(function () {
      // Call the reactive function once after everything else has initialized,
      // unless the options passed to the decorator say otherwise. Since
      // accessors initialize *after* this method decorator initializes, the
      // initial call needs to be delayed.
      if (initial) {
        // Initial calls of debounced methods must not be delayed
        const target = originalMethodMap.get(value) ?? value;
        registerReactivityInitialCallCallback(this, () => {
          predicate.call(this, "*") && target.call(this);
        });
      }
      // Start listening for subsequent reactivity events
      eventBus.addEventListener("reactivity", (evt: any) => {
        if (evt.source === this && predicate.call(this, evt.key)) {
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
  const parse = transformer.parse;
  const validate = transformer.validate ?? transformer.parse;
  const stringify = transformer.stringify ?? String;
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
          const value = parse.call(this, newValue);
          if (value === get.call(this)) {
            return; // skip if new parsed value is equal to the old parsed value
          }
          transformer.beforeSetCallback?.call(this, value, context);
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

    // Register as reactive, no matter is the attribute needs to be observed.
    context.addInitializer(function () {
      registerReactiveProperty(this);
    });

    return {
      init(input) {
        initReactiveProperty(this);
        const attrValue = this.getAttribute(attrName);
        if (attrValue !== null) {
          const value = parse.call(this, attrValue);
          transformer.beforeInitCallback?.call(this, value, input, context);
          return value;
        }
        const value = validate.call(this, input);
        transformer.beforeInitCallback?.call(this, value, input, context);
        return value;
      },
      set(input) {
        callReactiveMethodsInitiallyUnlessAlreadyInitialized(this);
        const newValue = validate.call(this, input);
        transformer.beforeSetCallback?.call(this, newValue, context);
        set.call(this, newValue);
        if (isReflectiveAttribute) {
          const shouldUpdateAttr = updateAttrPredicate.call(this, newValue);
          if (shouldUpdateAttr === null) {
            this.removeAttribute(attrName);
          } else if (shouldUpdateAttr === true) {
            this.setAttribute(attrName, stringify.call(this, newValue));
          }
        }
        eventBus.dispatchEvent(new ReactivityEvent(this, context.name));
      },
      get() {
        callReactiveMethodsInitiallyUnlessAlreadyInitialized(this);
        return get.call(this);
      },
    };
  };
}

// Accessor decorator @prop() returns a normal accessor, but with validation and
// reactivity added.

export function prop<T extends HTMLElement, V>(
  transformer: Transformer<T, V>
): ClassAccessorDecorator<T, V> {
  const validate = transformer.validate ?? transformer.parse;
  return function ({ get, set }, context): ClassAccessorDecoratorResult<T, V> {
    if (context.kind !== "accessor") {
      throw new TypeError(`Accessor decorator @prop used on ${context.kind}`);
    }

    // Register as reactive
    context.addInitializer(function () {
      registerReactiveProperty(this);
    });

    return {
      init(input) {
        initReactiveProperty(this);
        transformer.beforeInitCallback?.call(this, input, input, context);
        return validate.call(this, input);
      },
      set(input) {
        callReactiveMethodsInitiallyUnlessAlreadyInitialized(this);
        const newValue = validate.call(this, input);
        set.call(this, newValue);
        eventBus.dispatchEvent(new ReactivityEvent(this, context.name));
      },
      get() {
        callReactiveMethodsInitiallyUnlessAlreadyInitialized(this);
        return get.call(this);
      },
    };
  };
}

// Class field/method decorator @debounce() debounces functions.

type DebounceOptions = {
  fn?: (cb: () => void) => () => void;
};

const originalMethodMap = new WeakMap();

type Func<T, A extends unknown[]> = (this: T, ...args: A) => any;

type FieldOrMethodContext<T, A extends unknown[]> =
  | ClassMethodDecoratorContext<T, Func<T, A>>
  | ClassFieldDecoratorContext<T, Func<T, A>>;

function createDebouncedMethod<T, A extends unknown[]>(
  method: Func<T, A>,
  wait: (cb: () => void) => () => void
): Func<T, A> {
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
  originalMethodMap.set(debouncedMethod, method);
  return debouncedMethod;
}

export function debounce<T extends HTMLElement, A extends unknown[]>(
  options: DebounceOptions = {}
) {
  const fn = options.fn ?? debounce.raf();
  function decorator(
    value: Func<T, A>,
    ctx: ClassMethodDecoratorContext<T, Func<T, A>>
  ): Func<T, A>;
  function decorator(
    value: undefined,
    ctx: ClassFieldDecoratorContext<T, Func<unknown, A>>
  ): (init: Func<unknown, A>) => Func<unknown, A>;
  function decorator(
    value: Func<T, A> | undefined,
    ctx: FieldOrMethodContext<T, A>
  ): Func<T, A> | ((init: Func<unknown, A>) => Func<unknown, A>) {
    if (ctx.kind === "field") {
      // Field decorator (bound methods)
      return function init(func: Func<unknown, A>): Func<unknown, A> {
        if (typeof func !== "function") {
          throw new TypeError(
            "@debounce() can only be applied to function class fields"
          );
        }
        return createDebouncedMethod(func, fn);
      };
    } else {
      // Method decorator
      if (typeof value === "undefined") {
        throw new Error("This should never happen");
      }
      return createDebouncedMethod(value, fn);
    }
  }
  return decorator;
}

debounce.asap = function (): (cb: () => void) => () => void {
  return (cb: () => void): (() => void) => asap(cb);
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
