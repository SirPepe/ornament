import { Nil } from "./lib.js";
import {
  type ClassAccessorDecorator,
  type FunctionFieldOrMethodDecorator,
  type FunctionFieldOrMethodContext,
  type Method,
  type Transformer,
  assertContext,
} from "./types.js";

const eventName = "_o-react";

const identity = <T>(x: T) => x;

function withDefaults<T extends HTMLElement, V>(
  source: Transformer<T, V>,
): Required<Transformer<T, V>> {
  return {
    ...source,
    stringify: source.stringify ?? String,
    eql: source.eql ?? ((a: any, b: any) => a === b),
    init: source.init ?? identity,
    get: source.get ?? identity,
    set: source.set ?? identity,
    updateContentAttr: source.updateContentAttr ?? (() => true),
  };
}

// Accessor decorators initialize *after* custom elements access their
// observedAttributes getter. This means that, in the absence of the decorators
// metadata feature, there is no way to associate observed attributes with
// specific elements or constructors from inside the @attr() decorator. Instead
// we simply track *all* attributes defined by @attr() *on any class* and decide
// *inside the attribute changed callback* whether they are *actually* observed
// by a given element.
const ALL_OBSERVABLE_ATTRIBUTES = new Set<string>();

// The following callback wrangling code fills the hole left by the
// non-existence of decorator metadata as of Q3 2023.
type Callbacks = Record<string | symbol, () => void>;
const callbackSources = {
  connect: new WeakMap<CustomElementConstructor, Callbacks>(),
  disconnect: new WeakMap<CustomElementConstructor, Callbacks>(),
  init: new WeakMap<CustomElementConstructor, Callbacks>(),
};

function setCallback(
  instance: any,
  on: keyof typeof callbackSources,
  name: string | symbol,
  callback: () => void,
): void {
  const source = callbackSources[on];
  const callbacks = source.get(instance.constructor);
  if (!callbacks) {
    source.set(instance.constructor, { [name]: callback });
    return;
  }
  if (!callbacks[name]) {
    callbacks[name] = callback;
  }
}

function getCallbacks(
  instance: any,
  on: keyof typeof callbackSources,
): (() => void)[] {
  const callbacks = callbackSources[on].get(instance.constructor);
  return Object.values(callbacks ?? []);
}

// Maps attributes to attribute observer callbacks mapped by custom element
// constructor. The mixin classes' actual `attributeChangedCallback()` decides
// whether an attribute reaction must run an effect defined by @attr().
type ObserverCallback = (
  name: string,
  oldValue: string | null,
  newValue: string | null,
) => void;
type ObserverMap = Record<string, ObserverCallback>; // attr name -> cb
const observerCallbacks = new WeakMap<CustomElementConstructor, ObserverMap>();

function setObserver(
  instance: any,
  attribute: string,
  callback: ObserverCallback,
): void {
  const callbacks = observerCallbacks.get(instance.constructor);
  if (!callbacks) {
    observerCallbacks.set(instance.constructor, { [attribute]: callback });
    return;
  }
  if (!callbacks[attribute]) {
    callbacks[attribute] = callback;
  }
}

function getObservers(instance: any): Record<string, ObserverCallback> {
  return observerCallbacks.get(instance.constructor) ?? {};
}

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
    super(eventName);
    this.key = key;
  }
}

declare global {
  interface ElementEventMap {
    "_o-react": ReactivityEvent;
  }
}

