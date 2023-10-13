import { EMPTY_OBJ, NO_VALUE, isArray } from "./lib.js";
import {
  type Transformer,
  type Optional,
  assertRecord,
  assertTransformer,
  assertType,
} from "./types.js";

const protoTransformer: Omit<Transformer<any, any>, "parse" | "validate"> = {
  stringify: String,
  eql: <T>(a: T, b: T) => a === b,
  init: <T>(x: T) => x,
  beforeSet: <T>(x: T) => x,
  updateContentAttr: () => true,
};

/* eslint-disable */
type InputTransformer<T extends HTMLElement, V> = Optional<
  Transformer<T, V>,
  Exclude<keyof Transformer<T, V>, "parse" | "validate">
>;
/* eslint-enable */

function createTransformer<T extends HTMLElement, V>(
  input: InputTransformer<T, V>,
): Transformer<T, V> {
  return Object.assign(Object.create(protoTransformer), input);
}

function stringifyJSONAttribute(value: any, replacer: any): string {
  try {
    return JSON.stringify(value, replacer);
  } catch (cause) {
    throw new Error("Attribute value is not JSON-serializable", { cause });
  }
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
    validate: String,
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
      // Shadow is undefined when initializing from HTML
      const shadow = shadows.get(this) ?? document.createElement("a");
      if (!newValue) {
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
    validate(newValue) {
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
    validate: Boolean,
    stringify: () => "",
    updateContentAttr(_, newValue) {
      return newValue === false ? null : true;
    },
  });
}

type NumberOptions<T extends number | bigint | undefined> = {
  min: T;
  max: T;
};

function numberOptions(input: unknown): NumberOptions<number> {
  assertRecord(input, "options");
  const { min = -Infinity, max = Infinity } = input;
  assertType(min, "min", "number");
  assertType(max, "max", "number");
  if (min >= max) {
    throw new RangeError(
      `Expected "min" value of ${min} to be be less than "max" value of ${max}`,
    );
  }
  return { min, max };
}

export function number<T extends HTMLElement>(
  options: Partial<NumberOptions<number>> = EMPTY_OBJ,
): Transformer<T, number> {
  const initialValues = new WeakMap<T, number>();
  const { min, max } = numberOptions(options);
  return createTransformer<T, number>({
    parse(value) {
      if (value === null) {
        return initialValues.get(this) ?? 0;
      }
      const asNumber = Number(value);
      if (Number.isNaN(asNumber)) {
        return NO_VALUE;
      }
      return Math.min(Math.max(asNumber, min), max);
    },
    validate(value) {
      // TODO: parse the value instead
      if (typeof value === "undefined") {
        return initialValues.get(this) ?? 0;
      }
      const asNumber = Number(value);
      if (Number.isNaN(asNumber)) {
        throw new Error(`Invalid number value "NaN"`);
      }
      if (asNumber < min || asNumber > max) {
        throw new RangeError(`${asNumber} is out of range [${min}, ${max}]`);
      }
      return asNumber;
    },
    init(value = 0) {
      initialValues.set(this, value);
      return value;
    },
  });
}

function isBigIntConvertible(
  value: unknown,
): value is string | number | bigint | boolean {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "boolean"
  );
}

function bigintOptions(input: unknown): NumberOptions<bigint | undefined> {
  assertRecord(input, "options");
  const { min, max } = input;
  assertType(min, "min", "bigint", "undefined");
  assertType(max, "max", "bigint", "undefined");
  // The comparison below can only be true if both min and max are not
  // undefined. No need to do extra type checks beforehand.
  if ((min as any) > (max as any)) {
    throw new RangeError(
      `Expected "min" value of ${min} to be be less than "max" value of ${max}`,
    );
  }
  return { min, max };
}

function toBigInt(value: string | number | bigint | boolean): bigint {
  if (typeof value === "string") {
    const match = /^(-?[0-9]+)(\.[0-9]+)/.exec(value);
    if (match) {
      return BigInt(match[1]);
    }
  }
  return BigInt(value);
}

