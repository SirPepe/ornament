import { transformerSchema, type Transformer } from "./types";
import z from "zod";

export function string(): Transformer<HTMLElement, string> {
  let fallbackValue = "";
  return {
    parse(value) {
      if (value) {
        return String(value);
      }
      return fallbackValue;
    },
    validate(value) {
      if (typeof value === "undefined") {
        return fallbackValue;
      }
      return String(value);
    },
    stringify: String,
    beforeInitCallback(_, defaultValue) {
      if (typeof defaultValue === "string") {
        fallbackValue = defaultValue;
      }
    },
  };
}

export function href(): Transformer<HTMLElement, string> {
  const anchor = document.createElement("a");
  return {
    parse(value) {
      if (value === null) {
        value = "";
      }
      anchor.href = String(value);
      return anchor.href;
    },
    validate(value) {
      anchor.href = String(value);
      return anchor.href;
    },
    stringify: String,
  };
}

export function boolean(): Transformer<HTMLElement, boolean> {
  return {
    parse(value) {
      return value !== null;
    },
    validate: Boolean,
    stringify() {
      return "";
    },
    updateAttrPredicate(value) {
      if (value === false) {
        return null;
      }
      return true;
    },
  };
}

const numberOptionsSchema = z
  .object({
    min: z.number().optional(),
    max: z.number().optional(),
  })
  .refine(
    (value) => {
      if (
        typeof value.min === "number" &&
        typeof value.max === "number" &&
        value.min >= value.max
      ) {
        return false;
      }
      return true;
    },
    {
      message: "'Min' should be less than 'max'",
    }
  );

type NumberOptions = z.infer<typeof numberOptionsSchema>;

export function number(
  options: NumberOptions = {}
): Transformer<HTMLElement, number> {
  let fallbackValue = 0;
  const { min = -Infinity, max = Infinity } =
    numberOptionsSchema.parse(options);
  return {
    parse(value) {
      if (value === null) {
        return fallbackValue;
      }
      const asNumber = Number(value);
      if (Number.isNaN(asNumber)) {
        return fallbackValue;
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
        return fallbackValue;
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
    beforeInitCallback(_, defaultValue) {
      if (typeof defaultValue === "number") {
        fallbackValue = defaultValue;
      }
    },
  };
}

function isBigIntConvertible(
  value: unknown
): value is string | number | bigint | boolean {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "bigint" ||
    typeof value === "boolean"
  );
}

const bigintOptionsSchema = z
  .object({
    min: z.bigint().optional(),
    max: z.bigint().optional(),
  })
  .refine(
    (value) => {
      if (
        typeof value.min === "bigint" &&
        typeof value.max === "bigint" &&
        value.min >= value.max
      ) {
        return false;
      }
      return true;
    },
    {
      message: "'min' should be less than 'max'",
    }
  );

type BigIntOptions = z.infer<typeof bigintOptionsSchema>;

export function int(
  options: BigIntOptions = {}
): Transformer<HTMLElement, bigint> {
  let fallbackValue = 0n;
  const { min, max } = bigintOptionsSchema.parse(options);
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
          return fallbackValue;
        }
      }
      return fallbackValue;
    },
    validate(value) {
      if (typeof value === "undefined") {
        return fallbackValue;
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
    stringify: String,
    beforeInitCallback(_, defaultValue) {
      if (typeof defaultValue === "bigint") {
        fallbackValue = defaultValue;
      }
    },
  };
}

function reportImmutable(): never {
  throw new Error("Unable to perform update, object is immutable");
}

function immutable<T>(target: T): T {
  if (typeof target === "object" && target !== null) {
    return new Proxy(target, {
      setPrototypeOf: reportImmutable,
      preventExtensions: reportImmutable,
      defineProperty: reportImmutable,
      deleteProperty: reportImmutable,
      set: reportImmutable,
      get(target, property, receiver) {
        return immutable(Reflect.get(target, property, receiver));
      },
    });
  }
  return target;
}

