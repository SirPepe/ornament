import { MetaMap, Nil } from "./lib.js";
import {
  type ClassAccessorDecorator,
  type FunctionFieldOrMethodDecorator,
  type FunctionFieldOrMethodContext,
  type Method,
  type Transformer,
  assertContext,
} from "./types.js";

// Un-clobber an accessor if the element upgrades after a property with
// a matching name has already been set
function initAccessor(
  instance: any,
  name: string | symbol,
  defaultValue: any,
): any {
  if (Object.hasOwn(instance, name)) {
    defaultValue = (instance as any)[name];
    delete (instance as any)[name];
  }
  return defaultValue;
}

class ReactivityEvent extends Event {
  readonly key: string | symbol;
  constructor(key: string | symbol) {
    super("");
    this.key = key;
  }
}

// Accessor decorators initialize *after* custom elements access their
// observedAttributes getter. This means that, in the absence of the decorators
// metadata feature, there is no way to associate observed attributes with
// specific elements or constructors from inside the @attr() decorator. Instead
// we simply track *all* attributes defined by @attr() *on any class* and decide
// *inside the attribute changed callback* whether they are *actually* observed
// by a given element.
const ALL_OBSERVABLE_ATTRIBUTES = new Set<string>();

// Event targets associated with element instances
const eventTargetMap = new MetaMap<HTMLElement, EventTarget>(
  () => new EventTarget(),
);

declare global {
  interface OrnamentReactionMap {
    init: Record<string, never>;
    connect: Record<string, never>;
    disconnect: Record<string, never>;
  }
}

function trigger<T extends HTMLElement, K extends keyof OrnamentReactionMap>(
  instance: T,
  name: K,
  args: OrnamentReactionMap[K],
): void {
  eventTargetMap
    .get(instance)
    .dispatchEvent(Object.assign(new Event(name), args));
}

