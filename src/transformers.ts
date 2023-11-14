import { EMPTY_OBJ, NO_VALUE, isArray } from "./lib.js";
import {
  assertRecord,
  assertType,
  assertTransformer,
  type Transformer,
  type Optional,
} from "./types.js";

export const protoTransformer: Transformer<any, any> = {
  parse: (x: any) => x,
  validate: () => true,
  transform: (x: any) => x,
  stringify: String,
  eql: <T>(a: T, b: T) => a === b,
  init: <T>(x: T) => x,
  beforeSet: <T>(x: T) => x,
  updateContentAttr: () => true,
};

function createTransformer<T extends HTMLElement, V, IntermediateV = V>(
  input: Partial<Transformer<T, V, IntermediateV>>,
): Transformer<T, V, IntermediateV> {
  return Object.assign(Object.create(protoTransformer), input);
}

function stringifyJSONAttribute(value: any, replacer: any): string {
  try {
    return JSON.stringify(value, replacer);
  } catch (cause) {
    throw new Error("Attribute value is not JSON-serializable", { cause });
  }
}

function deleteContentAttrIfNullable(isNullable: boolean) {
  return function (_: unknown, newValue: any): boolean | null {
    if (isNullable && (typeof newValue === "undefined" || newValue === null)) {
      return null;
    }
    return true;
  };
}

function assertInRange<T extends number | bigint>(
  value: T,
  min?: T,
  max?: T,
): void {
  if (value < (min as any)) {
    throw new RangeError(`${value} is less than minimum value ${min}`);
  }
  if (value > (max as any)) {
    throw new RangeError(`${value} is larger than maximum value ${max}`);
  }
}

function clamp<T extends number | bigint>(value: T, min?: T, max?: T): T {
  // Can only be true when min is not undefined
  if (value <= (min as any)) {
    return min as any;
  }
  // Can only be true when max is not undefined
  if (value >= (max as any)) {
    return max as any;
  }
  return value;
}

// Stringify everything, stateless and simple.
export function string<T extends HTMLElement>(): Transformer<T, string> {
  const initialValues = new WeakMap<T, string>();
  return createTransformer<T, string>({
    parse(newValue) {
      if (!newValue) {
        return initialValues.get(this)!; // always initialized in init
      }
      return String(newValue);
    },
    transform: String,
    init(value = "") {
      initialValues.set(this, value);
      return value;
    },
  });
}

// behave like <a href> by simply being <a href>
export function href<T extends HTMLElement>(): Transformer<T, string> {
  const shadows = new WeakMap<T, HTMLAnchorElement>();
  const defaultValues = new WeakMap<T, string>();
  return createTransformer<T, string>({
    parse(newValue) {
      const shadow = shadows.get(this)!;
      if (newValue === null) {
        const defaultValue = defaultValues.get(this);
        if (defaultValue) {
          shadow.setAttribute("href", defaultValue);
        } else {
          shadow.removeAttribute("href");
        }
      } else {
        shadow.setAttribute("href", String(newValue));
      }
      return shadow.href;
    },
    stringify() {
      return shadows.get(this)?.getAttribute("href") ?? "";
    },
    transform(newValue) {
      // Shadow is undefined for validation of the accessors default value
      const shadow = shadows.get(this) ?? document.createElement("a");
      shadow.href = String(newValue);
      return shadow.href;
    },
    init(value) {
      const shadow = document.createElement("a");
      shadows.set(this, shadow);
      if (value) {
        defaultValues.set(this, value);
        shadow.href = value;
      }
      return shadow.href;
    },
  });
}

export function bool<T extends HTMLElement>(): Transformer<T, boolean> {
  return createTransformer<T, boolean>({
    parse: (value) => value !== null,
    transform: Boolean,
    stringify: () => "",
    updateContentAttr(_, newValue) {
      return newValue === false ? null : true;
    },
  });
}

type NumericOptions<T extends number | bigint | undefined> = {
  min: T;
  max: T;
  nullable: boolean;
};

type NumberOptions = NumericOptions<number> & {
  allowNaN: boolean;
};

