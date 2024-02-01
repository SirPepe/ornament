import { listen, trigger } from "./bus.js";
import { BUS_TARGET, EMPTY_OBJ, NO_VALUE } from "./lib.js";
import {
  type Transformer,
  type ClassAccessorDecorator,
  type FunctionFieldOrMethodDecorator,
  type FunctionFieldOrMethodContext,
  type Method,
  assertContext,
} from "./types.js";

// If some bundler or HMR process happens to include Ornament more than once, we
// need to make sure that the metadata stores are globally unique.
const OBSERVABLE_ATTRS: unique symbol = Symbol.for("OBSERVABLE_ATTRS");
const DEBOUNCED_METHODS: unique symbol = Symbol.for("DEBOUNCED_METHODS");
const UNSUBSCRIBE_REGISTRY: unique symbol = Symbol.for("UNSUBSCRIBE_REGISTRY");

// Presence of this symbol marks a custom element constructor as already
// enhanced. @enhance() uses this to safeguard against enhancing the same class
// twice, which can easily happen once class hierarchies become convoluted.
const CLASS_IS_ENHANCED: unique symbol = Symbol.for("IS_ENHANCED");

// Marks an instance as initialized. This is useful for non-enhanced subclasses
// of an enhanced class that will miss the actual init event, but can use this
// value to figure out whether that is indeed the case.
const INSTANCE_IS_INITIALIZED: unique symbol = Symbol.for("IS_INITIALIZED");

declare global {
  interface Window {
    // Accessor decorators initialize *after* custom elements access their
    // observedAttributes getter. This means that, in the absence of the
    // decorators metadata feature, there is no way to associate observed
    // attributes with specific elements or constructors from inside the @attr()
    // decorator. Instead we simply track *all* attributes defined by @attr() on
    // any class and decide inside the attribute changed callback* whether they
    // are actually observed by a given element.
    [OBSERVABLE_ATTRS]: Set<string>;
    // Maps debounced methods to original methods. Needed for initial calls of
    // @reactive() methods, as the initial calls are not supposed to be async.
    [DEBOUNCED_METHODS]: WeakMap<Method<any, any>, Method<any, any>>;
    // Unsubscribe from event targets or signals when a method that @subscribe
    // was applied to gets GC'd
    [UNSUBSCRIBE_REGISTRY]: FinalizationRegistry<() => void>;
  }
}

window[OBSERVABLE_ATTRS] ??= new Set();
window[DEBOUNCED_METHODS] ??= new WeakMap();
window[UNSUBSCRIBE_REGISTRY] ??= new FinalizationRegistry((f) => f());