// The class decorator @define() defines a custom element and also injects a
// mixin class that hat deals with attribute observation and reactive
// init callback handling.
export function define<T extends CustomElementConstructor>(
  this: unknown,
  tagName: string,
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
      Symbol.toStringTag,
    );

    // Installs the mixin class. This kindof changes the type of the input
    // constructor T, but as TypeScript can currently not use class decorators
    // to change the type, we don't bother. The changes are really small, too.
    // See https://github.com/microsoft/TypeScript/issues/51347
    return class extends target {
      // Component set-up in the constructor (which here is the super
      // constructor) must not trigger reactive methods. Conversely, initial
      // calls to reactive methods must happen immediately after the (super-)
      // constructor's set-up is completed.
      constructor(...args: any[]) {
        super(...args);
        // Perform the initial calls to reactive methods for this instance. The
        // callbacks are bound methods, so there is no need to handle "this"
        for (const callback of getCallbacks(this, "init")) {
          callback();
        }
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
            (str) => str.slice(0, 1).toUpperCase() + str.slice(1).toLowerCase(),
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
        newVal: string | null,
      ): void {
        if (
          originalAttributeChangedCallback &&
          originalObservedAttributes.includes(name)
        ) {
          originalAttributeChangedCallback.call(this, name, oldVal, newVal);
        }
        const callback = getObservers(this)[name];
        if (callback) {
          callback.call(this, name, oldVal, newVal);
        }
      }

      connectedCallback(): void {
        if (originalConnectedCallback) {
          originalConnectedCallback.call(this);
        }
        for (const callback of getCallbacks(this, "connect")) {
          callback();
        }
      }

      disconnectedCallback(): void {
        if (originalDisconnectedCallback) {
          originalDisconnectedCallback.call(this);
        }
        for (const callback of getCallbacks(this, "disconnect")) {
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
  context: ClassMethodDecoratorContext<T, () => any>,
) => void;

export function reactive<T extends HTMLElement>(
  this: unknown,
  options: ReactiveOptions = {},
): ReactiveDecorator<T> {
  const initial = options.initial ?? true;
  return function (_, context): void {
    assertContext(context, "@reactive", "method", { private: true });
    context.addInitializer(function () {
      const value = context.access.get(this);
      // Register the callback that performs the initial method call
      if (initial) {
        const method = DEBOUNCED_METHOD_MAP.get(value) ?? value;
        setCallback(this, "init", context.name, method.bind(this));
      }
      // Start listening for reactivity events that happen after reactive init
      this.addEventListener(eventName, (evt) => {
        if (
          REACTIVE_READY.has(this) &&
          (!options.keys || options.keys?.includes(evt.key))
        ) {
          value.call(this);
        }
      });
    });
  };
}

const unsubscribeRegistry = new FinalizationRegistry<() => void>(
  (unsubscribe) => unsubscribe(),
);

type SubscribePredicate<T, V> = (this: T, value: V) => boolean;

type EventSubscribeDecorator<T, E extends Event> = (
  value: Method<T, [E]>,
  context: ClassMethodDecoratorContext<T>,
) => void;

type LazyEventTarget<T, E extends EventTarget = EventTarget> = (this: T) => E;

function createEventSubscriberInitializer<T extends object, E extends Event>(
  context: ClassMethodDecoratorContext<T>,
  target: EventTarget | LazyEventTarget<T>,
  eventName: string,
  predicate: SubscribePredicate<T, E> = () => true,
): (this: T) => void {
  return function (this: T) {
    setCallback(this, "init", context.name, () => {
      const value = context.access.get(this);
      const callback = (evt: any) => {
        if (predicate.call(this, evt)) {
          value.call(this, evt);
        }
      };
      if (typeof target === "function") {
        target = target.call(this);
      }
      const unsubscribe = () =>
        (target as EventTarget).removeEventListener(eventName, callback);
      unsubscribeRegistry.register(this, unsubscribe);
      target.addEventListener(eventName, callback);
    });
  };
}

type SignalSubscribeDecorator<T> = (
  value: Method<T, []>,
  context: ClassMethodDecoratorContext<T>,
) => void;

type SignalLike<T> = {
  subscribe(callback: () => void): () => void;
  value: T;
};

type SignalType<T> = T extends SignalLike<infer V> ? V : any;

function isSignalLike(value: unknown): value is SignalLike<any> {
  if (
    value &&
    typeof value === "object" &&
    "subscribe" in value &&
    typeof value.subscribe === "function"
  ) {
    return true;
  }
  return false;
}

function createSignalSubscriberInitializer<
  T extends object,
  V,
  S extends SignalLike<V>,
>(
  context: ClassMethodDecoratorContext<T>,
  target: S,
  predicate: SubscribePredicate<T, V> = () => true,
): (this: T) => void {
  return function (this: T) {
    setCallback(this, "init", context.name, () => {
      const value = context.access.get(this);
      const callback = () => {
        if (predicate.call(this, target.value)) {
          value.call(this, target);
        }
      };
      const unsubscribe = target.subscribe(callback);
      unsubscribeRegistry.register(this, unsubscribe);
    });
  };
}

export function subscribe<T extends object, S extends SignalLike<any>>(
  this: unknown,
  target: S,
  predicate?: SubscribePredicate<T, SignalType<S>>,
): SignalSubscribeDecorator<T>;
export function subscribe<
  T extends object,
  U extends EventTarget,
  E extends Event,
>(
  this: unknown,
  target: U | LazyEventTarget<U>,
  event: string,
  predicate?: SubscribePredicate<T, E>,
): EventSubscribeDecorator<T, E>;
export function subscribe<T extends object>(
  this: unknown,
  target: EventTarget | LazyEventTarget<any> | SignalLike<any>,
  eventOrPredicate?: SubscribePredicate<T, any> | string,
  predicate?: SubscribePredicate<T, any>,
): EventSubscribeDecorator<T, any> | SignalSubscribeDecorator<T> {
  return function (_: unknown, context: ClassMethodDecoratorContext<T>): void {
    assertContext(context, "@subscribe", "method", { private: true });
    if (
      (typeof target === "function" || target instanceof EventTarget) &&
      typeof eventOrPredicate === "string"
    ) {
      context.addInitializer(
        createEventSubscriberInitializer(
          context,
          target,
          eventOrPredicate,
          predicate,
        ),
      );
      return;
    }
    if (
      isSignalLike(target) &&
      (typeof eventOrPredicate === "function" ||
        typeof eventOrPredicate === "undefined")
    ) {
      context.addInitializer(
        createSignalSubscriberInitializer(context, target, eventOrPredicate),
      );
      return;
    }
    throw new Error("Invalid arguments to @subscribe");
  };
}

export function connected<T extends HTMLElement>() {
  return function (
    _: Method<T, []>,
    context: ClassMethodDecoratorContext<T>,
  ): void {
    assertContext(context, "@connected", "method", { private: true });
    context.addInitializer(function () {
      setCallback(
        this,
        "connect",
        context.name,
        context.access.get(this).bind(this),
      );
    });
  };
}

export function disconnected<T extends HTMLElement>() {
  return function (
    _: Method<T, []>,
    context: ClassMethodDecoratorContext<T>,
  ): void {
    assertContext(context, "@disconnected", "method", { private: true });
    context.addInitializer(function () {
      setCallback(
        this,
        "disconnect",
        context.name,
        context.access.get(this).bind(this),
      );
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
  inputTransformer: Transformer<T, V>,
  options: AttrOptions = {},
): ClassAccessorDecorator<T, V> {
  const transformer = withDefaults(inputTransformer);
  const isReflectiveAttribute = options.reflective !== false;
  return function (target, context): ClassAccessorDecoratorResult<T, V> {
    assertContext(context, "@attr", "accessor");

    // Accessor decorators can be applied to symbol accessors, but DOM attribute
    // names must be strings. As attributes always go along with public getters
    // and setters, the following check throws even if an alternative attribute
    // name was provided via the "as" option.
    if (typeof context.name === "symbol") {
      throw new TypeError("Attribute backends for @attr() must not be symbols");
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
          oldAttrVal: string | null,
          newAttrVal: string | null,
        ): void {
          if (name !== attrName || newAttrVal === oldAttrVal) {
            return; // skip irrelevant invocations
          }
          const oldValue = target.get.call(this);
          let newValue = transformer.parse.call(this, newAttrVal, oldValue);
          if (transformer.eql.call(this, newValue, oldValue)) {
            return;
          }
          newValue = transformer.set.call(this, newValue, newAttrVal, context);
          target.set.call(this, newValue);
          this.dispatchEvent(new ReactivityEvent(context.name));
        };
        setObserver(this, attrName, attributeChangedCallback);
      });
    }

    return {
      init(input) {
        const attrValue = this.getAttribute(attrName);
        const value =
          attrValue !== null
            ? transformer.parse.call(this, attrValue, Nil)
            : transformer.validate.call(this, input, Nil);
        return transformer.init.call(this, value, input, context);
      },
      set(input) {
        const oldValue = target.get.call(this);
        let newValue = transformer.validate.call(this, input, oldValue);
        if (transformer.eql.call(this, newValue, oldValue)) {
          return;
        }
        newValue = transformer.set.call(this, newValue, input, context);
        target.set.call(this, newValue);
        if (isReflectiveAttribute) {
          const updateAttr = transformer.updateContentAttr.call(
            this,
            oldValue,
            newValue,
          );
          if (updateAttr === null) {
            this.removeAttribute(attrName);
          } else if (updateAttr === true) {
            this.setAttribute(
              attrName,
              transformer.stringify.call(this, newValue),
            );
          }
        }
        this.dispatchEvent(new ReactivityEvent(context.name));
      },
      get() {
        return transformer.get.call(this, target.get.call(this), context);
      },
    };
  };
}

// Accessor decorator @prop() returns a normal accessor, but with validation and
// reactivity added.
export function prop<T extends HTMLElement, V>(
  this: unknown,
  transformer: Transformer<T, V>,
): ClassAccessorDecorator<T, V> {
  const { eql, get, set, init } = withDefaults(transformer);
  return function (target, context): ClassAccessorDecoratorResult<T, V> {
    assertContext(context, "@prop", "accessor", { private: true });
    return {
      init(input) {
        input = init.call(this, input, input, context);
        return transformer.validate.call(this, input, Nil);
      },
      set(input) {
        const oldValue = target.get.call(this);
        let newValue = transformer.validate.call(this, input, Nil);
        if (eql.call(this, newValue, oldValue)) {
          return;
        }
        newValue = set.call(this, newValue, Nil, context);
        target.set.call(this, newValue);
        this.dispatchEvent(new ReactivityEvent(context.name));
      },
      get() {
        return get.call(this, target.get.call(this), context);
      },
    };
  };
}

// Class field/method decorator @debounce() debounces functions.

type DebounceOptions = {
  fn?: (cb: () => void) => () => void;
};

function createDebouncedMethod<T extends object, A extends unknown[]>(
  originalMethod: Method<T, A>,
  wait: (cb: () => void) => () => void,
): Method<T, A> {
  const cancelFns = new WeakMap<T, undefined | (() => void)>();
  function debouncedMethod(this: T, ...args: A): any {
    const cancelFn = cancelFns.get(this);
    if (cancelFn) {
      cancelFn();
    }
    cancelFns.set(
      this,
      wait(() => {
        originalMethod.call(this, ...args);
        cancelFns.delete(this);
      }),
    );
  }
  DEBOUNCED_METHOD_MAP.set(debouncedMethod, originalMethod);
  return debouncedMethod;
}

export function debounce<T extends HTMLElement, A extends unknown[]>(
  this: unknown,
  options: DebounceOptions = {},
): FunctionFieldOrMethodDecorator<T, A> {
  const fn = options.fn ?? debounce.raf();
  function decorator(
    value: Method<T, A>,
    context: ClassMethodDecoratorContext<T, Method<T, A>>,
  ): Method<T, A>;
  function decorator(
    value: undefined,
    context: ClassFieldDecoratorContext<T, Method<unknown, A>>,
  ): (init: Method<unknown, A>) => Method<unknown, A>;
  function decorator(
    value: Method<T, A> | undefined,
    context: FunctionFieldOrMethodContext<T, A>,
  ): Method<T, A> | ((init: Method<unknown, A>) => Method<unknown, A>) {
    assertContext(context, "@debounce", ["field", "method"], {
      private: true,
      static: true,
    });
    if (context.kind === "field") {
      // Field decorator (bound methods)
      return function init(
        this: T,
        func: Method<unknown, A>,
      ): Method<unknown, A> {
        if (typeof func !== "function") {
          throw new TypeError(
            "@debounce() can only be applied to function class fields",
          );
        }
        return createDebouncedMethod(func, fn).bind(this);
      };
    } else if (context.kind === "method") {
      // Method decorator. TS does not understand that value is a function at
      // this point
      return createDebouncedMethod(value as Method<T, A>, fn);
    }
    throw new Error(); // never happens, just to appease TS
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
