export type Transformer<T extends HTMLElement, V> = {
  // parse() turns attribute values (usually string | null) into property
  // values. Must *never* throw exceptions, but always deal with its input in a
  // graceful way, just like the attribute handling in built-in elements works.
  parse: (this: T, value: unknown) => V;
  // Validates setter inputs, which may be of absolutely any type. May throw for
  // invalid values, just like setters on built-in elements may.
  validate: (this: T, value: unknown) => V;
  // Turns property values into attributes values (strings), thereby controlling
  // the attribute representation of an accessor together with
  // updateAttrPredicate(). Must never throw.
  stringify: (this: T, value?: V | null) => string;
  // Determines whether two values are equal. If this method returns true,
  // reactive callbacks will not be triggered.
  eql: (this: T, oldValue: V | null, newValue: V | null) => boolean;
  // Optionally transforms a value before returned from the getter. Defaults to
  // the identity function.
  get?: (this: T, value: V) => V;
  // Decides if, based on a new value, an attribute gets updated to match the
  // new value (true/false) or removed (null). Only gets called when the
  // transformer's eql() method returns false. Defaults to a function that
  // always returns true.
  updateAttrPredicate?: (
    this: T,
    oldValue: V | null,
    newValue: V | null
  ) => boolean | null;
  // Runs before accessor initialization and can be used to perform side effects
  // or to grab the accessors initial value as defined in the class.
  beforeInitCallback?: (
    this: T,
    value: V,
    defaultValue: V,
    context: ClassAccessorDecoratorContext<T, V>
  ) => void;
  // Runs before an accessor's setter sets a new value and can be used to
  // perform side effects
  beforeSetCallback?: (
    this: T,
    value: V,
    rawValue: unknown,
    context: ClassAccessorDecoratorContext<T, V>
  ) => void;
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
  name: string
): asserts input is Record<any, any> {
  if (typeof input !== "object") {
    throw new TypeError(
      `Expected "${name}" to be an object, got ${typeof input}`
    );
  }
  if (input === null) {
    throw new TypeError(`Expected "${name}" to be an object, got ${null}`);
  }
}

export function assertType<K extends keyof Types>(
  value: unknown,
  name: string,
  ...types: K[]
): asserts value is Types[K] {
  for (const type of types) {
    if ((type === "null" && value === null) || typeof value === type) {
      return;
    }
  }
  throw new TypeError(
    `Expected "${name}" to "${types.join("/")}" but got ${typeof value}`
  );
}

export function assertPropType<K extends keyof Types>(
  obj: any,
  prop: string,
  ...types: K[]
): void {
  for (const type of types) {
    if ((type === "null" && obj[prop] === null) || typeof obj[prop] === type) {
      return;
    }
  }
  throw new TypeError(
    `Expected "${prop}" to be "${types.join("/")}" but got ${typeof obj[prop]}`
  );
}

export function assertTransformer<T extends HTMLElement, V>(
  input: unknown
): asserts input is Transformer<T, V> {
  assertRecord(input, "transformer");
  assertPropType(input, "parse", "function");
  assertPropType(input, "validate", "function");
  assertPropType(input, "validate", "function");
  assertPropType(input, "updateAttrPredicate", "function", "undefined");
  assertPropType(input, "beforeInitCallback", "function", "undefined");
  assertPropType(input, "beforeSetCallback", "function", "undefined");
}
