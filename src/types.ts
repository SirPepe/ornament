import { NO_VALUE, isArray } from "./lib.js";

declare global {
  interface OrnamentEventMap {
    init: [];
    connected: [];
    disconnected: [];
    adopted: [];
    prop: [name: string | symbol, newValue: any];
    attr: [name: string, oldValue: string | null, newValue: string | null];
    formAssociated: [owner: HTMLFormElement | null];
    formReset: [];
    formDisabled: [disabled: boolean];
    formStateRestore: [
      state: string | File | FormData | null,
      reason: "autocomplete" | "restore",
    ];
  }
}

export type Optional<T> = {
  [P in keyof T]?: T[P] | undefined | null;
};

export type Transformer<
  T extends HTMLElement,
  Value,
  IntermediateValue = Value,
> = {
  // Validates and/or transforms a value before it is used to initialize the
  // accessor. Can also be used to run a side effect when the accessor
  // initializes. Defaults to the identity function.
  init: (
    this: T,
    value: Value,
    context: ClassAccessorDecoratorContext<T, Value>,
    isContentAttribute: boolean,
  ) => Value;
  // Turns content attribute values into IDL attribute values. Must never throw
  // exceptions, and instead always just deal with its input. Must not cause any
  // observable side effects. May return NO_VALUE in case the content attribute
  // can't be parsed, in which case the @attr() decorator must not change the
  // IDL attribute value
  parse: (this: T, value: string | null) => Value | typeof NO_VALUE;
  // Decides if setter inputs, which may be of absolutely any type, should be
  // accepted or rejected. Should throw for invalid values, just like setters on
  // built-in elements may. Must not cause any observable side effects.
  validate: (
    this: T,
    value: unknown,
    isContentAttribute: boolean,
  ) => asserts value is IntermediateValue;
  // Transforms values that were accepted by validate() into the proper type by
  // eg. clamping numbers, normalizing strings etc.
  transform: (this: T, value: IntermediateValue) => Value;
  // Turns IDL attribute values into content attribute values (strings), thereby
  // controlling the attribute representation of an accessor together with
  // updateContentAttr(). Must never throw, defaults to the String() function
  stringify: (this: T, value: Value) => string;
  // Determines whether a new attribute value is equal to the old value. If this
  // method returns true, reactive callbacks will not be triggered. Defaults to
  // simple strict equality (===).
  eql: (this: T, a: Value, b: Value) => boolean;
  // Optionally run a side effect immediately before the accessor's setter is
  // invoked. Required by the event transformer.
  beforeSet: (
    this: T,
    value: Value,
    context: ClassAccessorDecoratorContext<T, Value>,
    attributeRemoved: boolean,
  ) => void;
  // Optionally transform the getter's response. Required by the href
  // transformer.
  transformGet: (this: T, value: Value) => Value;
  // Decides if, based on a new value, an attribute gets updated to match the
  // new value (true/false) or removed (null). Only gets called when the
  // transformer's eql() method returns false. Defaults to a function that
  // always returns true.
  updateContentAttr: (
    oldValue: Value | null,
    newValue: Value | null,
  ) => boolean | null;
};

export type ClassAccessorDecorator<
  T extends HTMLElement,
  V,
  R extends ClassAccessorDecoratorResult<
    unknown,
    unknown
  > | void = ClassAccessorDecoratorResult<T, V>,
> = (
  target: ClassAccessorDecoratorTarget<T, V>,
  context: ClassAccessorDecoratorContext<T, V>,
) => R;

export type Method<T, A extends unknown[] = []> = (this: T, ...args: A) => any;

type Types = {
  string: string;
  number: number;
  bigint: bigint;
  boolean: boolean;
  symbol: symbol;
  undefined: undefined;
  object: object;
  null: null;
  function: (...args: any[]) => any;
};

export function assertRecord(
  input: unknown,
  name: string,
): asserts input is Record<any, any> {
  if (input === null || typeof input !== "object") {
    throw new TypeError(
      `Expected "${name}" to be an object, got ${
        input === null ? null : typeof input
      }`,
    );
  }
}
export function assertType<K extends keyof Types>(
  value: unknown,
  name: string,
  ...types: K[]
): asserts value is Types[K] {
  if (
    !types.some(
      (type) =>
        (value === null && type === "null") ||
        (value !== null && typeof value === type),
    )
  ) {
    throw new TypeError(
      `Expected "${name}" to be ${types.join("/")}, got ${typeof value}`,
    );
  }
}

export function assertTransformer<T extends HTMLElement, V>(
  input: unknown,
  fieldName = "transformer",
): asserts input is Transformer<T, V> {
  assertRecord(input, fieldName);
  for (const method of [
    "init",
    "parse",
    "validate",
    "transform",
    "stringify",
    "eql",
    "beforeSet",
    "transformGet",
    "updateContentAttr",
  ]) {
    assertType(input[method], method, "function");
  }
}

export function assertContext(
  ctx: any,
  name: string,
  kind: DecoratorContext["kind"] | "method/function",
  allowStatic = false,
): void {
  if (ctx.static && !allowStatic) {
    throw new TypeError(`@${name} can't be used on static members`);
  }
  if (kind.startsWith(ctx.kind)) {
    return;
  }
  if (kind === "method/function" && ctx.kind === "field") {
    ctx.addInitializer(function (this: any): void {
      if (typeof ctx.access.get(this) !== "function") {
        throw new TypeError(
          `decorator @${name} can't be used on non-function type field`,
        );
      }
    });
    return;
  }
  throw new TypeError(`${kind} decorator @${name} used on ${ctx.kind}`);
}

type TrimLeft<T extends string> = T extends ` ${infer Rest}`
  ? TrimLeft<Rest>
  : T;

type TrimRight<T extends string> = T extends `${infer Rest} `
  ? TrimRight<Rest>
  : T;

type Trim<T extends string> = TrimLeft<TrimRight<T>>;

type Split<Str extends string, Last = never> =
  Trim<Str> extends `${infer First} ${infer Rest}`
    ? First extends " "
      ? Split<Trim<Rest>, Last>
      : Split<Trim<Rest>, First | Last>
    : Trim<Str> | Last;

type MapNames<Names extends string, BaseType, Source> = {
  [Name in Split<Names>]: Name extends keyof Source ? Source[Name] : BaseType;
}[Split<Names>];

export type EventOf<Names extends string, Map> = Map extends never
  ? Event
  : MapNames<Names, Event, Map> extends Event
    ? MapNames<Names, Event, Map>
    : Event;
