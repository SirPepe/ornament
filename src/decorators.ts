import { listen, trigger } from "./bus.js";
import { EMPTY_OBJ, NO_VALUE } from "./lib.js";
import {
  type Transformer,
  type ClassAccessorDecorator,
  type Method,
  assertContext,
  EventOf,
} from "./types.js";

// Decorator Metadata does as of June 2024 not work reliably in Babel. Therefore
// metadata in this module is a bunch of manually managed WeakMaps until Babel's
// issues are fixed. The first bit of metadata maps debounced methods to their
// originals, scoped by component instance. This is required to make @init()
// calls run synchronously, even if @debounce() was applied to the method in
// question.
const ALL_DEBOUNCED_METHODS = new WeakMap<
  object,
  WeakMap<Method<any, any>, Method<any, any>>
>();

// This should really be scoped on a class-by-class basis, but the @attr()
// decorator has no context without decorator metadata (which, again, is too
// unreliable in Babel as of June 2024). The list of observable attributes must
// be available before the accessor initializers run, so the only way forward is
// to observe every attribute defined by @attr() on all classes.
const ALL_ATTRIBUTES = new Set<string>();

// Can be rewritten to support decorator metadata once that's fixed.
function getMetadata(key: "attributes"): Set<string>;
function getMetadata(
  key: "methods",
  context: object,
): WeakMap<Method<any, any>, Method<any, any>>;
function getMetadata(key: "attributes" | "methods", context?: any): any {
  if (key === "attributes") {
    return ALL_ATTRIBUTES;
  }
  let methodMap = ALL_DEBOUNCED_METHODS.get(context);
  if (!methodMap) {
    methodMap = new WeakMap();
    ALL_DEBOUNCED_METHODS.set(context, methodMap);
  }
  return methodMap;
}

