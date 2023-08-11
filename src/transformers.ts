import {
  type Transformer,
  assertRecord,
  assertTransformer,
  assertType,
} from "./types.js";

function eql(a: unknown, b: unknown): boolean {
  return a === b;
}

const stringify = String;

export function any(): Transformer<HTMLElement, any> {
  return {
    parse(value) {
      return value;
    },
    validate(value) {
      return value;
    },
    stringify,
    eql,
  };
}

export function string(): Transformer<HTMLElement, string> {
  const fallbackValues = new WeakMap<HTMLElement, string>();
  return {
    parse(value) {
      if (value) {
        return String(value);
      }
      return fallbackValues.get(this) ?? "";
    },
    validate(value) {
      if (typeof value === "undefined") {
        return fallbackValues.get(this) ?? "";
      }
      return String(value);
    },
    stringify,
    eql,
    beforeInitCallback(_, defaultValue) {
      if (typeof defaultValue === "string") {
        fallbackValues.set(this, defaultValue);
      }
    },
  };
}

export function href(): Transformer<HTMLElement, string> {
  const valueInitialized = new WeakMap<HTMLElement, boolean>();
  return {
    parse(value) {
      if (value === null) {
        return "";
      }
      return String(value);
    },
    validate(value) {
      return String(value);
    },
    stringify: String,
    eql(oldValue, newValue) {
      if (!valueInitialized.get(this)) {
        return false;
      }
      return eql(oldValue, newValue);
    },
    get(value) {
      if (!valueInitialized.get(this)) {
        return value;
      }
      const tmp = document.createElement("a");
      tmp.href = value;
      return tmp.href;
    },
    beforeSetCallback(_, rawValue) {
      const setAsInit = rawValue !== null && typeof rawValue !== "undefined";
      valueInitialized.set(this, setAsInit);
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
    eql,
    updateAttrPredicate(_, newValue) {
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
    parse(value) {
      if (value === null) {
        return fallbackValues.get(this) ?? 0;
      }
      const asNumber = Number(value);
      if (Number.isNaN(asNumber)) {
        return fallbackValues.get(this) ?? 0;
      }
      if (asNumber <= min) {
        return min;
      }
      if (asNumber >= max) {
        return max;
      }
      return asNumber;
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
    stringify: String,
    eql,
    beforeInitCallback(_, defaultValue) {
      if (typeof defaultValue === "number") {
        fallbackValues.set(this, defaultValue);
      }
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

export function int(
  options: Partial<NumberOptions<bigint>> = {},
): Transformer<HTMLElement, bigint> {
  const fallbackValues = new WeakMap<HTMLElement, bigint>();
  const { min, max } = bigintOptions(options);
  return {
    parse(value) {
      if (isBigIntConvertible(value)) {
        try {
          const asInt = BigInt(value);
          if (typeof min !== "undefined" && asInt <= min) {
            return min;
          }
          if (typeof max !== "undefined" && asInt >= max) {
            return max;
          }
          return asInt;
        } catch {
          return fallbackValues.get(this) ?? 0n;
        }
      }
      return fallbackValues.get(this) ?? 0n;
    },
    validate(value) {
      if (typeof value === "undefined") {
        return fallbackValues.get(this) ?? 0n;
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
    stringify,
    eql,
    beforeInitCallback(_, defaultValue) {
      if (typeof defaultValue === "bigint") {
        fallbackValues.set(this, defaultValue);
      }
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
    parse(value) {
      try {
        const obj = JSON.parse(String(value), options.reviver);
        if (obj === null || typeof obj !== "object") {
          return fallbackValues.get(this);
        }
        return obj;
      } catch {
        return fallbackValues.get(this);
      }
    },
    validate(value) {
      // trigger exception if the value is not serializable
      JSON.stringify(value, options.replacer);
      return value;
    },
    stringify(value) {
      return JSON.stringify(value, options.replacer);
    },
    eql,
    beforeInitCallback(_, defaultValue) {
      if (typeof defaultValue === "object" && defaultValue !== null) {
        fallbackValues.set(this, defaultValue);
      }
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
    parse(value) {
      const parsed = options.transform.parse.call(this, value);
      if (options.values.includes(parsed)) {
        return parsed;
      }
      return fallbackValues.get(this) ?? options.values[0];
    },
    validate(value) {
      if (typeof value === "undefined") {
        return fallbackValues.get(this) ?? options.values[0];
      }
      const validated = options.transform.validate.call(this, value);
      if (options.values.includes(validated)) {
        return validated;
      }
      throw new Error(
        `Invalid value: ${options.transform.stringify.call(this, validated)}`,
      );
    },
    stringify: options.transform.stringify,
    eql: options.transform.eql,
    beforeInitCallback(_, defaultValue) {
      if (options.values.includes(defaultValue)) {
        return fallbackValues.set(this, defaultValue);
      }
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
    eql,
    beforeInitCallback(value, defaultValue, context) {
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
    },
    beforeSetCallback(value, _, context) {
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
    },
    updateAttrPredicate() {
      return false;
    },
  };
}
