import { Nil } from "./lib.js";
import {
  type Transformer,
  assertRecord,
  assertTransformer,
  assertType,
} from "./types.js";

function stringifyJSONAttribute(value: any, replacer: any): string {
  try {
    return JSON.stringify(value, replacer);
  } catch (cause) {
    throw new Error(
      "Value is not JSON-serializable, but this is required for attribute handling",
      { cause },
    );
  }
}

export function string(): Transformer<HTMLElement, string> {
  const initialValues = new WeakMap<HTMLElement, string>();
  return {
    parse(newValue, oldValue) {
      // Content attribute got removed
      if (!newValue && oldValue !== Nil) {
        return initialValues.get(this) ?? "";
      }
      return String(newValue);
    },
    validate(value) {
      if (typeof value === "undefined") {
        return initialValues.get(this) ?? "";
      }
      return String(value);
    },
    init(value, defaultValue) {
      if (typeof defaultValue === "string") {
        initialValues.set(this, defaultValue);
      }
      return value;
    },
  };
}

export function href(): Transformer<HTMLElement, string> {
  const initialValues = new WeakMap<HTMLElement, string>();
  return {
    parse(newValue, oldValue) {
      // Content attribute got removed
      if (!newValue && oldValue !== Nil) {
        const result = initialValues.get(this) ?? "";
        initialValues.delete(this); // reset like <a href>
        return result;
      }
      return String(newValue);
    },
    validate: String,
    eql(newValue, oldValue) {
      if (!initialValues.get(this)) {
        return false;
      }
      return newValue === oldValue;
    },
    get(value) {
      if (!initialValues.has(this)) {
        return value;
      }
      const tmp = document.createElement("a");
      tmp.href = value;
      return tmp.href;
    },
    set(value, rawValue) {
      if (!initialValues.has(this) && rawValue !== null) {
        initialValues.set(this, value);
      }
      return value;
    },
    init(value, defaultValue) {
      if (defaultValue && typeof defaultValue === "string") {
        initialValues.set(this, defaultValue);
      }
      return value;
    },
  };
}

export function bool(): Transformer<HTMLElement, boolean> {
  return {
    parse(value) {
      return value !== null;
    },
    validate: Boolean,
    stringify() {
      return "";
    },
    updateContentAttr(_, newValue) {
      if (newValue === false) {
        return null;
      }
      return true;
    },
  };
}

type NumberOptions<T extends number | bigint | undefined> = {
  min: T;
  max: T;
};

function numberOptions(input: unknown): NumberOptions<number> {
  assertRecord(input, "options");
  const { min = -Infinity, max = Infinity } = input as Record<any, any>;
  assertType(min, "min", "number");
  assertType(max, "max", "number");
  if (min >= max) {
    throw new RangeError(`Expected min to be be less than max`);
  }
  return { min, max };
}