// Un-clobber an accessor's name if the element upgrades after a property with
// a matching name has already been set.
function initAccessorInitialValue(
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

// The class decorator @enhance() injects the mixin class that hat deals with
// attribute observation and reactive init callback handling. You should
// probably stick to @define(), which does the same thing, but also defines the
// custom element. This decorator is only useful if you need to handle element
// registration in some other way.
export function enhance<T extends CustomElementConstructor>(): (
  target: T,
  context: ClassDecoratorContext<T>,
) => T {
  return function (target: T, context: ClassDecoratorContext<T>): T {
    assertContext(context, "define", "class");

    // In case @enhance() gets applied to a class more than once (either
    // directly or via some convoluted OOP mess) the mixin class must NOT be
    // be re-installed.
    if ((target as any)[CLASS_IS_ENHANCED]) {
      return target;
    }

    const originalObservedAttributes = new Set<string>(
      (target as any).observedAttributes ?? [],
    );

    // Installs the mixin class. This kindof changes the type of the input
    // constructor T, but as TypeScript can currently not use class decorators
    // to change the type, we don't bother. The changes are really small and
    // only affects lifecycle callbacks, which are not really "public" anyway.
    // See https://github.com/microsoft/TypeScript/issues/51347
    return class extends target {
      // Instances WILL end up with an field [BUS_TARGET] containing the event
      // target for the event bus. But because these targets may be needed
      // before the instances finish initializing (or they may be never needed),
      // the event bus function just slaps them on instances if and when they
      // become important. And because TypeScript can't do anything with the
      // mixin class type, there is no *real* reason to have anything related to
      // the event targets here... but just for fun:
      [BUS_TARGET]!: EventTarget; // this is entirely useless

      // Indicates that the class already has had the mixin applied to it
      static readonly [CLASS_IS_ENHANCED] = true;

      // Indicates that the instance has had its init event triggered
      [INSTANCE_IS_INITIALIZED] = false;

      constructor(...args: any[]) {
        super(...args);
        trigger(this, "init");
        this[INSTANCE_IS_INITIALIZED] = true;
      }

      static get observedAttributes(): string[] {
        return [...originalObservedAttributes, ...window[OBSERVABLE_ATTRS]];
      }

      connectedCallback(): void {
        // The base class may or may not have its own connectedCallback, but the
        // type CustomElementConstructor does not reflect that. TS won't allow
        // us to access the property speculatively, so we need to tell it to
        // shut up... and then tell ESLint to shut up about us telling TS to
        // shut up. The same happens for all the other lifecycle callbacks.
        // eslint-disable-next-line
        // @ts-ignore
        super.connectedCallback?.call(this);
        trigger(this, "connected");
      }

      disconnectedCallback(): void {
        // eslint-disable-next-line
        // @ts-ignore
        super.disconnectedCallback?.call(this);
        trigger(this, "disconnected");
      }

      adoptedCallback(): void {
        // eslint-disable-next-line
        // @ts-ignore
        super.adoptedCallback?.call(this);
        trigger(this, "adopted");
      }

      attributeChangedCallback(
        this: HTMLElement,
        name: string,
        oldValue: string | null,
        newValue: string | null,
      ): void {
        if (originalObservedAttributes.has(name)) {
          // eslint-disable-next-line
          // @ts-ignore
          super.attributeChangedCallback?.call(this, name, oldValue, newValue);
        }
        trigger(this, "attr", name, oldValue, newValue);
      }

      formAssociatedCallback(owner: HTMLFormElement | null): void {
        // eslint-disable-next-line
        // @ts-ignore
        super.formAssociatedCallback?.call(this, owner);
        trigger(this, "formAssociated", owner);
      }

      formResetCallback(): void {
        // eslint-disable-next-line
        // @ts-ignore
        super.formResetCallback?.call(this);
        trigger(this, "formReset");
      }

      formDisabledCallback(disabled: boolean): void {
        // eslint-disable-next-line
        // @ts-ignore
        super.formDisabledCallback?.call(this, disabled);
        trigger(this, "formDisabled", disabled);
      }

      formStateRestoreCallback(
        state: string | File | FormData | null,
        reason: "autocomplete" | "restore",
      ): void {
        // eslint-disable-next-line
        // @ts-ignore
        super.formStateRestoreCallback?.call(this, state, reason);
        trigger(this, "formStateRestore", state, reason);
      }
    };
  };
}

// The class decorator @define() defines a custom element and also injects a
// mixin class that hat deals with attribute observation and reactive
// init callback handling.
export function define<T extends CustomElementConstructor>(
  tagName: string,
  options: ElementDefinitionOptions = {},
): (target: T, context: ClassDecoratorContext<T>) => T {
  return function (target: T, context: ClassDecoratorContext<T>): T {
    assertContext(context, "define", "class");

    // Define the custom element after all other decorators have been applied
    context.addInitializer(function () {
      window.customElements.define(tagName, this, options);
    });

    // Install the mixin class via @enhance()
    return enhance<T>()(target, context);
  };
}

// Class members that need to run some init logic need to either wait for the
// init event (for class members of enhanced classes) ir figure out whether an
// init event has already happened (for class members of a subclass of an
// enhanced class). This function handles both cases seamlessly.
function runOnInit<T extends HTMLElement>(instance: T, fn: () => any): void {
  // Init event has already happened, call init function ASAP
  if ((instance as any)[INSTANCE_IS_INITIALIZED] === true) {
    fn();
    return;
  }
  // Init event is still going to happen
  listen(instance, "init", fn, { once: true });
}

type ReactiveOptions<T> = {
  initial?: boolean;
  keys?: (string | symbol)[];
  excludeKeys?: (string | symbol)[];
  predicate?: (instance: T) => boolean;
};

type ReactiveDecorator<T extends HTMLElement> = (
  value: () => any,
  context: ClassMethodDecoratorContext<T, () => any>,
) => void;

export function reactive<T extends HTMLElement>(
  options: ReactiveOptions<T> = EMPTY_OBJ,
): ReactiveDecorator<T> {
  return function (_, context): void {
    assertContext(context, "reactive", "method");
    context.addInitializer(function () {
      const value = context.access.get(this);
      // Register the callback that performs the initial method call and sets up
      // listeners for subsequent methods calls.
      runOnInit(this, () => {
        // Initial method call, if applicable. Uses the non-debounced method if
        // required and wraps it in predicate logic.
        if (
          options.initial !== false &&
          (!options.predicate || options.predicate(this))
        ) {
          (window[DEBOUNCED_METHODS].get(value) ?? value).call(this);
        }
        // Start listening only once the element's constructor has run to
        // completion. This prevents prop set-up in the constructor from
        // triggering reactive methods.
        listen(this, "prop", (name) => {
          if (
            (!options.predicate || options.predicate(this)) &&
            (!options.keys || options.keys?.includes(name)) &&
            (!options.excludeKeys ||
              options.excludeKeys?.includes(name) === false)
          ) {
            value.call(this);
          }
        });
      });
    });
  };
}

type SubscribePredicate<T, V> = (instance: T, value: V) => boolean;

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
  instance: T,
) => E;

