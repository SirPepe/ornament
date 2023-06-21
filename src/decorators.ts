import type { ClassAccessorDecorator, Transformer } from "./types";

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
// *once* and only *after* other decorators have been applied.
export function define<T extends CustomElementConstructor>(
  tagName: string
): (target: T, context: ClassDecoratorContext<T>) => void {
  if (!/[a-z]+-[a-z]+/i.test(tagName)) {
    throw new Error(`Invalid custom element tag name "${tagName}"`);
  }
  return function (_: T, context: ClassDecoratorContext<T>): void {
    if (context.kind !== "class") {
      throw new TypeError(`Class decorator @define used on ${context.kind}`);
    }
    context.addInitializer(function () {
      window.customElements.get(tagName) ??
        window.customElements.define(tagName, this);
    });
  };
}

// The method decorator @reactive calls the method is was applied onto every
// time a property defined with @prop or an attribute defined with @attr changes
// its value. @reactive methods should in many cases perform an initial run with
// the reactive property's default values. This can obviously only be done once
// the reactive properties have initialized, but this is surprisingly hard to
// get working properly. The approach chosen is as follows. Reactive properties
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
          for (const callback of callbacks) {
            callback();
          }
          reactiveInitCallbacks.delete(instance);
          cancelReactiveInitCallbacks.delete(instance);
        });
        cancelReactiveInitCallbacks.set(instance, cancelInitCallbacks);
      }
    }
  }
}

// used in accessor decorator's set() to schedule initial calls of reactive
// methods unless this has already happened, and cancel any pending initial
// calls.
function initReactivePropertyUnlessAlreadyInitialized(
  instance: HTMLElement
): void {
  const cancelPending = cancelReactiveInitCallbacks.get(instance);
  if (cancelPending) {
    cancelPending();
    const callbacks = reactiveInitCallbacks.get(instance);
    if (!callbacks) {
      throw new Error();
    }
    for (const callback of callbacks) {
      callback();
    }
    reactiveInitCallbacks.delete(instance);
    cancelReactiveInitCallbacks.delete(instance);
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

// Reactivity notifications for @reactive
class ReactivityEvent extends Event {
  #source: HTMLElement;
  #keys: Set<string | symbol>;

  constructor(source: HTMLElement, keys: Set<string | symbol>) {
    super("reactivity");
    this.#source = source;
    this.#keys = keys;
  }

  get source(): HTMLElement {
    return this.#source;
  }

  get keys(): Set<string | symbol> {
    return this.#keys;
  }
}

// All elements that use @reactive share an event bus to keep things simple.
const reactivityEventBus = new EventTarget();
let reactivityDispatchHandle: number | null = null;
const reactivityTargetsWithKeys = new Map<HTMLElement, Set<string | symbol>>();
function enqueueReactivityEvent(
  target: HTMLElement,
  key: string | symbol
): void {
  const keys = reactivityTargetsWithKeys.get(target);
  if (keys) {
    keys.add(key);
  } else {
    reactivityTargetsWithKeys.set(target, new Set([key]));
  }
  if (reactivityDispatchHandle === null) {
    reactivityDispatchHandle = requestAnimationFrame(() => {
      for (const targetAndKeys of reactivityTargetsWithKeys) {
        reactivityEventBus.dispatchEvent(new ReactivityEvent(...targetAndKeys));
      }
      reactivityDispatchHandle = null;
      reactivityTargetsWithKeys.clear();
    });
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
): (this: T, keys: Set<string | symbol> | "*") => boolean {
  const predicate = options.predicate ?? (() => true);
  const selectKeys = options.keys ?? [];
  if (selectKeys.length === 0) {
    return predicate;
  }
  return function reactivityPredicate(
    this: T,
    keys: Set<string | symbol> | "*"
  ): boolean {
    if (keys === "*") {
      return predicate.call(this);
    }
    return predicate.call(this) && selectKeys.some((key) => keys.has(key));
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
        registerReactivityInitialCallCallback(this, () => {
          predicate.call(this, "*") && value.call(this);
        });
      }
      // Start listening for subsequent reactivity events
      reactivityEventBus.addEventListener("reactivity", (evt: any) => {
        if (evt.source === this && predicate.call(this, evt.keys)) {
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

    // Accessor decorators can be applied to private fields, but DOM APIs must
    // be public.
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

    context.addInitializer(function () {
      registerReactiveProperty(this);
    });

    // The following initializer makes the property update when its attribute
    // changes, all made possible via via MutationObserver. Unfortunately this
    // makes the attribute reactions observably asynchronous (in contrast to
    // attributeChangedCallback(), which is usually not *observably*
    // asynchronous), but this is the only way to attach attribute reactivity in
    // a non-intrusive and simple way.
    if (isReflectiveAttribute) {
      context.addInitializer(function () {
        new MutationObserver((records) => {
          for (const record of records) {
            const newValue = this.getAttribute(attrName);
            if (newValue !== record.oldValue) {
              const value = parse.call(this, newValue);
              transformer.beforeSetCallback?.call(this, value, context);
              set.call(this, value);
              enqueueReactivityEvent(this, context.name);
            }
          }
        }).observe(this, {
          attributes: true,
          attributeOldValue: true,
          attributeFilter: [attrName],
        });
      });
    }

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
        initReactivePropertyUnlessAlreadyInitialized(this);
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
        enqueueReactivityEvent(this, context.name);
      },
      get() {
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
        initReactivePropertyUnlessAlreadyInitialized(this);
        const newValue = validate.call(this, input);
        set.call(this, newValue);
        enqueueReactivityEvent(this, context.name);
      },
      get() {
        return get.call(this);
      },
    };
  };
}

// Class field decorator @debounce() debounces functions.

/* eslint-disable */
type Debounceable<A extends unknown[]> = (...args: A[]) => void;
type DebounceDecoratorCtx<A extends unknown[]> = ClassFieldDecoratorContext<
  unknown,
  Debounceable<A>
>;
type DebounceDecoratorResult<A extends unknown[]> = (
  func: Debounceable<A>
) => Debounceable<A>;
/* eslint-enable */

export function debounce<A extends unknown[]>(
  time = 1000
): (_: unknown, ctx: DebounceDecoratorCtx<A>) => DebounceDecoratorResult<A> {
  return function debounceDecorator(value, ctx) {
    if (ctx.kind !== "field") {
      throw new TypeError("@debounce is a field decorator");
    }
    return function init(func: Debounceable<A>): Debounceable<A> {
      if (typeof func !== "function") {
        throw new TypeError("@debounce can only be applied to functions");
      }
      let handle: number | undefined = undefined;
      return function (...args: any[]): any {
        if (typeof handle !== "undefined") {
          window.clearTimeout(handle);
        }
        handle = window.setTimeout(() => {
          handle = undefined;
          func(...args);
        }, time);
      };
    };
  };
}
