import { listen, trigger } from "./bus.js";
import { EMPTY_OBJ, NO_VALUE } from "./lib.js";
import {
  type Transformer,
  type ClassAccessorDecorator,
  type Method,
  assertContext,
} from "./types.js";

const META_IS_ENHANCED: unique symbol = Symbol();
const META_ATTRIBUTES: unique symbol = Symbol();
const META_DEBOUNCED_METHODS: unique symbol = Symbol();
const META_UNSUBSCRIBE: unique symbol = Symbol();

type Metadata = {
  [META_ATTRIBUTES]: { context: any; value: Set<string> };
  [META_DEBOUNCED_METHODS]: {
    context: HTMLElement;
    value: WeakMap<Method<any, any>, Method<any, any>>;
  };
  [META_UNSUBSCRIBE]: { context: any; value: FinalizationRegistry<() => void> };
};

// Decorator Metadata does not work reliably in babel. The workaround is to use
// a bunch of weak maps and have the API of getMetadata be compatible with both
// decorator metadata and the current workaround, more or less.

// This should really be split on a class-by-class basis, but the @attr()
// decorator has no context without decorator metadata. The list of observable
// attributes must be available before the accessor initializers run, so the
// only way forward is to observe every attribute defined by @attr() on all
// classes.
const ALL_ATTRIBUTES = new Set<string>();

// Scoped by component instance
const ALL_DEBOUNCED_METHODS = new WeakMap<any, WeakMap<Method<any, any>, Method<any, any>>>(); // eslint-disable-line

// Global, just like the attributes
const UNSUBSCRIBE_REGISTRY = new FinalizationRegistry<() => void>((f) => f());

// Can be rewritten to support Decorator metadata once that's fixed.
function getMetadata<K extends keyof Metadata>(
  context: Metadata[K]["context"],
  key: K,
): Metadata[K]["value"] {
  if (key === META_ATTRIBUTES) {
    return ALL_ATTRIBUTES as any;
  }
  if (key === META_DEBOUNCED_METHODS) {
    let methodMap = ALL_DEBOUNCED_METHODS.get(context);
    if (!methodMap) {
      methodMap = new WeakMap();
      ALL_DEBOUNCED_METHODS.set(context, methodMap);
    }
    return methodMap as any;
  }
  return UNSUBSCRIBE_REGISTRY as any;
}