function numberOptions(input: unknown): NumberOptions {
  assertRecord(input, "options");
  const min = input.min ?? -Infinity;
  const max = input.max ?? Infinity;
  assertType(min, "min", "number");
  assertType(max, "max", "number");
  if (max < min) {
    throw new RangeError(`${max} is less than minimum value ${min}`);
  }
  return {
    min,
    max,
    allowNaN: !!input.allowNaN,
    nullable: !!input.nullable,
  };
}

export function number<T extends HTMLElement>(
  options: Optional<Omit<NumberOptions, "nullable">> & { nullable: true },
): Transformer<T, number | null | undefined>;
export function number<T extends HTMLElement>(
  options?: Optional<NumberOptions>,
): Transformer<T, number>;
export function number<T extends HTMLElement>(
  options: Optional<NumberOptions> = EMPTY_OBJ,
): Transformer<T, any> {
  const initialValues = new WeakMap<T, number>();
  const { min, max, allowNaN, nullable } = numberOptions(options);
  // Used as validation function and in init
  function validate(value: unknown): void {
    if ((typeof value === "undefined" || value === null) && nullable) {
      return;
    }
    const asNumber = Number(value);
    if (!allowNaN && Number.isNaN(asNumber)) {
      throw new Error(`Invalid number value "NaN"`);
    }
    assertInRange(asNumber, min, max);
  }
  return createTransformer<T, any>({
    parse(value) {
      if (value === null) {
        return nullable ? null : initialValues.get(this) ?? 0;
      }
      const asNumber = Number(value);
      if (Number.isNaN(asNumber)) {
        if (allowNaN) {
          return asNumber;
        }
        return NO_VALUE;
      }
      return clamp(asNumber, min, max);
    },
    transform(value: any) {
      if (nullable && (typeof value === "undefined" || value === null)) {
        return null;
      }
      return Number(value);
    },
    validate,
    init(value) {
      if (typeof value === "undefined") {
        value = nullable ? null : 0;
      }
      validate(value);
      initialValues.set(this, value);
      return value;
    },
    updateContentAttr: deleteContentAttrIfNullable(nullable),
  });
}

function bigintOptions(input: unknown): NumericOptions<bigint | undefined> {
  assertRecord(input, "options");
  const min = input.min ?? void 0;
  const max = input.max ?? void 0;
  assertType(min, "min", "bigint", "undefined");
  assertType(max, "max", "bigint", "undefined");
  // The comparison below can only be true if both min and max are not
  // undefined. No need to do extra type checks beforehand.
  if ((max as any) < (min as any)) {
    throw new RangeError(`${max} is less than minimum value ${min}`);
  }
  return { min, max, nullable: !!input.nullable };
}

// Parses the integer part out of a string containing a "float", falls back to
// shoving the entire string into BigInt() if the RegExp does not match.
function parseBigInt(value: string): bigint {
  return BigInt(/^(-?[0-9]+)(\.[0-9]+)/.exec(value)?.[1] ?? value);
}

type IntOptions = NumericOptions<bigint>;

export function int<T extends HTMLElement>(
  options: Optional<Omit<IntOptions, "nullable">> & { nullable: true },
): Transformer<T, bigint | null | undefined>;
export function int<T extends HTMLElement>(
  options?: Optional<IntOptions>,
): Transformer<T, bigint>;
export function int<T extends HTMLElement>(
  options: Optional<IntOptions> = EMPTY_OBJ,
): Transformer<T, any> {
  const initialValues = new WeakMap<T, bigint>();
  const { min, max, nullable } = bigintOptions(options);
  // Used as validation function and in init
  function validate(value: unknown): void {
    if ((typeof value === "undefined" || value === null) && nullable) {
      return;
    }
    assertInRange(BigInt(value as any), min, max);
  }
  return createTransformer<T, any>({
    parse(value) {
      if (value === null) {
        return nullable ? null : initialValues.get(this) ?? 0n;
      }
      try {
        return clamp(parseBigInt(value), min, max);
      } catch {
        return NO_VALUE;
      }
    },
    validate,
    transform(value: any) {
      if (nullable && (typeof value === "undefined" || value === null)) {
        return null;
      }
      return BigInt(value);
    },
    init(value) {
      if (typeof value === "undefined") {
        value = nullable ? null : 0n;
      }
      validate(value);
      initialValues.set(this, value);
      return value;
    },
    updateContentAttr: deleteContentAttrIfNullable(nullable),
  });
}

