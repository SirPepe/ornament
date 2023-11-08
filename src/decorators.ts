import { listen, trigger } from "./bus.js";
import { METADATA_KEY } from "./global.js";
import { EMPTY_OBJ, NO_VALUE } from "./lib.js";
import {
  type ClassAccessorDecorator,
  type FunctionFieldOrMethodDecorator,
  type FunctionFieldOrMethodContext,
  type Method,
  type Transformer,
  assertContext,
} from "./types.js";

// Un-clobber an accessor if the element upgrades after a property with
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
    const originalObservedAttributes = new Set<string>(
      (target as any).observedAttributes ?? [],
    );

    // Installs the mixin class. This kindof changes the type of the input
    // constructor T, but as TypeScript can currently not use class decorators
    // to change the type, we don't bother. The changes are really small, too.
    // See https://github.com/microsoft/TypeScript/issues/51347
    return class extends target {
      constructor(...args: any[]) {
        super(...args);
        trigger(this, "init", EMPTY_OBJ);
      }

      static get observedAttributes(): string[] {
        return [
          ...originalObservedAttributes,
          ...window[METADATA_KEY].observableAttributes,
        ];
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
        trigger(this, "connected", EMPTY_OBJ);
      }

      disconnectedCallback(): void {
        // eslint-disable-next-line
        // @ts-ignore
        super.disconnectedCallback?.call(this);
        trigger(this, "disconnected", EMPTY_OBJ);
      }

      adoptedCallback(): void {
        // eslint-disable-next-line
        // @ts-ignore
        super.adoptedCallback?.call(this);
        trigger(this, "adopted", EMPTY_OBJ);
      }

      attributeChangedCallback(
        this: HTMLElement,
        name: string,
        oldValue: string | null,
        newValue: string | null,
      ): void {
        if (
          // eslint-disable-next-line
          // @ts-ignore
          super.attributeChangedCallback &&
          originalObservedAttributes.has(name)
        ) {
          // eslint-disable-next-line
          // @ts-ignore
          super.attributeChangedCallback.call(this, name, oldValue, newValue);
        }
        trigger(this, "attr", { name, oldValue, newValue });
      }
    };
  };
}