// Marks an instance as initialized. This is useful for non-enhanced subclasses
// of an enhanced class that will miss the actual init event, but can use this
// value to figure out whether that is indeed the case.
const IS_INITIALIZED: unique symbol = Symbol();

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
    // be re-installed. A metadata flag indicates whether the class already has
    // had the mixin applied to it
    if ((target as any)[META_IS_ENHANCED]) {
      return target;
    }

    const originalObservedAttributes = new Set<string>(
      (target as any).observedAttributes ?? [],
    );

    // Installs the mixin class. This kindof changes the type of the input
    // constructor T, but as TypeScript can as of May 2024 not understand
    // decorators that change their target's types, we don't bother. The changes
    // are extremely small anyway and the only publicly visible changes affect
    // lifecycle callbacks, which are de facto public, but not meant to be
    // "public" as commonly understood by TypeScript (or anyone, really).
    // See https://github.com/microsoft/TypeScript/issues/51347
    return class extends target {
      // Instances will most likely end up with an field [BUS_TARGET] containing
      // the event target for the event bus. But because these targets may be
      // needed before the class declarations, including this code, finish
      // initializing (or they may be never needed), the event bus functions
      // just slap them on instances if and when they become important. And
      // because TypeScript can't do anything with the mixin class type, there
      // is no *real* reason to have any code related to the event targets here,
      // but if TS worked as advertised, the line below would accurately
      // describe the observable effects the program has:
      // [EVENT_BUS_TARGET]!: EventTarget; // this is entirely useless
      // May 2024: a workaround for a plugin ordering issue in babel requires
      // the line above to be commented out. See the entire thread at
      // https://github.com/babel/babel/issues/16373#issuecomment-2017480546

      // Indicates that the instance has had its init event triggered at the end
      // of the constructor.
      [IS_INITIALIZED] = false;

      constructor(...args: any[]) {
        super(...args);
        trigger(this, "init");
        this[IS_INITIALIZED] = true;
      }

      static get observedAttributes(): string[] {
        return [
          ...originalObservedAttributes,
          ...getMetadata(context, META_ATTRIBUTES),
        ];
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

// Registers function to run when the context initializer and ornament's init
// event have both run.
function runContextInitializerOnOrnamentInit<
  T extends HTMLElement,
  C extends ClassMethodDecoratorContext<T, any> | ClassFieldDecoratorContext<T, any>, // eslint-disable-line
>(context: C, initializer: (instance: T) => any): void {
  context.addInitializer(function (this: T) {
    // Init event has already happened, call initializer function ASAP
    if ((this as any)[IS_INITIALIZED] === true) {
      initializer(this);
      return;
    }
    // Init event has not happened yet, register the initializer for the event
    listen(this, "init", () => initializer(this), { once: true });
  });
}

// Method/class fields decorator @init() runs a method or class field function
// once an instance initializes.
export function init<T extends HTMLElement>(): LifecycleDecorator<T, OrnamentEventMap["init"]> { // eslint-disable-line
  return function (_, context): void {
    assertContext(context, "init", ["method", "field-function"]);
    runContextInitializerOnOrnamentInit(context, (instance: T): void => {
      const method = context.access.get(instance);
      (
        getMetadata(instance, META_DEBOUNCED_METHODS).get(method) ?? method
      ).call(instance);
    });
  };
}

type ReactiveOptions<T> = {
  keys?: (string | symbol)[];
  excludeKeys?: (string | symbol)[];
  predicate?: (instance: T) => boolean;
};

type ReactiveDecorator<T extends HTMLElement> = {
  (_: unknown, context: ClassMethodDecoratorContext<T, (this: T) => any>): void;
  (_: unknown, context: ClassFieldDecoratorContext<T, (this: T) => any>): void;
};

export function reactive<T extends HTMLElement>(
  options: ReactiveOptions<T> = EMPTY_OBJ,
): ReactiveDecorator<T> {
  return function (_, context) {
    assertContext(context, "reactive", ["method", "field-function"]);
    // Start listening only once the element's constructor has run to
    // completion. This prevents prop set-up in the constructor from triggering
    // reactive methods.
    runContextInitializerOnOrnamentInit(context, (instance: T): void => {
      listen(instance, "prop", (name) => {
        if (
          (!options.predicate || options.predicate(instance)) &&
          (!options.keys || options.keys.includes(name)) &&
          (!options.excludeKeys || !options.excludeKeys.includes(name))
        ) {
          context.access.get(instance).call(instance);
        }
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
  value: unknown,
  context: ClassMethodDecoratorContext<T, Method<T, [E]>> | ClassFieldDecoratorContext<T, Method<T, [E]>>, // eslint-disable-line
) => void;

type EventTargetFactory<T, E extends EventTarget = EventTarget> = (
  instance: T,
) => E;

type SignalSubscribeDecorator<T> = (
  value: unknown,
  context: ClassMethodDecoratorContext<T> | ClassFieldDecoratorContext<T>,
) => void;

type SignalLike<T> = {
  subscribe(callback: () => void): () => void;
  value: T;
};

type SignalType<T> = T extends SignalLike<infer V> ? V : any;

const isSignalLike = (value: unknown): value is SignalLike<any> =>
  !!value &&
  typeof value === "object" &&
  "subscribe" in value &&
  typeof value.subscribe === "function";

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
  targetOrFactory: EventTarget | EventTargetFactory<any> | SignalLike<any>,
  eventsOrOptions?: SubscribeOptions<T, any> | string,
  options: SubscribeOptions<T, any> = EMPTY_OBJ,
): EventSubscribeDecorator<T, any> | SignalSubscribeDecorator<T> {
  return function (
    _: unknown,
    context: ClassMethodDecoratorContext<T, Method<T, [any]>> | ClassFieldDecoratorContext<T, Method<T, [any]>>, // eslint-disable-line
  ): void {
    assertContext(context, "subscribe", ["method", "field-function"]);
    // Arguments for subscribing to an event target
    if (
      (typeof targetOrFactory === "function" ||
        targetOrFactory instanceof EventTarget) &&
      typeof eventsOrOptions === "string"
    ) {
      return runContextInitializerOnOrnamentInit(context, (instance: T) => {
        const callback = (evt: any) => {
          if (!options.predicate || options.predicate(instance, evt)) {
            context.access.get(instance).call(instance, evt);
          }
        };
        const target =
          typeof targetOrFactory === "function"
            ? targetOrFactory(instance)
            : targetOrFactory;
        for (const eventName of eventsOrOptions.trim().split(/\s+/)) {
          getMetadata(context, META_UNSUBSCRIBE).register(instance, () =>
            target.removeEventListener(eventName, callback, options as any),
          );
          target.addEventListener(eventName, callback, options as any);
        }
      });
    }
    // Arguments for subscribing to a signal
    if (
      isSignalLike(targetOrFactory) &&
      (typeof eventsOrOptions === "object" ||
        typeof eventsOrOptions === "undefined")
    ) {
      return runContextInitializerOnOrnamentInit(context, (instance: T) => {
        const value = context.access.get(instance);
        const cancel = targetOrFactory.subscribe(() => {
          if (
            !eventsOrOptions?.predicate ||
            eventsOrOptions.predicate(instance, targetOrFactory.value)
          ) {
            value.call(instance, targetOrFactory);
          }
        });
        getMetadata(context, META_UNSUBSCRIBE).register(instance, cancel);
      });
    }
    throw new Error("Invalid arguments to @subscribe");
  };
}

type LifecycleDecorator<T extends HTMLElement, A extends any[]> = {
  (
    _: unknown,
    context: ClassMethodDecoratorContext<T, (this: T, ...args: A) => any>,
  ): void;
  (
    _: unknown,
    context: ClassFieldDecoratorContext<T, (this: T, ...args: A) => any>,
  ): void;
};

function createLifecycleDecorator<K extends keyof OrnamentEventMap>(
  name: K,
): <T extends HTMLElement>() => LifecycleDecorator<T, OrnamentEventMap[K]> {
  return <T extends HTMLElement>(): LifecycleDecorator<T, OrnamentEventMap[K]> => // eslint-disable-line
    function (_, context) {
      assertContext(context, name, ["method", "field-function"]);
      context.addInitializer(function () {
        listen(this, name, (...args) =>
          context.access.get(this).call(this, ...args),
        );
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
  as?: string; // defaults to the accessor's name
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
      if (!options.as) {
        throw new TypeError(
          "Content attribute names must not be symbols or private. Provide the `as` option and a public facade for your accessor or use a regular property name.",
        );
      }
      contentAttrName = idlAttrName = options.as;
    } else {
      contentAttrName = options.as ?? context.name;
      idlAttrName = context.name;
    }

    // Add the name to the set of all observed attributes, even if "reflective"
    // if false. The content attribute must in all cases be observed to enable
    // the message bus to emit events.+
    getMetadata(context, META_ATTRIBUTES).add(contentAttrName);

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

// The class field/method decorator @debounce() debounces functions and consists
// primarily of TypeScript bullshit.

type DebounceOptions<
  T extends object,
  F extends (this: T, ...args: any[]) => any,
> = {
  fn?: (
    cb: (this: T, ...args: Parameters<F>) => void,
  ) => (this: T, ...args: Parameters<F>) => void;
};

type DebounceDecorator<
  T extends object,
  F extends (this: T, ...args: any[]) => any,
> = (
  value: F | undefined,
  context: ClassMethodDecoratorContext<T, F> | ClassFieldDecoratorContext<T, F>,
) => void;

export function debounce<
  T extends object,
  F extends (this: T, ...args: any[]) => any,
>(options: DebounceOptions<T, F> = EMPTY_OBJ): DebounceDecorator<T, F> {
  const fn = options.fn ?? debounce.raf();
  return function decorator(
    value: F | undefined,
    context: ClassMethodDecoratorContext<T, F> | ClassFieldDecoratorContext<T, F>, // eslint-disable-line
  ): F | void {
    assertContext(context, "debounce", ["method", "field-function"], true);
    if (context.kind === "field") {
      return context.addInitializer(function (): void {
        const func = context.access.get(this);
        const debounced = fn(func).bind(this);
        getMetadata(this as any, META_DEBOUNCED_METHODS).set(debounced, func);
        context.access.set(this, debounced as F);
      });
    }
    // if it's not a field decorator, it must be a method decorator (and value
    // can only be a non-undefined method definition, that we can replace with
    // a debounced equivalent)
    const func = value as F;
    const debounced = fn(func);
    if (!context.static) {
      context.addInitializer(function (): void {
        getMetadata(this as any, META_DEBOUNCED_METHODS).set(debounced, func);
      });
    }
    return debounced as F;
  };
}

// The following debouncing services for both methods and function class fields.
// In latter case, storing the cancel functions on a per-instance-basis in a
// WeakMap is overkill, but for methods (where multiple instances share the same
// function object) this is just right.
const KEY_TO_USE_WHEN_THIS_IS_UNDEFINED = Symbol(); // for bound functions

debounce.asap = function <T extends object, A extends any[]>(): (
  original: (this: T, ...args: A) => void,
) => (this: T, ...args: A) => void {
  return function (
    original: (this: T, ...args: A) => void,
  ): (this: T, ...args: A) => void {
    const handles = new WeakMap<T | symbol, symbol>();
    return function (this: T, ...args: A): void {
      const token = Symbol();
      handles.set(this ?? KEY_TO_USE_WHEN_THIS_IS_UNDEFINED, token);
      Promise.resolve().then(() => {
        if (handles.get(this ?? KEY_TO_USE_WHEN_THIS_IS_UNDEFINED) === token) {
          original.call(this, ...args);
          handles.delete(this ?? KEY_TO_USE_WHEN_THIS_IS_UNDEFINED);
        }
      });
    };
  };
};

debounce.raf = function <T extends object, A extends any[]>(): (
  original: (this: T, ...args: A) => void,
) => (this: T, ...args: A) => void {
  return function (
    original: (this: T, ...args: A) => void,
  ): (this: T, ...args: A) => void {
    const handles = new WeakMap<T | symbol, number>();
    return function (this: T, ...args: A): void {
      const handle = handles.get(this ?? KEY_TO_USE_WHEN_THIS_IS_UNDEFINED);
      if (handle) {
        cancelAnimationFrame(handle);
        handles.delete(this ?? KEY_TO_USE_WHEN_THIS_IS_UNDEFINED);
      }
      handles.set(
        this ?? KEY_TO_USE_WHEN_THIS_IS_UNDEFINED,
        requestAnimationFrame(() => original.call(this, ...args)),
      );
    };
  };
};

debounce.timeout = function <T extends object, A extends any[]>(
  value: number,
): (original: (this: T, ...args: A) => void) => (this: T, ...args: A) => void {
  return function (
    original: (this: T, ...args: A) => void,
  ): (this: T, ...args: A) => void {
    const handles = new WeakMap<T | symbol, NodeJS.Timeout>();
    return function (this: T, ...args: A): void {
      const handle = handles.get(this ?? KEY_TO_USE_WHEN_THIS_IS_UNDEFINED);
      if (handle) {
        clearTimeout(handle);
        handles.delete(this ?? KEY_TO_USE_WHEN_THIS_IS_UNDEFINED);
      }
      handles.set(
        this ?? KEY_TO_USE_WHEN_THIS_IS_UNDEFINED,
        setTimeout(() => original.call(this, ...args), value),
      );
    };
  };
};