type JSONOptions = {
  reviver?: Parameters<typeof JSON.parse>[1];
  replacer?: Parameters<typeof JSON.stringify>[1];
};

export function json<T extends HTMLElement>(
  options: JSONOptions = EMPTY_OBJ,
): Transformer<T, any> {
  const initialValues = new WeakMap<T, any>();
  return createTransformer<T, any>({
    parse(newValue) {
      if (newValue === null) {
        return initialValues.get(this);
      }
      try {
        return JSON.parse(newValue, options.reviver);
      } catch {
        return NO_VALUE;
      }
    },
    validate(value) {
      stringifyJSONAttribute(value, options.replacer);
    },
    stringify(value) {
      return stringifyJSONAttribute(value, options.replacer);
    },
    init(value) {
      // Verify that the initial value stringifies
      stringifyJSONAttribute(value, options.replacer);
      initialValues.set(this, value);
      return value;
    },
  });
}

/*
type SchemaLike<V> = {
  parse(data: unknown): V;
  safeParse(
    data: unknown,
  ): { success: true; data: V } | { success: false; error: any };
};

type SchemaOptions = {
  reviver?: Parameters<typeof JSON.parse>[1];
  replacer?: Parameters<typeof JSON.stringify>[1];
};

export function schema<T extends HTMLElement, V>(
  schema: SchemaLike<V>,
  options: SchemaOptions = EMPTY_OBJ,
): Transformer<T, V> {
  if (typeof schema !== "object") {
    throw new TypeError("First argument of the schema transformer is required");
  }
  const initialValues = new WeakMap<T, V>();
  return createTransformer<T, V>({
    parse(newValue) {
      if (newValue === null) {
        return initialValues.get(this) as V;
      }
      try {
        const raw = JSON.parse(newValue, options.reviver);
        return schema.parse(raw);
      } catch {
        return NO_VALUE;
      }
    },
    validate(value) {
      const parsed = schema.parse(value);
      // Verify that the parsed value stringifies
      stringifyJSONAttribute(parsed, options.replacer);
      return parsed;
    },
    stringify(value) {
      return stringifyJSONAttribute(value, options.replacer);
    },
    init(value) {
      value = schema.parse(value);
      // Verify that the default stringifies
      stringifyJSONAttribute(value, options.replacer);
      initialValues.set(this, value);
      return value;
    },
  });
}
*/

type LiteralOptions<T extends HTMLElement, V> = {
  values: V[];
  transform: Transformer<T, V>;
};

function literalOptions<T extends HTMLElement, V>(
  input: unknown = EMPTY_OBJ,
): LiteralOptions<T, V> {
  assertRecord(input, "options");
  const { values, transform } = input;
  assertTransformer<T, V>(transform);
  if (!isArray(values)) {
    throw new TypeError(
      `Expected "values" to be array, got "${typeof values}".`,
    );
  }
  if (values.length === 0) {
    throw new TypeError(`Expected "values" to not be empty`);
  }
  return { values, transform };
}

export function literal<T extends HTMLElement, V>(
  options: LiteralOptions<T, V>,
): Transformer<T, V> {
  const initialValues = new WeakMap<T, V>();
  const { transform, values } = literalOptions<T, V>(options);
  // Used as validation function and in init
  function validate(this: T, value: any): void {
    transform.validate.call(this, value);
    const transformed = transform.transform.call(this, value);
    if (!values.includes(transformed)) {
      throw new Error(
        `Invalid value: ${transform.stringify.call(this, transformed)}`,
      );
    }
  }
  return createTransformer<T, V>({
    parse(value) {
      if (value === null) {
        return initialValues.get(this)!;
      }
      const parsed = transform.parse.call(this, value);
      if (parsed !== NO_VALUE && values.includes(parsed)) {
        return parsed;
      }
      return NO_VALUE;
    },
    validate,
    eql: transform.eql,
    stringify: transform.stringify,
    transform: transform.transform,
    init(value = values[0]) {
      validate.call(this, value);
      initialValues.set(this, value);
      return value;
    },
  });
}