// The class decorator @define() defines a custom element and also injects a
// mixin class that hat deals with attribute observation and reactive
// init callback handling.
export function define<T extends CustomElementConstructor>(
  tagName: string,
): (target: T, context: ClassDecoratorContext<T>) => T {
  return function (target: T, context: ClassDecoratorContext<T>): T {
    assertContext(context, "define", "class");

    // Define the custom element after all other decorators have been applied
    context.addInitializer(function () {
      window.customElements.define(tagName, this);
    });

    // Install the mixin class via @enhance()
    return enhance<T>()(target, context);
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
  options: ReactiveOptions<T> = EMPTY_OBJ,
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
            (window[METADATA_KEY].debouncedMethods.get(value) ?? value).call(
              this,
            );
          }
        }
      });
      // Start listening for reactivity events if, after the init event, the
      // element is subscribed.
      listen(this, "prop", ({ name }) => {
        if (
          subscribedElements.has(this) &&
          (!options.predicate || options.predicate.call(this)) &&
          (!options.keys || options.keys?.includes(name))
        ) {
          value.call(this);
        }
      });
    });
  };
}

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
    const predicate = options.predicate ?? (() => true);
    listen(this, "init", () => {
      const callback = (evt: any) => {
        if (predicate.call(this, evt)) {
          context.access.get(this).call(this, evt);
        }
      };
      const eventTarget =
        typeof targetOrTargetFactory === "function"
          ? targetOrTargetFactory(this)
          : targetOrTargetFactory;
      for (const eventName of eventNames.trim().split(/\s+/)) {
        const unsubscribe = () =>
          eventTarget.removeEventListener(eventName, callback);
        window[METADATA_KEY].unsubscribeRegistry.register(this, unsubscribe);
        eventTarget.addEventListener(eventName, callback);
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
    const predicate = options.predicate ?? (() => true);
    listen(this, "init", () => {
      const value = context.access.get(this);
      const callback = () => {
        if (predicate.call(this, target.value)) {
          value.call(this, target);
        }
      };
      const unsubscribe = target.subscribe(callback);
      window[METADATA_KEY].unsubscribeRegistry.register(this, unsubscribe);
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

type LifecycleDecorator<T extends HTMLElement> = (
  _: Method<T, []>,
  context: ClassMethodDecoratorContext<T, (this: T, ...args: any) => any>,
) => void;

export function connected<T extends HTMLElement>(): LifecycleDecorator<T> {
  return function (
    _: Method<T, []>,
    context: ClassMethodDecoratorContext<T>,
  ): void {
    assertContext(context, "connected", "method");
    context.addInitializer(function () {
      listen(this, "connected", context.access.get(this));
    });
  };
}

export function disconnected<T extends HTMLElement>(): LifecycleDecorator<T> {
  return function (
    _: Method<T, []>,
    context: ClassMethodDecoratorContext<T>,
  ): void {
    assertContext(context, "disconnected", "method");
    context.addInitializer(function () {
      listen(this, "disconnected", context.access.get(this));
    });
  };
}

export function adopted<T extends HTMLElement>(): LifecycleDecorator<T> {
  return function (
    _: Method<T, []>,
    context: ClassMethodDecoratorContext<T>,
  ): void {
    assertContext(context, "adopted", "method");
    context.addInitializer(function () {
      listen(this, "adopted", context.access.get(this));
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

export function attr<T extends HTMLElement, V>(
  transformer: Transformer<T, V>,
  options: AttrOptions = EMPTY_OBJ,
): ClassAccessorDecorator<T, V> {
  const isReflectiveAttribute = options.reflective !== false;
  // Enables early exits from the attributeChangedCallback for content attribute
  // updates that were caused by invoking IDL setters
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
      window[METADATA_KEY].observableAttributes.add(contentAttrName);
    }

    // If the attribute needs to be observed and the accessor initializes,
    // register the attribute handler callback with the current element
    // instance - this initializer is earliest we have access to the instance.
    if (isReflectiveAttribute) {
      context.addInitializer(function () {
        skipNextReaction.set(this, false);
        const attributeChangedCallback = function (
          this: T,
          evt: {
            name: string;
            oldValue: string | null;
            newValue: string | null;
          },
        ): void {
          if (evt.name !== contentAttrName || evt.newValue === evt.oldValue) {
            return; // skip irrelevant invocations
          }
          if (skipNextReaction.get(this) === true) {
            skipNextReaction.set(this, false);
            return; // skip attribute reaction caused by a setter
          }
          const oldValue = target.get.call(this);
          const newValue = transformer.parse.call(this, evt.newValue);
          if (newValue === NO_VALUE || transformer.eql(newValue, oldValue)) {
            return;
          }
          transformer.beforeSet.call(this, newValue, context);
          target.set.call(this, newValue);
          trigger(this, "prop", { name: context.name });
        };
        listen(this, "attr", attributeChangedCallback);
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
        // Initialize the transformer with the default value. If the attribute
        // is already set when the accessor initializes, we use the value from
        // it, but the transformer needs to be initialized first.
        const defaultValue = transformer.init.call(
          this,
          initAccessorInitialValue(this, contentAttrName, input),
          context,
        );
        // Use the already-existing attribute value when possible. If the
        // attribute does not exist or its value can't be parsed, fall back to
        // the default value from the initialization step.
        if (this.hasAttribute(contentAttrName)) {
          const attrValue = transformer.parse.call(
            this,
            this.getAttribute(contentAttrName),
          );
          if (attrValue !== NO_VALUE) {
            transformer.beforeSet.call(this, attrValue, context);
            return attrValue;
          }
        }
        return defaultValue;
      },
      set(input) {
        transformer.validate.call(this, input);
        const newValue = transformer.transform.call(this, input);
        const oldValue = target.get.call(this);
        if (transformer.eql(newValue, oldValue)) {
          return;
        }
        transformer.beforeSet.call(this, newValue, context);
        target.set.call(this, newValue);
        if (isReflectiveAttribute) {
          const updateAttr = transformer.updateContentAttr(oldValue, newValue);
          // If an attribute update is about to happen, the next
          // attributeChangedCallback must be skipped to prevent double calls of
          // @reactive methods
          if (updateAttr !== false) {
            skipNextReaction.set(this, true);
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
        trigger(this, "prop", { name: context.name });
      },
    };
  };
}

// Accessor decorator @prop() returns a normal accessor, but with validation and
// reactivity added.
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
        );
      },
      set(input) {
        transformer.validate.call(this, input);
        const newValue = transformer.transform.call(this, input);
        if (transformer.eql(newValue, target.get.call(this))) {
          return;
        }
        transformer.beforeSet.call(this, newValue, context);
        target.set.call(this, newValue);
        trigger(this, "prop", { name: context.name });
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
  window[METADATA_KEY].debouncedMethods.set(debouncedMethod, originalMethod);
  return debouncedMethod;
}

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