export function number(
  options: Partial<NumberOptions<number>> = {},
): Transformer<HTMLElement, number> {
  const fallbackValues = new WeakMap<HTMLElement, number>();
  const { min, max } = numberOptions(options);
  return {
    parse(value, oldValue) {
      if (value === null) {
        return fallbackValues.get(this) ?? 0;
      }
      const asNumber = Number(value);
      if (Number.isNaN(asNumber)) {
        if (oldValue !== Nil) {
          return oldValue;
        }
        return fallbackValues.get(this) ?? 0;
      }
      return Math.min(Math.max(asNumber, min), max);
    },
    validate(value) {
      if (typeof value === "undefined") {
        return fallbackValues.get(this) ?? 0;
      }
      const asNumber = Number(value);
      if (Number.isNaN(asNumber)) {
        throw new Error(`Invalid number NaN`);
      }
      if (asNumber < min || asNumber > max) {
        throw new Error(`${asNumber} is out of range [${min}, ${max}]`);
      }
      return asNumber;
    },
    init(value, defaultValue) {
      if (typeof defaultValue === "number") {
        fallbackValues.set(this, defaultValue);
      }
      return value;
    },
  };
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
  if (typeof min === "bigint" && typeof max === "bigint" && min >= max) {
    throw new RangeError(`Expected "min" to be be less than "max"`);
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

export function int(
  options: Partial<NumberOptions<bigint>> = {},
): Transformer<HTMLElement, bigint> {
  const fallbackValues = new WeakMap<HTMLElement, bigint>();
  const { min, max } = bigintOptions(options);
  return {
    parse(value, oldValue) {
      if (isBigIntConvertible(value)) {
        try {
          const asInt = toBigInt(value);
          if (typeof min !== "undefined" && asInt <= min) {
            return min;
          }
          if (typeof max !== "undefined" && asInt >= max) {
            return max;
          }
          return asInt;
        } catch {
          if (oldValue !== Nil) {
            return oldValue;
          }
          return fallbackValues.get(this) ?? 0n;
        }
      }
      return fallbackValues.get(this) ?? 0n;
    },
    validate(value) {
      if (typeof value === "undefined") {
        return fallbackValues.get(this) ?? 0n;
      }
      if (value === null) {
        return 0n;
      }
      const asInt = BigInt(value as any);
      if (typeof min !== "undefined" && asInt < min) {
        throw new Error(`${asInt} is less than minimum value ${min}`);
      }
      if (typeof max !== "undefined" && asInt > max) {
        throw new Error(`${asInt} is greater than maximum value ${max}`);
      }
      return asInt;
    },
    init(value, defaultValue) {
      if (typeof defaultValue === "bigint") {
        fallbackValues.set(this, defaultValue);
      }
      return value;
    },
  };
}

type JSONOptions = {
  reviver?: Parameters<typeof JSON.parse>[1];
  replacer?: Parameters<typeof JSON.stringify>[1];
};

export function json(options: JSONOptions = {}): Transformer<HTMLElement, any> {
  const fallbackValues = new WeakMap<HTMLElement, any>();
  return {
    parse(newValue, oldValue) {
      // Attribute removed
      if (!newValue && oldValue !== Nil) {
        return fallbackValues.get(this);
      }
      // Attribute set or init from attribute
      try {
        return JSON.parse(String(newValue), options.reviver);
      } catch {
        if (oldValue !== Nil) {
          return oldValue;
        }
        return fallbackValues.get(this);
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
    init(value, defaultValue) {
      // Verify that the default stringifies
      stringifyJSONAttribute(defaultValue, options.replacer);
      fallbackValues.set(this, defaultValue);
      return value;
    },
  };
}

type SchemaLike<V> = {
  parse(data: unknown): V;
  safeParse(
    data: unknown,
  ): { success: true; data: V } | { success: false; error: any };
};

type ZodOptions = {
  reviver?: Parameters<typeof JSON.parse>[1];
  replacer?: Parameters<typeof JSON.stringify>[1];
};

export function schema<V>(
  schema: SchemaLike<V>,
  options: ZodOptions = {},
): Transformer<HTMLElement, V> {
  if (typeof schema !== "object") {
    throw new TypeError("First argument of the schema transformer is required");
  }
  const fallbackValues = new WeakMap<HTMLElement, V>();
  return {
    parse(newValue, oldValue) {
      // Attribute removed
      if (!newValue && oldValue !== Nil) {
        return fallbackValues.get(this) as V;
      }
      // Attribute set or init from attribute
      try {
        const raw = JSON.parse(String(newValue), options.reviver);
        const parsed = schema.safeParse(raw);
        if (parsed.success) {
          return parsed.data;
        }
        if (oldValue !== Nil) {
          return oldValue;
        }
        return fallbackValues.get(this) as V;
      } catch {
        if (oldValue !== Nil) {
          return oldValue;
        }
        return fallbackValues.get(this) as V;
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
    init(value, defaultValue) {
      defaultValue = schema.parse(defaultValue);
      // Verify that the default stringifies
      stringifyJSONAttribute(defaultValue, options.replacer);
      fallbackValues.set(this, defaultValue);
      return value;
    },
  };
}

type LiteralOptions<T extends HTMLElement, V> = {
  values: V[];
  transform: Transformer<T, V>;
};

function literalOptions<T extends HTMLElement, V>(
  input: unknown,
): LiteralOptions<T, V> {
  input = input ?? {};
  assertRecord(input, "options");
  const { values, transform } = input as Record<any, any>;
  assertTransformer<T, V>(transform);
  if (!Array.isArray(values)) {
    throw new TypeError(
      `Expected "values" to be array, got "${typeof values}".`,
    );
  }
  if (values.length === 0) {
    throw new TypeError(`Expected "values" to not be empty`);
  }
  return { transform, values };
}

export function literal<T extends HTMLElement, V>(
  inputOptions: LiteralOptions<T, V>,
): Transformer<T, V> {
  const fallbackValues = new WeakMap<HTMLElement, V>();
  const options = literalOptions<T, V>(inputOptions);
  return {
    parse(rawValue, oldValue) {
      const parsed = options.transform.parse.call(this, rawValue, oldValue);
      if (options.values.includes(parsed)) {
        return parsed;
      }
      return fallbackValues.get(this) ?? options.values[0];
    },
    validate(newValue, oldValue) {
      if (typeof newValue === "undefined") {
        return fallbackValues.get(this) ?? options.values[0];
      }
      const validated = options.transform.validate.call(
        this,
        newValue,
        oldValue,
      );
      if (options.values.includes(validated)) {
        return validated;
      }
      if (options.transform.stringify) {
        throw new Error(
          `Invalid value: ${options.transform.stringify.call(this, validated)}`,
        );
      } else {
        throw new Error(`Invalid value: ${String(validated)}`);
      }
    },
    stringify: options.transform.stringify,
    eql: options.transform.eql,
    init(value, defaultValue) {
      if (options.values.includes(defaultValue)) {
        fallbackValues.set(this, defaultValue);
      }
      return value;
    },
  };
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
  const functions = new WeakMap<HTMLElement, Handler<T, E>>();
  function handler(this: T, evt: E) {
    const func = functions.get(this);
    if (func) {
      const doDefault = func.call(this, evt);
      if (doDefault === false) {
        evt.preventDefault();
      }
    }
  }
  return {
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
    stringify() {
      throw new Error(
        "This function should never be called, updating event handler properties does not change the attribute value!",
      );
    },
    init(value, defaultValue, context) {
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
    set(value, _, context) {
      // If either the new handler or the old handler are falsy, the event
      // handler must be detached and then re-attached to reflect the new firing
      // order of event handlers. If both the new and old handlers are
      // functions, the swap happens in-place.
      const func = functions.get(this);
      if (!func || !value) {
        const name = (context.name as string).slice(2);
        this.removeEventListener(name, handler as any);
        this.addEventListener(name, handler as any);
      }
      functions.set(this, value); // change the actual event handler
      return value;
    },
    updateContentAttr() {
      return false;
    },
  };
}