function listen<T extends HTMLElement, K extends keyof OrnamentReactionMap>(
  instance: T,
  name: K,
  callback: (this: T, args: Event & OrnamentReactionMap[K]) => void,
): void {
  eventTargetMap
    .get(instance)
    .addEventListener(name, (evt: any): void => callback.call(instance, evt));
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
const observerCallbacks = new MetaMap<CustomElementConstructor, ObserverMap>(
  Object,
);

function setObserver(
  instance: any,
  attribute: string,
  callback: ObserverCallback,
): void {
  const callbacks = observerCallbacks.get(instance.constructor);
  if (!callbacks[attribute]) {
    callbacks[attribute] = callback;
  }
}

function getObservers(instance: any): Record<string, ObserverCallback> {
  return observerCallbacks.get(instance.constructor) ?? {};
}

// Maps debounced methods to original methods. Needed for initial calls of
// @reactive() methods, which are not supposed to be async.
const DEBOUNCED_METHOD_MAP = new WeakMap<Method<any, any>, Method<any, any>>();

// The class decorator @define() defines a custom element and also injects a
// mixin class that hat deals with attribute observation and reactive
// init callback handling.
export function define<T extends CustomElementConstructor>(
  this: unknown,
  tagName: string,
): (target: T, context: ClassDecoratorContext<T>) => T {
  return function (target: T, context: ClassDecoratorContext<T>): T {
    assertContext(context, "define", "class");
    const originalObservedAttributes = (target as any).observedAttributes ?? [];

    // Define the custom element after all other decorators have been applied
    context.addInitializer(function () {
      window.customElements.define(tagName, this);
    });

    // Installs the mixin class. This kindof changes the type of the input
    // constructor T, but as TypeScript can currently not use class decorators
    // to change the type, we don't bother. The changes are really small, too.
    // See https://github.com/microsoft/TypeScript/issues/51347
    return class extends target {
      constructor(...args: any[]) {
        super(...args);
        trigger(this, "init", {});
      }

      static get observedAttributes(): string[] {
        return [...originalObservedAttributes, ...ALL_OBSERVABLE_ATTRIBUTES];
      }

      connectedCallback(): void {
        // The base class may or may not have its own connectedCallback, but the
        // type CustomElementConstructor does not reflect that. TS won't allow
        // us to access the property speculatively, so we need to tell it to
        // shut up... and then tell ESLint to shut up about us telling TS to
        // shut up. The same happens for the other lifecycle callbacks.
        // eslint-disable-next-line
        // @ts-ignore
        super.connectedCallback?.call(this);
        trigger(this, "connect", {});
      }

      disconnectedCallback(): void {
        // eslint-disable-next-line
        // @ts-ignore
        super.disconnectedCallback?.call(this);
        trigger(this, "disconnect", {});
      }

      attributeChangedCallback(
        this: HTMLElement,
        name: string,
        oldVal: string | null,
        newVal: string | null,
      ): void {
        if (
          // eslint-disable-next-line
          // @ts-ignore
          super.attributeChangedCallback &&
          originalObservedAttributes.includes(name)
        ) {
          // eslint-disable-next-line
          // @ts-ignore
          super.attributeChangedCallback.call(this, name, oldVal, newVal);
        }
        const callback = getObservers(this)[name];
        if (callback) {
          callback.call(this, name, oldVal, newVal);
        }
      }
    };
  };
}

type ReactiveOptions<T> = {
  initial?: boolean;
  keys?: (string | symbol)[];
  predicate?: (this: T) => boolean;
};

type ReactiveDecorator<T extends HTMLElement> = (
  value: () => any,
  context: ClassMethodDecoratorContext<T, () => any>,
) => void;

export function reactive<T extends HTMLElement>(
  this: unknown,
  options: ReactiveOptions<T> = {},
): ReactiveDecorator<T> {
  const subscribedElements = new WeakSet();
  return function (_, context): void {
    assertContext(context, "reactive", "method");
    context.addInitializer(function () {
      const value = context.access.get(this);
      listen(this, "init", () => {
        // Active only once elements have initialized. This prevents prop set-up
        // in the constructor from triggering reactive methods.
        subscribedElements.add(this);
        // Register the callback that performs the initial method call. Uses the
        // non-debounced method if required and wraps it in predicate logic.
        if (options.initial !== false) {
          if (!options.predicate || options.predicate.call(this)) {
            (DEBOUNCED_METHOD_MAP.get(value) ?? value).call(this);
          }
        }
      });
      // Start listening for reactivity events that happen after reactive init
      eventTargetMap
        .get(this)
        .addEventListener("", (evt: any /* ReactivityEvent */) => {
          if (
            subscribedElements.has(this) &&
            (!options.predicate || options.predicate.call(this)) &&
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

type EventSubscribeOptions<T, V> = AddEventListenerOptions & {
  predicate?: SubscribePredicate<T, V>;
};

type SignalSubscribeOptions<T, V> = {
  predicate?: SubscribePredicate<T, V>;
};

type SubscribeOptions<T, V> =
  | EventSubscribeOptions<T, V>
  | SignalSubscribeOptions<T, V>;

type EventSubscribeDecorator<T, E extends Event> = (
  value: Method<T, [E]>,
  context: ClassMethodDecoratorContext<T>,
) => void;

type EventTargetFactory<T, E extends EventTarget = EventTarget> = (
  this: T,
) => E;

function createEventSubscriberInitializer<
  T extends HTMLElement,
  E extends Event,
>(
  context: ClassMethodDecoratorContext<T>,
  targetOrTargetFactory: EventTarget | EventTargetFactory<T>,
  eventNames: string,
  options: EventSubscribeOptions<T, E> = {},
): (this: T) => void {
  return function (this: T) {
    const predicate = options.predicate ?? (() => true);
    listen(this, "init", () => {
      const callback = (evt: any) => {
        if (predicate.call(this, evt)) {
          context.access.get(this).call(this, evt);
        }
      };
      const eventTarget =
        typeof targetOrTargetFactory === "function"
          ? targetOrTargetFactory.call(this)
          : targetOrTargetFactory;
      const unsubscribe = () =>
        eventTarget.removeEventListener(eventNames, callback);
      unsubscribeRegistry.register(this, unsubscribe);
      eventTarget.addEventListener(eventNames, callback);
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
  T extends HTMLElement,
  V,
  S extends SignalLike<V>,
>(
  context: ClassMethodDecoratorContext<T>,
  target: S,
  options: SignalSubscribeOptions<T, V> = {},
): (this: T) => void {
  return function (this: T) {
    const predicate = options.predicate ?? (() => true);
    listen(this, "init", () => {
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

export function subscribe<T extends HTMLElement, S extends SignalLike<any>>(
  this: unknown,
  target: S,
  options?: SignalSubscribeOptions<T, SignalType<S>>,
): SignalSubscribeDecorator<T>;
export function subscribe<
  T extends HTMLElement,
  U extends EventTarget,
  E extends Event,
>(
  this: unknown,
  target: U | EventTargetFactory<U>,
  events: string,
  options?: EventSubscribeOptions<T, E>,
): EventSubscribeDecorator<T, E>;
export function subscribe<T extends HTMLElement>(
  this: unknown,
  target: EventTarget | EventTargetFactory<any> | SignalLike<any>,
  eventsOrOptions?: SubscribeOptions<T, any> | string,
  options?: SubscribeOptions<T, any>,
): EventSubscribeDecorator<T, any> | SignalSubscribeDecorator<T> {
  return function (_: unknown, context: ClassMethodDecoratorContext<T>): void {
    assertContext(context, "subscribe", "method");
    if (
      (typeof target === "function" || target instanceof EventTarget) &&
      typeof eventsOrOptions === "string"
    ) {
      context.addInitializer(
        createEventSubscriberInitializer(
          context,
          target,
          eventsOrOptions,
          options,
        ),
      );
      return;
    }
    if (
      isSignalLike(target) &&
      (typeof eventsOrOptions === "object" ||
        typeof eventsOrOptions === "undefined")
    ) {
      context.addInitializer(
        createSignalSubscriberInitializer(context, target, eventsOrOptions),
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
    assertContext(context, "connected", "method");
    context.addInitializer(function () {
      listen(this, "connect", context.access.get(this));
    });
  };
}

export function disconnected<T extends HTMLElement>() {
  return function (
    _: Method<T, []>,
    context: ClassMethodDecoratorContext<T>,
  ): void {
    assertContext(context, "disconnected", "method");
    context.addInitializer(function () {
      listen(this, "disconnect", context.access.get(this));
    });
  };
}

// Accessor decorator @attr() defines a DOM attribute backed by an accessor.
// Because attributes are public by definition, it can't be applied to private
// accessors or symbol accessors.

type AttrOptions = {
  as?: string; // defaults to the attribute name
  reflective?: boolean; // defaults to true
};

// Enables early exits from the attributeChangedCallback for attribute updates
// that were caused by setters.
const SKIP_NEXT_ATTRIBUTE_REACTION = new WeakMap<HTMLElement, Set<string>>();

export function attr<T extends HTMLElement, V>(
  this: unknown,
  transformer: Transformer<T, V>,
  options: AttrOptions = {},
): ClassAccessorDecorator<T, V> {
  const isReflectiveAttribute = options.reflective !== false;
  return function (target, context): ClassAccessorDecoratorResult<T, V> {
    assertContext(context, "attr", "accessor");

    // Accessor decorators can be applied to symbol accessors, but IDL attribute
    // names must a) be strings and b) exist. The following checks ensure that
    // the accessor, if it is a symbol or a private property, has a content
    // attribute name and a name for a public API.
    let contentAttrName: string;
    let idlAttrName: string;
    if (typeof context.name === "symbol" || context.private) {
      if (typeof options.as === "undefined") {
        throw new TypeError(
          "Attribute names for @attr() must not be symbols. Provide the `as` option and a public facade for your accessor or use a regular property name.",
        );
      }
      contentAttrName = idlAttrName = options.as;
    } else {
      contentAttrName = options.as ?? context.name;
      idlAttrName = context.name;
    }

    // If the attribute needs to be observed, add the name to the set of all
    // observed attributes.
    if (isReflectiveAttribute) {
      ALL_OBSERVABLE_ATTRIBUTES.add(contentAttrName);
    }

    // If the attribute needs to be observed and the accessor initializes,
    // register the attribute handler callback with the current element
    // instance - this initializer is earliest we have access to the instance.
    if (isReflectiveAttribute) {
      context.addInitializer(function () {
        const skipReactions = new Set<string>();
        SKIP_NEXT_ATTRIBUTE_REACTION.set(this, skipReactions);
        const attributeChangedCallback = function (
          this: T,
          name: string,
          oldAttrVal: string | null,
          newAttrVal: string | null,
        ): void {
          if (name !== contentAttrName || newAttrVal === oldAttrVal) {
            return; // skip irrelevant invocations
          }
          if (skipReactions.has(name)) {
            skipReactions.delete(name);
            return; // skip attribute reaction caused by a setter
          }
          const oldValue = target.get.call(this);
          let newValue = transformer.parse.call(this, newAttrVal, oldValue);
          if (transformer.eql.call(this, newValue, oldValue)) {
            return;
          }
          newValue = transformer.set.call(this, newValue, newAttrVal, context);
          target.set.call(this, newValue);
          eventTargetMap
            .get(this)
            .dispatchEvent(new ReactivityEvent(context.name));
        };
        setObserver(this, contentAttrName, attributeChangedCallback);
      });
    }

    return {
      init(input) {
        // Final sanity check: does a public api for this attribute exist? This
        // needs to be added manually for private or symbol accessors.
        if (!(idlAttrName in this)) {
          throw new TypeError(
            `Content attribute '${contentAttrName}' is missing its public API`,
          );
        }
        input = initAccessor(this, contentAttrName, input);
        const attrValue = this.getAttribute(contentAttrName);
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
          // If an attribute update is about to happen, the next
          // attributeChangedCallback must be skipped to prevent double calls of
          // @reactive methods
          if (updateAttr !== false) {
            SKIP_NEXT_ATTRIBUTE_REACTION.get(this)?.add(contentAttrName);
          }
          if (updateAttr === null) {
            this.removeAttribute(contentAttrName);
          } else if (updateAttr) {
            this.setAttribute(
              contentAttrName,
              transformer.stringify.call(this, newValue),
            );
          }
        }
        eventTargetMap
          .get(this)
          .dispatchEvent(new ReactivityEvent(context.name));
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
  return function (target, context): ClassAccessorDecoratorResult<T, V> {
    assertContext(context, "prop", "accessor");
    return {
      init(input) {
        input = initAccessor(this, context.name, input);
        input = transformer.init.call(this, input, input, context);
        return transformer.validate.call(this, input, Nil);
      },
      set(input) {
        let newValue = transformer.validate.call(this, input, Nil);
        if (transformer.eql.call(this, newValue, target.get.call(this))) {
          return;
        }
        newValue = transformer.set.call(this, newValue, Nil, context);
        target.set.call(this, newValue);
        eventTargetMap
          .get(this)
          .dispatchEvent(new ReactivityEvent(context.name));
      },
      get() {
        return transformer.get.call(this, target.get.call(this), context);
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
    assertContext(context, "debounce", ["field", "method"], { static: true });
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
    }
    // if it's not a field decorator, it must be a method decorator
    return createDebouncedMethod(value as Method<T, A>, fn);
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