export function int<T extends HTMLElement>(
  options: Partial<NumberOptions<bigint>> = EMPTY_OBJ,
): Transformer<T, bigint> {
  const initialValues = new WeakMap<T, bigint>();
  // The type assertion below is a blatant lie, as any or both of min and max
  // may well be undefined. But in the less/greater than operations that they
  // are used in they either convert to NaN (in case of undefined), which is NOT
  // less or greater than anything OR they are not undefined and thus proper
  // bigints. This is a bit code golf-y, but we are just not gonna worry about
  // it.
  const { min, max } = bigintOptions(options) as { min: bigint; max: bigint };
  return createTransformer<T, bigint>({
    parse(value) {
      if (isBigIntConvertible(value)) {
        try {
          const asInt = toBigInt(value);
          if (asInt <= min) {
            return min;
          }
          if (asInt >= max) {
            return max;
          }
          return asInt;
        } catch {
          return NO_VALUE;
        }
      }
      return initialValues.get(this) ?? 0n;
    },
    validate(value) {
      // TODO: parse the value instead
      if (typeof value === "undefined") {
        return initialValues.get(this) ?? 0n;
      }
      if (value === null) {
        return 0n;
      }
      const asInt = BigInt(value as any);
      if (asInt < min || asInt > max) {
        throw new RangeError(`${asInt} is out of range [${min}, ${max}]`);
      }
      return asInt;
    },
    init(value = 0n) {
      initialValues.set(this, value);
      return value;
    },
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
      // Verify that the new value stringifies
      stringifyJSONAttribute(value, options.replacer);
      return value;
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
  const fallbackValues = new WeakMap<T, V>();
  const { transform, values } = literalOptions<T, V>(options);
  return createTransformer<T, V>({
    parse(rawValue) {
      if (rawValue === null) {
        return fallbackValues.get(this) as any; // TODO: wtf
      }
      const parsed = transform.parse.call(this, rawValue);
      if (parsed !== NO_VALUE && values.includes(parsed)) {
        return parsed;
      }
      return NO_VALUE;
    },
    validate(newValue) {
      if (typeof newValue === "undefined") {
        return fallbackValues.get(this) ?? values[0];
      }
      const validated = transform.validate.call(this, newValue);
      if (values.includes(validated)) {
        return validated;
      }
      throw new Error(
        `Invalid value: ${transform.stringify.call(this, validated)}`,
      );
    },
    stringify: transform.stringify,
    eql: transform.eql,
    init(value = values[0]) {
      if (values.includes(value)) {
        fallbackValues.set(this, value);
      }
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
): Transformer<T, V[]> {
  const initialValues = new WeakMap<T, V[]>();
  const { transform, separator } = listOptions<T, V>(inputOptions);
  return createTransformer<T, V[]>({
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
    validate(newValues) {
      if (typeof newValues === "undefined") {
        return initialValues.get(this) ?? [];
      }
      if (isArray(newValues)) {
        return newValues.map((newValue) =>
          transform.validate.call(this, newValue),
        );
      }
      throw new Error(`Invalid value: ${newValues}`);
    },
    stringify(value) {
      if (value) {
        return value
          .map((value) => transform.stringify.call(this, value))
          .join(separator);
      }
      return "";
    },
    eql(a, b) {
      if (a.length !== b.length) {
        return false;
      }
      if (!transform.eql) {
        return a === b;
      }
      for (let i = 0; i < a.length; i++) {
        if (!transform.eql.call(this, a[i], b[i])) {
          return false;
        }
      }
      return true;
    },
    init(value = []) {
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
    if (func) {
      const doDefault = func.call(this, evt);
      if (doDefault === false) {
        evt.preventDefault();
      }
    }
  }
  return createTransformer<T, Handler<T, E>>({
    parse(value) {
      if (value && typeof value === "string") {
        return new Function("event", value) as Handler<T, E>;
      }
      return null;
    },
    validate(value) {
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
      if (context.private || typeof context.name === "symbol") {
        throw new Error("Event handler name must be a non-private non-symbol");
      }
      if (!context.name.startsWith("on")) {
        throw new Error("Event handler name must start with 'on'");
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
