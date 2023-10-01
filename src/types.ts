import { EMPTY_OBJ, Nil, isArray } from "./lib.js";

declare global {
  interface OrnamentEventMap {
    init: Record<string, never>;
    connected: Record<string, never>;
    disconnected: Record<string, never>;
    adopted: Record<string, never>;
    prop: { name: string | symbol };
    attribute: {
      name: string;
      oldValue: string | null;
      newValue: string | null;
    };
  }
}

export type Transformer<T extends HTMLElement, V> = {
  // parse() turns attribute values (usually string | null) into property
  // values. Must *never* throw exceptions, and instead always deal with its
  // input in a graceful way.
  parse: (this: T, rawValue: unknown, oldValue: V | typeof Nil) => V;
  // Validates setter inputs, which may be of absolutely any type. May throw for
  // invalid values, just like setters on built-in elements may.
  validate: (this: T, newValue: unknown, oldValue: V | typeof Nil) => V;
  // Turns IDL attribute values into content attribute values (strings), thereby
  // controlling the attribute representation of an accessor together with
  // updateContentAttr(). Must never throw, defaults to the String() function
  stringify: (this: T, value?: V) => string;
  // Determines whether a new attribute value is equal to the old value. If this
  // method returns true, reactive callbacks will not be triggered. Defaults to
  // simple strict equality (===).
  eql: (this: T, newValue: V, oldValue: V) => boolean;
  // Optionally transforms a value before it is used to initialize the accessor.
  // Can also be used to run a side effect when the accessor initializes.
  // Defaults to the identity function.
  init: (
    this: T,
    value: V,
    defaultValue: V,
    context: ClassAccessorDecoratorContext<T, V>,
  ) => V;
  // Optionally transforms a value before it is returned from the getter. Can
  // also be used to run a side effect when the setter gets used. Defaults to
  // the identity function.
  get: (this: T, value: V, context: ClassAccessorDecoratorContext<T, V>) => V;
  // Optionally transforms a value before it is set by either the setter or a
  // content attribute update. Can also be used to run a side effect when the
  // setter gets used. Defaults to the identity function. If the raw value is
  // not Nil, the set operation was caused by a content attribute update and the
  // content attribute value is reflected in the raw value (string | null).
  set: (
    this: T,
    value: V,
    rawValue: unknown,
    context: ClassAccessorDecoratorContext<T, V>,
  ) => V;
  // Decides if, based on a new value, an attribute gets updated to match the
  // new value (true/false) or removed (null). Only gets called when the
  // transformer's eql() method returns false. Defaults to a function that
  // always returns true.
  updateContentAttr: (
    this: T,
    oldValue: V | null,
    newValue: V | null,
  ) => boolean | null;
};

/* eslint-disable */
export type ClassAccessorDecorator<T extends HTMLElement, V, R extends ClassAccessorDecoratorResult<unknown, unknown> | void = ClassAccessorDecoratorResult<T, V>>
  = (target: ClassAccessorDecoratorTarget<T, V>, context: ClassAccessorDecoratorContext<T, V>) => R;

export type Method<T, A extends unknown[]> = (this: T, ...args: A) => any;
export type FunctionFieldOrMethodContext<T, A extends unknown[]> =
  | ClassMethodDecoratorContext<T, Method<T, A>>
  | ClassFieldDecoratorContext<T, Method<T, A>>;

export interface FunctionFieldOrMethodDecorator<T extends HTMLElement, A extends unknown[]> {
  (value: Method<T, A>, context: ClassMethodDecoratorContext<T, Method<T, A>>): Method<T, A>;
  (value: undefined, context: ClassFieldDecoratorContext<T, Method<unknown, A>>): (init: Method<unknown, A>) => Method<unknown, A>;
}

export type FunctionFieldOrMethodDecorator_<T extends HTMLElement, A extends unknown[]> =
  & ((value: Method<T, A>, context: ClassMethodDecoratorContext<T, Method<T, A>>) => Method<T, A>)
  & ((value: undefined, context: ClassFieldDecoratorContext<T, Method<unknown, A>>) => (init: Method<unknown, A>) => Method<unknown, A>);
/* eslint-enable */

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
  if (typeof input !== "object") {
    throw new TypeError(
      `Expected "${name}" to be an object, got ${typeof input}`,
    );
  }
  if (input === null) {
    throw new TypeError(`Expected "${name}" to be an object, got ${null}`);
  }
}

function is<K extends keyof Types>(
  value: unknown,
  ...types: K[]
): value is Types[K] {
  return types.some(
    (type) =>
      (value === null && type === "null") ||
      (value !== null && typeof value === type),
  );
}

export function assertType<K extends keyof Types>(
  value: unknown,
  name: string,
  ...types: K[]
): asserts value is Types[K] {
  if (is(value, ...types)) {
    return;
  }
  throw new TypeError(
    `Expected "${name}" to "${types.join("/")}" but got ${typeof value}`,
  );
}

export function assertPropType<K extends keyof Types>(
  obj: any,
  prop: string,
  ...types: K[]
): void {
  if (is(obj[prop], ...types)) {
    return;
  }
  throw new TypeError(
    `Expected "${prop}" to be "${types.join("/")}" but got ${typeof obj[prop]}`,
  );
}

export function assertTransformer<T extends HTMLElement, V>(
  input: unknown,
): asserts input is Transformer<T, V> {
  assertRecord(input, "transformer");
  assertPropType(input, "parse", "function");
  assertPropType(input, "validate", "function");
  assertPropType(input, "validate", "function");
  assertPropType(input, "updateAttrPredicate", "function", "undefined");
  assertPropType(input, "beforeInitCallback", "function", "undefined");
  assertPropType(input, "beforeSetCallback", "function", "undefined");
}

type AcceptOptions = {
  static?: boolean;
};

export function assertContext(
  ctx: any,
  name: string,
  kind: DecoratorContext["kind"] | DecoratorContext["kind"][],
  accept: Partial<AcceptOptions> = EMPTY_OBJ,
): void {
  const kinds = isArray(kind) ? kind : [kind];
  if (!kinds.includes(ctx.kind)) {
    const expected = kinds
      .map((k) => k.slice(0, 1).toUpperCase() + k.slice(1))
      .join("/");
    throw new TypeError(`${expected} decorator @${name} used on ${ctx.kind}`);
  }
  if (ctx.static && !accept.static) {
    throw new TypeError(`Decorator @${name} can't be used on static members`);
  }
}