function createEventSubscriberInitializer<
  T extends HTMLElement,
  E extends Event,
>(
  context: ClassMethodDecoratorContext<T>,
  targetOrTargetFactory: EventTarget | EventTargetFactory<T>,
  eventNames: string,
  options: EventSubscribeOptions<T, E> = EMPTY_OBJ,
): (this: T) => void {
  return function (this: T) {
    runOnInit(this, () => {
      const callback = (evt: any) => {
        if (!options.predicate || options.predicate(this, evt)) {
          context.access.get(this).call(this, evt);
        }
      };
      const eventTarget =
        typeof targetOrTargetFactory === "function"
          ? targetOrTargetFactory(this)
          : targetOrTargetFactory;
      for (const eventName of eventNames.trim().split(/\s+/)) {
        window[UNSUBSCRIBE_REGISTRY].register(this, () =>
          eventTarget.removeEventListener(eventName, callback, options),
        );
        eventTarget.addEventListener(eventName, callback, options);
      }
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
  options: SignalSubscribeOptions<T, V> = EMPTY_OBJ,
): (this: T) => void {
  return function (this: T) {
    runOnInit(this, () => {
      const value = context.access.get(this);
      const unsubscribe = target.subscribe(() => {
        if (!options.predicate || options.predicate(this, target.value)) {
          value.call(this, target);
        }
      });
      window[UNSUBSCRIBE_REGISTRY].register(this, unsubscribe);
    });
  };
}

export function subscribe<T extends HTMLElement, S extends SignalLike<any>>(
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
      return context.addInitializer(
        createEventSubscriberInitializer(
          context,
          target,
          eventsOrOptions,
          options,
        ),
      );
    }
    if (
      isSignalLike(target) &&
      (typeof eventsOrOptions === "object" ||
        typeof eventsOrOptions === "undefined")
    ) {
      return context.addInitializer(
        createSignalSubscriberInitializer(context, target, eventsOrOptions),
      );
    }
    throw new Error("Invalid arguments to @subscribe");
  };
}

type LifecycleDecorator<T extends HTMLElement, Arguments extends any[]> = (
  _: Method<T, Arguments>,
  context: ClassMethodDecoratorContext<T, (this: T, ...args: any) => any>,
) => void;

function createLifecycleDecorator<K extends keyof OrnamentEventMap>(
  name: K,
): <T extends HTMLElement>() => LifecycleDecorator<T, OrnamentEventMap[K]> {
  return <T extends HTMLElement>() =>
    function (
      _: Method<T, OrnamentEventMap[K]>,
      context: ClassMethodDecoratorContext<T>,
    ): void {
      assertContext(context, name, "method");
      context.addInitializer(function () {
        listen(this, name, context.access.get(this));
      });
    };
}

// Bulk-create all basic lifecycle decorators
export const connected = createLifecycleDecorator("connected");
export const disconnected = createLifecycleDecorator("disconnected");
export const adopted = createLifecycleDecorator("adopted");
export const formAssociated = createLifecycleDecorator("formAssociated");
export const formReset = createLifecycleDecorator("formReset");
export const formDisabled = createLifecycleDecorator("formDisabled");
export const formStateRestore = createLifecycleDecorator("formStateRestore");

type AttrOptions = {
  as?: string; // defaults to the attribute name
  reflective?: boolean; // defaults to true
};

// The accessor decorator @attr() defines a DOM attribute backed by an accessor.
export function attr<T extends HTMLElement, V>(
  transformer: Transformer<T, V>,
  options: AttrOptions = EMPTY_OBJ,
): ClassAccessorDecorator<T, V> {
  const reflective = options.reflective ?? true;
  // Enables early exits from the attributeChangedCallback for content attribute
  // updates that were caused by invoking IDL setters.
  const skipNextReaction = new WeakMap<HTMLElement, boolean>();
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
          "Content attribute names must not be symbols or private fields. Provide the `as` option and a public facade for your accessor or use a regular property name.",
        );
      }
      contentAttrName = idlAttrName = options.as;
    } else {
      contentAttrName = options.as ?? context.name;
      idlAttrName = context.name;
    }

    // Add the name to the set of all observed attributes, even if "reflective"
    // if false. The content attribute must in all cases be observed to enable
    // the message bus to emit events.
    window[OBSERVABLE_ATTRS].add(contentAttrName);

    // If the attribute needs to be observed and the accessor initializes,
    // register the attribute handler callback with the current element
    // instance - this initializer is earliest we have access to the instance.
    context.addInitializer(function () {
      listen(
        this,
        "attr",
        function (
          this: T,
          name: string,
          _: string | null,
          newValue: string | null,
        ): unknown {
          // Skip obviously irrelevant invocations
          if (name !== contentAttrName) {
            return;
          }
          // Skip attribute reactions caused by setter invocations.
          if (skipNextReaction.get(this)) {
            return skipNextReaction.set(this, false);
          }
          // Actually parse the input value
          const currentNewValue = transformer.parse.call(this, newValue);
          // Skip no-ops and updates by non-reflective attributes
          if (
            !reflective ||
            currentNewValue === NO_VALUE ||
            transformer.eql.call(this, currentNewValue, target.get.call(this))
          ) {
            return;
          }
          // Actually perform the update
          transformer.beforeSet.call(
            this,
            currentNewValue,
            context,
            newValue === null,
          );
          target.set.call(this, currentNewValue);
          trigger(this, "prop", context.name, currentNewValue);
        },
      );
    });

    return {
      init(input) {
        // Final sanity check: does a public api for this attribute exist? This
        // needs to be added manually for private or symbol accessors.
        if (!(idlAttrName in this)) {
          throw new TypeError(
            `Content attribute '${contentAttrName}' is missing its public API`,
          );
        }
        // Initialize the transformer with the default value. If the attribute
        // is already set when the accessor initializes, we use the value from
        // it, but the transformer needs to be initialized first.
        const defaultValue = transformer.init.call(
          this,
          initAccessorInitialValue(this, contentAttrName, input),
          context,
          true,
        );
        // Use the already-existing attribute value when possible. If the
        // attribute does not exist or its value can't be parsed, fall back to
        // the default value from the initialization step.
        if (this.hasAttribute(contentAttrName)) {
          // Having a content attribute
          const attrValue = transformer.parse.call(
            this,
            this.getAttribute(contentAttrName),
          );
          if (attrValue !== NO_VALUE) {
            transformer.beforeSet.call(this, attrValue, context, false);
            return attrValue;
          }
        }
        return defaultValue;
      },
      set(input) {
        transformer.validate.call(this, input, true);
        const newValue = transformer.transform.call(this, input);
        const oldValue = target.get.call(this);
        if (transformer.eql.call(this, newValue, oldValue)) {
          return;
        }
        transformer.beforeSet.call(this, newValue, context, false);
        target.set.call(this, newValue);
        if (reflective) {
          const updateAttr = transformer.updateContentAttr(oldValue, newValue);
          // If an attribute update is about to happen, the next
          // attributeChangedCallback must be skipped to prevent double calls of
          // @reactive methods
          skipNextReaction.set(this, updateAttr !== false);
          // Perform content attribute updates
          if (updateAttr === null) {
            this.removeAttribute(contentAttrName);
          } else if (updateAttr) {
            this.setAttribute(
              contentAttrName,
              transformer.stringify.call(this, newValue),
            );
          }
        }
        trigger(this, "prop", context.name, newValue);
      },
      get() {
        return transformer.transformGet.call(this, target.get.call(this));
      },
    };
  };
}