export function record(): Transformer<HTMLElement, any> {
  let fallbackValue = immutable({});
  return {
    parse(value) {
      try {
        const obj = JSON.parse(String(value));
        if (obj === null || typeof obj !== "object") {
          return fallbackValue;
        }
        return immutable(obj);
      } catch {
        return fallbackValue;
      }
    },
    validate(value) {
      if (value === null || typeof value !== "object") {
        throw new TypeError(`Expected object, got ${value || typeof value}`);
      }
      return immutable(value);
    },
    stringify: JSON.stringify,
    beforeInitCallback(_, defaultValue) {
      if (typeof defaultValue === "object" && defaultValue !== null) {
        fallbackValue = immutable(defaultValue);
      }
    },
  };
}

export function object<T>(
  zodSchema: z.ZodObject<any, any, any, any, T>
): Transformer<HTMLElement, T> {
  let fallbackValue: T;
  return {
    parse(value) {
      const result = zodSchema.safeParse(JSON.parse(String(value)));
      if (result.success) {
        return result.data;
      }
      return fallbackValue;
    },
    validate(value) {
      return zodSchema.parse(value);
    },
    stringify: JSON.stringify,
    beforeInitCallback(_, defaultValue) {
      fallbackValue = zodSchema.parse(defaultValue);
    },
  };
}

const literalOptionsSchema = z.object({
  values: z.array(z.any()).nonempty(),
  transformer: transformerSchema,
});

type LiteralOptions<T extends HTMLElement, V> = {
  values: V[];
  transformer: Transformer<T, V>;
};

export function literal<T extends HTMLElement, V>(
  inputOptions: LiteralOptions<T, V>
): Transformer<T, V> {
  const options = literalOptionsSchema.parse(inputOptions);
  let fallbackValue = options.values[0];
  const validate = options.transformer.validate ?? options.transformer.parse;
  const stringify = options.transformer.stringify ?? String;
  return {
    parse(value) {
      const parsed = options.transformer.parse.call(this, value);
      if (options.values.includes(parsed)) {
        return parsed;
      }
      return fallbackValue;
    },
    validate(value) {
      if (typeof value === "undefined") {
        return fallbackValue;
      }
      const validated = validate.call(this, value);
      if (options.values.includes(validated)) {
        return validated;
      }
      throw new Error(`Invalid value: ${stringify.call(this, validated)}`);
    },
    stringify,
    beforeInitCallback(_, defaultValue) {
      if (options.values.includes(defaultValue)) {
        fallbackValue = defaultValue;
      }
    },
    updateAttrPredicate(value: V) {
      if (
        "removeAttributeOnValue" in options &&
        value === options.removeAttributeOnValue
      ) {
        return null;
      }
      return true;
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

export function eventHandler<
  T extends HTMLElement,
  E extends Event
>(): HandlerTransform<T, E> {
  let func: Handler<T, E> = null;
  function handler(this: T, evt: E) {
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
        "This function should never be called, updating event handler properties does not change the attribute value!"
      );
    },
    beforeInitCallback(value, defaultValue, context) {
      if (context.private || typeof context.name === "symbol") {
        throw new Error("Event handler name must be a non-private non-symbol");
      }
      if (!context.name.startsWith("on")) {
        throw new Error("Event handler name must start with 'on'");
      }
      if (value) {
        func = value;
        this.addEventListener(context.name.slice(2), handler as any);
      }
    },
    beforeSetCallback(value, context) {
      // If either the new handler or the old handler are falsy, the event
      // handler must be detached and then re-attached to reflect the new firing
      // order of event handlers. If both the new and old handlers are
      // functions, the swap happens in-place.
      if (!func || !value) {
        const name = (context.name as string).slice(2);
        this.removeEventListener(name, handler as any);
        this.addEventListener(name, handler as any);
      }
      func = value; // change the actual event handler
      return true;
    },
    updateAttrPredicate() {
      return false;
    },
  };
}
