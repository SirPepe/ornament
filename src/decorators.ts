import { listen, trigger } from "./bus.js";
import { NO_VALUE } from "./lib.js";
import { getMetadataFromContext } from "./metadata.js";
import {
  type Transformer,
  type ClassAccessorDecorator,
  type Method,
  assertContext,
  NonOptional,
} from "./types.js";

// Explained in @enhance()
const INITIALIZER_KEY: unique symbol = Symbol.for("ORNAMENT_INITIALIZER_KEY");
const INITIALIZED_BY: unique symbol = Symbol.for("ORNAMENT_INITIALIZED_BY");

// Un-clobber an accessor's name if the element upgrades after a property with
// a matching name has already been set ("safe upgrade").
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

// Tracks internals to, on one hand, make them available to multiple parts of
// the library and on the other hand expose the same API (with the same
// constraints, eg. attachInternals() can only be called once) to component
// classes. ORNAMENT_INTERNALS_KEY and ORNAMENT_ATTACH_INTERNALS_CALLED are
// symbols rather than private fields to a) allow multiple bundles of ornament
// to work together and b) prevent private field access error under more
// convoluted circumstances (see test suite)
const ORNAMENT_INTERNALS_KEY: unique symbol = Symbol.for(
  "ORNAMENT_INTERNALS_KEY",
);
const ORNAMENT_ATTACH_INTERNALS_CALLED = Symbol.for(
  "ORNAMENT_ATTACH_INTERNALS_CALLED",
);
export function getInternals(instance: HTMLElement): ElementInternals {
  const existingInternals = (instance as any)[ORNAMENT_INTERNALS_KEY];
  if (existingInternals) {
    return existingInternals;
  }
  const newInternals = HTMLElement.prototype.attachInternals.call(instance);
  (instance as any)[ORNAMENT_INTERNALS_KEY] = newInternals;
  return newInternals;
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
      // Instances will most likely end up with a few extra class fields like
      // [ORNAMENT_EVENT_BUS_KEY] and [ORNAMENT_INTERNALS_KEY] containing
      // the event target for the event bus and the ElementInternals. But
      // because these fields may need to be accessed before the class
      // declarations, including this code, finish initializing (or they may be
      // never needed), relevant functions just slap them on instances if and
      // when they become important. And because TypeScript can't do anything
      // with the mixin class type, there is no *real* reason to have any code
      // related to the event targets or internals storage here, but *if* TS
      // worked as advertised, the lines below would accurately describe the
      // observable effects the program has:
      // [ORNAMENT_EVENT_BUS_KEY]!: EventTarget;
      // [ORNAMENT_INTERNALS_KEY]!: ElementInternals;
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
        return [
          ...originalObservedAttributes,
          ...getMetadataFromContext(context).attr.keys(),
        ];
      }

      // Same API as the original attachInternals(), but allows the rest of the
      // library to liberally access internals via getInternals().
      [ORNAMENT_ATTACH_INTERNALS_CALLED] = false;
      attachInternals(): ElementInternals {
        if (this[ORNAMENT_ATTACH_INTERNALS_CALLED]) {
          throw new Error(
            "ElementInternals for the specified element was already attached",
          );
        }
        this[ORNAMENT_ATTACH_INTERNALS_CALLED] = true;
        return getInternals(this);
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
// init callback handling. The custom element registry is customizable to
// support eg. SSR with JSDOM.
export function define<T extends CustomElementConstructor>(
  tagName: string,
  options: ElementDefinitionOptions = {},
  registry = window.customElements,
): (target: T, context: ClassDecoratorContext<T>) => T {
  return function (target: T, context: ClassDecoratorContext<T>): T {
    assertContext(context, "define", "class");
    getMetadataFromContext(context).tagName = tagName;

    // Define the custom element after all other decorators have been applied
    context.addInitializer(function () {
      registry.define(tagName, this, options);
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
    | ClassFieldDecoratorContext<T, any>
    | ClassAccessorDecoratorContext<T, any>,
>(context: C, initializer: (instance: T) => void): void {
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
      (getMetadataFromContext(context).method.get(method) ?? method).call(
        instance,
      );
    });
  };
}

type ReactiveOptions<T> = {
  keys?: (string | symbol)[];
  excludeKeys?: (string | symbol)[];
  predicate?: (
    this: T,
    key: string | symbol,
    value: any,
    instance: T,
  ) => boolean;
};

type ReactiveDecorator<T extends HTMLElement> = {
  (
    _: unknown,
    context: ClassMethodDecoratorContext<T, (this: T) => void>,
  ): void;
  (_: unknown, context: ClassFieldDecoratorContext<T, (this: T) => void>): void;
};

export function reactive<T extends HTMLElement>(
  options: ReactiveOptions<T> = {},
): ReactiveDecorator<T> {
  return function (_, context) {
    assertContext(context, "reactive", "method/function");
    // Start listening only once the element's constructor has run to
    // completion. This prevents prop set-up in the constructor from triggering
    // reactive methods.
    runContextInitializerOnOrnamentInit(context, (instance: T): void => {
      listen(instance, "prop", (name, newValue) => {
        if (
          (!options.predicate ||
            options.predicate.call(instance, name, newValue, instance)) &&
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

type EventSubscribeOptionsWithoutTransform<
  T,
  E extends Event,
> = AddEventListenerOptions &
  SubscribeBaseOptions & {
    predicate?: (this: T, event: E, instance: T) => boolean;
  };

type EventSubscribeOptionsWithTransform<
  T,
  E extends Event,
  V,
> = EventSubscribeOptionsWithoutTransform<T, E> & {
  transform: (this: T, value: E, instance: T) => V;
};

type SignalSubscribeOptions<T, V, U> = SubscribeBaseOptions & {
  transform?: (this: T, value: V, instance: T) => U;
  predicate?: (this: T, value: V, instance: T) => boolean;
};

type EventSubscribeDecorator<T, V> = (
  value: unknown,
  context:
    | ClassMethodDecoratorContext<T, Method<T, [V]>>
    | ClassFieldDecoratorContext<T, Method<T, [V]>>
    | ClassAccessorDecoratorContext<T, V>,
) => void;

type EventTargetOrFactory<T, U extends EventTarget> =
  | U
  | ((instance: T) => EventTargetOrFactory<T, U>)
  | Promise<EventTargetOrFactory<T, U>>;

type SignalSubscribeDecorator<T, V> = (
  value: unknown,
  context:
    | ClassMethodDecoratorContext<T, Method<T, [V]>>
    | ClassFieldDecoratorContext<T, Method<T, [V]>>
    | ClassAccessorDecoratorContext<T, V>,
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
  S extends EventTarget,
  V extends Event,
  U,
>(
  context:
    | ClassMethodDecoratorContext<T, Method<T, [U]>>
    | ClassFieldDecoratorContext<T, Method<T, [U]>>
    | ClassAccessorDecoratorContext<T, U>,
  targetOrFactory: EventTargetOrFactory<T, S>,
  eventNames: string,
  options: NonOptional<
    EventSubscribeOptionsWithTransform<T, V, U>,
    "activateOn" | "activateOn" | "transform"
  >,
): void {
  return runContextInitializerOnOrnamentInit(context, (instance: T) => {
    const callback = (originalEvent: V) => {
      if (
        !options.predicate ||
        options.predicate.call(instance, originalEvent, instance)
      ) {
        const transformedValue = options.transform.call(
          instance,
          originalEvent,
          instance,
        );
        if (context.kind === "accessor") {
          context.access.set(instance, transformedValue);
        } else {
          context.access.get(instance).call(instance, transformedValue);
        }
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

function subscribeToSignal<T extends HTMLElement, S extends SignalLike<any>, U>(
  context:
    | ClassMethodDecoratorContext<T, Method<T, [U]>>
    | ClassFieldDecoratorContext<T, Method<T, [U]>>
    | ClassAccessorDecoratorContext<T, U>,
  target: S,
  options: NonOptional<
    SignalSubscribeOptions<T, SignalType<S>, U>,
    "activateOn" | "activateOn" | "transform"
  >,
): void {
  return runContextInitializerOnOrnamentInit(context, (instance: T) => {
    const callback = (originalValue: SignalType<S>) => {
      if (
        !options.predicate ||
        options.predicate.call(instance, originalValue, instance)
      ) {
        const transformedValue = options.transform.call(
          instance,
          originalValue,
          instance,
        );
        if (context.kind === "accessor") {
          context.access.set(instance, transformedValue);
          trigger(instance, "prop", context.name, transformedValue);
        } else {
          context.access.get(instance).call(instance, transformedValue);
        }
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

// Overload 1.1: signal without transform
export function subscribe<T extends HTMLElement, S extends SignalLike<any>>(
  target: S,
  options?: SignalSubscribeOptions<T, SignalType<S>, SignalType<S>>,
): SignalSubscribeDecorator<T, SignalType<S>>;
// Overload 1.2: signal with transform SignalType<S> -> U
export function subscribe<T extends HTMLElement, S extends SignalLike<any>, U>(
  target: S,
  options?: SignalSubscribeOptions<T, SignalType<S>, U>,
): SignalSubscribeDecorator<T, U>;
// Overload 2.1: Event target without transform
export function subscribe<
  T extends HTMLElement,
  U extends EventTarget,
  E extends Event,
>(
  targetOrFactory: EventTargetOrFactory<T, U>,
  names: string,
  options?: EventSubscribeOptionsWithoutTransform<T, E>,
): EventSubscribeDecorator<T, E>;
// Overload 2.2: Event target with transform
export function subscribe<
  T extends HTMLElement,
  U extends EventTarget,
  E extends Event,
  R,
>(
  targetOrFactory: EventTargetOrFactory<T, U>,
  names: string,
  options: EventSubscribeOptionsWithTransform<T, E, R>,
): EventSubscribeDecorator<T, R>;
// Implementation, thanks to too many overloads without much of any internal
// type safety. Hooray for flexibility...
export function subscribe<T extends HTMLElement>(
  targetOrFactory: SignalLike<any> | EventTargetOrFactory<T, any>,
  namesOrOptions?:
    | EventSubscribeOptionsWithTransform<T, any, any>
    | EventSubscribeOptionsWithoutTransform<T, any>
    | SignalSubscribeOptions<T, any, any>
    | string,
  options:
    | EventSubscribeOptionsWithTransform<T, any, any>
    | EventSubscribeOptionsWithoutTransform<T, any>
    | undefined = {},
): SignalSubscribeDecorator<T, any> | EventSubscribeDecorator<T, any> {
  return function (
    _: unknown,
    context:
      | ClassMethodDecoratorContext<T, any>
      | ClassFieldDecoratorContext<T, any>
      | ClassAccessorDecoratorContext<T, any>,
  ): void {
    assertContext(context, "subscribe", "method/function/accessor");
    // Arguments for subscribing to an event target
    if (
      (typeof targetOrFactory === "function" ||
        targetOrFactory instanceof EventTarget ||
        "then" in targetOrFactory) &&
      typeof namesOrOptions === "string"
    ) {
      return subscribeToEventTarget(context, targetOrFactory, namesOrOptions, {
        transform: (value) => value,
        activateOn: ["init", "connected"],
        deactivateOn: ["disconnected"],
        ...options,
      });
    }
    // Arguments for subscribing to a signal
    if (
      isSignalLike(targetOrFactory) &&
      (typeof namesOrOptions === "object" ||
        typeof namesOrOptions === "undefined")
    ) {
      return subscribeToSignal(context, targetOrFactory, {
        transform: (value) => value,
        activateOn: ["init", "connected"],
        deactivateOn: ["disconnected"],
        ...namesOrOptions,
      });
    }
    throw new Error("Invalid arguments to @subscribe");
  };
}

type ObserveBaseOptions<T, O extends ObserverCtor1 | ObserverCtor2> = {
  activateOn?: (keyof OrnamentEventMap)[]; // defaults to ["init", "connected"]
  deactivateOn?: (keyof OrnamentEventMap)[]; // defaults to ["disconnected"]
  predicate?: (
    this: T,
    instance: T,
    entries: Parameters<ConstructorParameters<O>[0]>[0],
    observer: Parameters<ConstructorParameters<O>[0]>[1],
  ) => boolean;
};

// IntersectionObserver, ResizeObserver
type ObserverCtor1 = new (
  callback: (entries: unknown[], observer: InstanceType<ObserverCtor1>) => void,
  options: any,
) => {
  observe: (target: HTMLElement) => void;
  disconnect: () => void;
};

// MutationObserver
type ObserverCtor2 = new (
  callback: (entries: unknown[], observer: InstanceType<ObserverCtor2>) => void,
) => {
  observe: (target: HTMLElement, options: any) => void;
  disconnect: () => void;
};

type ObserveMethodDecorator<T extends HTMLElement, A extends unknown[]> = {
  (
    _: unknown,
    context: ClassMethodDecoratorContext<T, (this: T, ...args: A) => void>,
  ): void;
  (
    _: unknown,
    context: ClassFieldDecoratorContext<T, (this: T, ...args: A) => void>,
  ): void;
};

export function observe<T extends HTMLElement, O extends ObserverCtor1>(
  Ctor: O,
  options?: ObserveBaseOptions<T, O> & ConstructorParameters<O>[1],
): ObserveMethodDecorator<T, Parameters<ConstructorParameters<O>[0]>>;
export function observe<T extends HTMLElement, O extends ObserverCtor2>(
  Ctor: O,
  options?: ObserveBaseOptions<T, O> &
    Parameters<InstanceType<O>["observe"]>[1],
): ObserveMethodDecorator<T, Parameters<ConstructorParameters<O>[0]>>;
export function observe<
  T extends HTMLElement,
  O extends ObserverCtor1 | ObserverCtor2,
>(
  Ctor: O,
  options: ObserveBaseOptions<T, O> = {},
): ObserveMethodDecorator<T, unknown[]> {
  options.activateOn ??= ["init", "connected"];
  options.deactivateOn ??= ["disconnected"];
  return function (
    _: unknown,
    context:
      | ClassMethodDecoratorContext<T, (this: T, ...args: unknown[]) => void>
      | ClassFieldDecoratorContext<T, (this: T, ...args: unknown[]) => void>,
  ) {
    assertContext(context, "observe", "method/function");
    return runContextInitializerOnOrnamentInit(context, (instance: T) => {
      const observer = new Ctor((entries, observer) => {
        if (
          !options.predicate ||
          options.predicate.call(instance, instance, entries, observer)
        ) {
          context.access.get(instance).call(instance, entries, observer);
        }
      }, options);
      if (options.activateOn?.includes("init")) {
        observer.observe(instance, options);
      }
      options.activateOn?.forEach((oEvent) =>
        listen(instance, oEvent, () => observer.observe(instance, options)),
      );
      options.deactivateOn?.forEach((oEvent) =>
        listen(instance, oEvent, () => observer.disconnect()),
      );
    });
  };
}

type LifecycleDecorator<T extends HTMLElement, A extends unknown[]> = {
  (
    _: unknown,
    context: ClassMethodDecoratorContext<T, (this: T, ...args: A) => void>,
  ): void;
  (
    _: unknown,
    context: ClassFieldDecoratorContext<T, (this: T, ...args: A) => void>,
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
  options: AttrOptions = {},
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
          "Content attribute names must not be symbols or private. Provide the `as` option and a public facade for your accessor or use a regular property name instead of a symbol.",
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
    getMetadataFromContext(context).attr.set(contentAttrName, {
      prop: idlAttrName,
      transformer,
    });

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

type StateOptions<T, V> = {
  name?: string; // defaults to the accessor's name
  toBoolean?: (this: T, value: V, instance: T) => boolean; // defaults to Boolean
};

// The accessor decorator @state() controls a custom state set entry
export function state<T extends HTMLElement, V>(
  options: StateOptions<T, V> = {},
): ClassAccessorDecorator<T, V> {
  return function (target, context): ClassAccessorDecoratorResult<T, V> {
    assertContext(context, "state", "accessor");
    const { name = context.name, toBoolean = Boolean } = options;
    if (typeof name === "symbol") {
      throw new TypeError(
        "Custom state set values can not be symbols. Provide a string name for your accessor's custom state field or use a regular property name instead of a symbol.",
      );
    }
    return {
      init(input) {
        if (toBoolean.call(this, input, this)) {
          getInternals(this).states.add(name);
        } else {
          getInternals(this).states.delete(name);
        }
        return input;
      },
      set(input) {
        if (toBoolean.call(this, input, this)) {
          getInternals(this).states.add(name);
        } else {
          getInternals(this).states.delete(name);
        }
        target.set.call(this, input);
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
    getMetadataFromContext(context).prop.set(context.name, {
      prop: context.name,
      transformer,
    });
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
  F extends (this: T, ...args: any[]) => void,
> = {
  fn?: (
    cb: (this: T, ...args: Parameters<F>) => void,
  ) => (this: T, ...args: Parameters<F>) => void;
};

type DebounceDecorator<
  T extends object,
  F extends (this: T, ...args: any[]) => void,
> = (
  value: F | undefined,
  context: ClassMethodDecoratorContext<T, F> | ClassFieldDecoratorContext<T, F>,
) => void;

export function debounce<
  T extends object,
  F extends (this: T, ...args: any[]) => void,
>(options: DebounceOptions<T, F> = {}): DebounceDecorator<T, F> {
  const fn = options.fn ?? debounce.raf();
  return function (
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
        getMetadataFromContext(context).method.set(debounced, func);
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
        getMetadataFromContext(context).method.set(debounced, func);
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

debounce.asap = function <T extends object, A extends unknown[]>(): (
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

debounce.raf = function <T extends object, A extends unknown[]>(): (
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

debounce.timeout = function <T extends object, A extends unknown[]>(
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