// The accessor decorator @prop() returns a normal accessor, but with validation
// and reactivity added.
export function prop<T extends HTMLElement, V>(
  transformer: Transformer<T, V>,
): ClassAccessorDecorator<T, V> {
  return function (target, context): ClassAccessorDecoratorResult<T, V> {
    assertContext(context, "prop", "accessor");
    return {
      init(input) {
        return transformer.init.call(
          this,
          initAccessorInitialValue(this, context.name, input),
          context,
          false,
        );
      },
      set(input) {
        transformer.validate.call(this, input, false);
        const newValue = transformer.transform.call(this, input);
        // skip no-ops
        if (transformer.eql.call(this, newValue, target.get.call(this))) {
          return;
        }
        // actually set the value
        transformer.beforeSet.call(this, newValue, context, false);
        target.set.call(this, newValue);
        trigger(this, "prop", context.name, newValue);
      },
      get() {
        return transformer.transformGet.call(this, target.get.call(this));
      },
    };
  };
}

type DebounceOptions = {
  fn?: (cb: () => void) => () => void;
};

function createDebouncedMethod<T extends object, A extends unknown[]>(
  originalMethod: Method<T, A>,
  wait: (cb: () => void) => () => void,
): Method<T, A> {
  const cancelFns = new WeakMap<T, undefined | (() => void)>();
  function debouncedMethod(this: T, ...args: A): any {
    cancelFns.get(this)?.(); // call cancel function, if it exists
    cancelFns.set(
      this,
      wait(() => {
        originalMethod.call(this, ...args);
        cancelFns.delete(this);
      }),
    );
  }
  window[DEBOUNCED_METHODS].set(debouncedMethod, originalMethod);
  return debouncedMethod;
}

// The class field/method decorator @debounce() debounces functions.
export function debounce<T extends HTMLElement, A extends unknown[]>(
  options: DebounceOptions = EMPTY_OBJ,
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
    assertContext(context, "debounce", ["field", "method"], true);
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