type ListOptions<T extends HTMLElement, V> = {
  separator?: string;
  transform: Transformer<T, V>;
};

function listOptions<T extends HTMLElement, V>(
  input: unknown = EMPTY_OBJ,
): Required<ListOptions<T, V>> {
  assertRecord(input, "options");
  const { separator = ",", transform } = input;
  assertTransformer<T, V>(transform);
  if (typeof separator !== "string") {
    throw new Error(`Invalid separator of type ${typeof separator}`);
  }
  return { separator, transform };
}

export function list<T extends HTMLElement, V>(
  inputOptions: ListOptions<T, V>,
): Transformer<T, V[], any[]> {
  const initialValues = new WeakMap<T, V[]>();
  const { transform, separator } = listOptions<T, V>(inputOptions);
  // Used as validation function and in init
  function validate(this: T, values: unknown): void {
    if (!isArray(values)) {
      throw new Error(`Expected array, got ${typeof values}`);
    }
    for (const value of values) {
      transform.validate.call(this, value);
    }
  }
  return createTransformer<T, V[], any[]>({
    parse(rawValues) {
      if (typeof rawValues === "string") {
        return rawValues.split(separator).flatMap((rawValue) => {
          rawValue = rawValue.trim();
          if (rawValue) {
            const parsed = transform.parse.call(this, rawValue);
            if (parsed !== NO_VALUE) {
              return [parsed];
            }
          }
          return [];
        });
      }
      return initialValues.get(this) ?? [];
    },
    validate,
    transform(values) {
      return values.map((value) => transform.transform.call(this, value));
    },
    stringify(values) {
      return values
        .map((value) => transform.stringify.call(this, value))
        .join(separator);
    },
    eql(a, b) {
      if (a.length !== b.length) {
        return false;
      }
      if (!transform.eql) {
        return a === b;
      }
      return a.every((aVal, i) => transform.eql.call(this, aVal, b[i]));
    },
    init(value = []) {
      validate.call(this, value);
      initialValues.set(this, value);
      return value;
    },
  });
}

/* eslint-disable */
type Handler<T, E extends Event> = ((this: T, evt: E) => boolean | undefined | void) | null;
type HandlerTransform<T extends HTMLElement, E extends Event> = Transformer<
  T,
  Handler<T, E>
>;
/* eslint-enable */

export function event<
  T extends HTMLElement,
  E extends Event,
>(): HandlerTransform<T, E> {
  const functions = new WeakMap<T, Handler<T, E>>();
  function handler(this: T, evt: E) {
    const func = functions.get(this);
    // The function may return false to cause preventDefault()
    if (func?.call(this, evt) === false) {
      evt.preventDefault();
    }
  }
  return createTransformer<T, Handler<T, E>>({
    parse(value) {
      if (value && typeof value === "string") {
        return new Function("event", value) as Handler<T, E>;
      }
      return null;
    },
    transform(value) {
      if (typeof value === "function") {
        return value as Handler<T, E>;
      }
      if (typeof value === "string") {
        return new Function("event", value) as Handler<T, E>;
      }
      return null;
    },
    // This function should never be called, as updating event handler IDL
    // attributes does not change the content attribute value
    stringify() {
      throw new Error();
    },
    init(value, context) {
      if (
        context.private ||
        typeof context.name === "symbol" ||
        !context.name.startsWith("on")
      ) {
        throw new Error(
          "Event handler names must be a non-private strings starting with 'on'",
        );
      }
      if (value) {
        functions.set(this, value);
        this.addEventListener(context.name.slice(2), handler as any);
      }
      return value;
    },
    beforeSet(value, context) {
      // If either the new handler or the old handler are falsy, the event
      // handler must be detached and then re-attached to reflect the new firing
      // order of event handlers. If both the new and old handlers are
      // functions, the swap happens in-place.
      if (!functions.get(this) || !value) {
        const name = (context.name as string).slice(2);
        this.removeEventListener(name, handler as any);
        this.addEventListener(name, handler as any);
      }
      functions.set(this, value); // change the actual event handler
      return value;
    },
    updateContentAttr: () => false,
  });
}