// Explained in @enhance()
const INITIALIZER_KEY: unique symbol = Symbol();
const INITIALIZED_BY: unique symbol = Symbol();

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

    // "initializerKey" is the key for the mixin class this call to @enhance()
    // creates. The key is stored as a static field [INITIALIZER_KEY] on the
    // mixin class and is set as an instance field [INITIALIZED_BY] by the class
    // constructor. When the constructor emits the "init" event, handlers can
    // compare the instance and instance.constructor's key to identify the
    // outermost (and therefore final) class constructor - any by proxy the
    // actual (last) init event.
    const initializerKey = Symbol();

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

      static [INITIALIZER_KEY] = initializerKey;
      [INITIALIZED_BY]: symbol | undefined = undefined;

      constructor(...args: any[]) {
        super(...args);
        this[INITIALIZED_BY] = initializerKey;
        trigger(this, "init");
      }

      static get observedAttributes(): string[] {
        return [...originalObservedAttributes, ...getMetadata("attributes")];
      }

      connectedCallback(): void {
        // The base class may or may not have its own connectedCallback, but the
        // type CustomElementConstructor does not reflect that. TS won't allow
        // us to access the property speculatively, so we need to tell it to
        // shut up (and tell eslint to shut up about about @ts-ignore). The same
        // holds true for all the other lifecycle callbacks.
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

// Registers function to run when the context initializer AND ornament's init
// event (for the last relevant constructor in the stack) have both run.
function runContextInitializerOnOrnamentInit<
  T extends HTMLElement,
  C extends
    | ClassMethodDecoratorContext<T, any>
    | ClassFieldDecoratorContext<T, any>,
>(context: C, initializer: (instance: T) => any): void {
  context.addInitializer(function (this: any) {
    // The (last) init event has already happened, call initializer function
    // immediately
    if (this[INITIALIZED_BY] === this.constructor[INITIALIZER_KEY]) {
      return initializer(this);
    }
    // Init event has not happened yet, register the initializer for the (last)
    // init event
    listen(this, "init", () => {
      if (this[INITIALIZED_BY] === this.constructor[INITIALIZER_KEY]) {
        initializer(this);
      }
    });
  });
}

// Method/class fields decorator @init() runs a method or class field function
// once an instance initializes (= the outermost constructor finishes).
export function init<T extends HTMLElement>(): LifecycleDecorator<
  T,
  OrnamentEventMap["init"]
> {
  return function (_, context): void {
    assertContext(context, "init", "method/function");
    runContextInitializerOnOrnamentInit(context, (instance: T): void => {
      const method = context.access.get(instance);
      (getMetadata("methods", instance).get(method) ?? method).call(instance);
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
    assertContext(context, "reactive", "method/function");
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

type SubscribeBaseOptions = {
  activateOn?: (keyof OrnamentEventMap)[]; // defaults to ["init", "connected"]
  deactivateOn?: (keyof OrnamentEventMap)[]; // defaults to ["disconnected"]
};

type EventSubscribeOptions<T, V extends Event> = AddEventListenerOptions &
  SubscribeBaseOptions & { predicate?: (instance: T, event: V) => boolean };
type SignalSubscribeOptions<T, V> = SubscribeBaseOptions & {
  predicate?: (instance: T, value: V) => boolean;
};

type EventSubscribeDecorator<T, E extends Event> = (
  value: unknown,
  context:
    | ClassMethodDecoratorContext<T, Method<T, [E]>>
    | ClassFieldDecoratorContext<T, Method<T, [E]>>,
) => void;

type EventTargetOrFactory<T, U extends EventTarget> =
  | U
  | ((instance: T) => EventTargetOrFactory<T, U>)
  | Promise<EventTargetOrFactory<T, U>>;

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

function unwrapTarget<T extends HTMLElement, U extends EventTarget>(
  targetOrFactory: EventTargetOrFactory<T, U>,
  context: T,
  continuation: (target: EventTarget) => void,
): void {
  if (typeof targetOrFactory === "function") {
    return unwrapTarget(targetOrFactory(context), context, continuation);
  }
  if ("then" in targetOrFactory) {
    targetOrFactory.then((x) => unwrapTarget(x, context, continuation));
    return;
  }
  continuation(targetOrFactory);
}

function subscribeToEventTarget<
  T extends HTMLElement,
  U extends EventTarget,
  V extends Event,
>(
  context:
    | ClassMethodDecoratorContext<T, Method<T, [V]>>
    | ClassFieldDecoratorContext<T, Method<T, [V]>>,
  targetOrFactory: EventTargetOrFactory<T, U>,
  eventNames: string,
  options: EventSubscribeOptions<T, V>,
): void {
  return runContextInitializerOnOrnamentInit(context, (instance: T) => {
    const callback = (evt: V) => {
      if (!options.predicate || options.predicate(instance, evt)) {
        context.access.get(instance).call(instance, evt);
      }
    };
    unwrapTarget(targetOrFactory, instance, (target) => {
      function on() {
        for (const eventName of eventNames.trim().split(/\s+/)) {
          target.addEventListener(eventName, callback as any, options);
        }
      }
      function off() {
        for (const eventName of eventNames.trim().split(/\s+/)) {
          target.removeEventListener(eventName, callback as any, options);
        }
      }
      if (options.activateOn?.includes("init")) {
        on();
      }
      options.activateOn?.forEach((oEvent) => listen(instance, oEvent, on));
      options.deactivateOn?.forEach((oEvent) => listen(instance, oEvent, off));
    });
  });
}

function subscribeToSignal<T extends HTMLElement, S extends SignalLike<any>>(
  context:
    | ClassMethodDecoratorContext<T, Method<T, [SignalType<S>]>>
    | ClassFieldDecoratorContext<T, Method<T, [SignalType<S>]>>,
  target: S,
  options: SignalSubscribeOptions<T, SignalType<S>>,
): void {
  return runContextInitializerOnOrnamentInit(context, (instance: T) => {
    const callback = (value: SignalType<S>) => {
      if (!options.predicate || options.predicate(instance, value)) {
        context.access.get(instance).call(instance, value);
      }
    };
    let cancel: null | (() => void) = null;
    function on() {
      if (!cancel) {
        cancel = target.subscribe(() => callback(target.value));
      }
    }
    function off() {
      if (cancel) {
        cancel = (cancel(), null);
      }
    }
    if (options.activateOn?.includes("init")) {
      on();
    }
    options.activateOn?.forEach((oEvent) => listen(instance, oEvent, on));
    options.deactivateOn?.forEach((oEvent) => listen(instance, oEvent, off));
  });
}

export function subscribe<T extends HTMLElement, S extends SignalLike<any>>(
  target: S,
  options?: SignalSubscribeOptions<T, SignalType<S>>,
): SignalSubscribeDecorator<T>;
export function subscribe<
  T extends HTMLElement,
  U extends EventTarget,
  N extends string,
  M = never,
>(
  targetOrFactory: EventTargetOrFactory<T, U>,
  names: N,
  options?: EventSubscribeOptions<T, EventOf<N, M>>,
): EventSubscribeDecorator<T, EventOf<N, M>>;
export function subscribe<T extends HTMLElement>(
  targetOrFactory: EventTargetOrFactory<T, any> | SignalLike<any>,
  namesOrOptions?:
    | EventSubscribeOptions<T, any>
    | SignalSubscribeOptions<T, any>
    | string,
  options:
    | EventSubscribeOptions<T, any>
    | SignalSubscribeOptions<T, any> = EMPTY_OBJ,
): EventSubscribeDecorator<T, any> | SignalSubscribeDecorator<T> {
  return function (
    _: unknown,
    context:
      | ClassMethodDecoratorContext<T, Method<T, [any]>>
      | ClassFieldDecoratorContext<T, Method<T, [any]>>,
  ): void {
    assertContext(context, "subscribe", "method/function");
    // Arguments for subscribing to an event target
    if (
      (typeof targetOrFactory === "function" ||
        targetOrFactory instanceof EventTarget ||
        "then" in targetOrFactory) &&
      typeof namesOrOptions === "string"
    ) {
      options.activateOn ??= ["init", "connected"];
      options.deactivateOn ??= ["disconnected"];
      return subscribeToEventTarget(
        context,
        targetOrFactory,
        namesOrOptions,
        options,
      );
    }
    // Arguments for subscribing to a signal
    if (
      isSignalLike(targetOrFactory) &&
      (typeof namesOrOptions === "object" ||
        typeof namesOrOptions === "undefined")
    ) {
      namesOrOptions ??= {};
      namesOrOptions.activateOn ??= ["init", "connected"];
      namesOrOptions.deactivateOn ??= ["disconnected"];
      return subscribeToSignal(context, targetOrFactory, namesOrOptions);
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
  return <T extends HTMLElement>(): LifecycleDecorator<
    T,
    OrnamentEventMap[K]
  > =>
    function (_, context) {
      assertContext(context, name, "method/function");
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
    // is false. The content attribute must in all cases be observed to enable
    // the message bus to emit events.
    getMetadata("attributes").add(contentAttrName);

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
        // Final sanity check: does a public API for this attribute exist? This
        // public API needs to be added manually for private or symbol accessors
        // and might have been forgotten.
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
          // @reactive() methods
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
    context:
      | ClassMethodDecoratorContext<T, F>
      | ClassFieldDecoratorContext<T, F>,
  ): F | void {
    assertContext(context, "debounce", "method/function", true);
    if (context.kind === "field") {
      return context.addInitializer(function (): void {
        const func = context.access.get(this);
        const debounced = fn(func).bind(this);
        getMetadata("methods", this).set(debounced, func);
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
        getMetadata("methods", this).set(debounced, func);
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
