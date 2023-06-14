import z from "zod";

export const transformerSchema = z.object({
  parse: z.function().args(z.unknown()),
  validate: z.function().args(z.unknown()),
  stringify: z.function().args(z.unknown()).returns(z.string()),
  updateAttrPredicate: z.function().optional(),
  beforeInitCallback: z.function().optional(),
  beforeSetCallback: z.function().optional(),
});

export type Transformer<T, V> = {
  // parse() turns unknown inputs into property values. Primarily used for
  // attribute handling. Must never throw, just like the attribute handling in
  // built-in elements.
  parse: (this: T, value: unknown) => V;
  // Validates setter inputs. May throw for invalid values, just like setters on
  // built-in elements.
  validate: (this: T, value: unknown) => V;
  // Turns property values into attributes, thereby controlling the attribute
  // representation of an accessor together with removeAttrPredicate(). Must
  // never throw.
  stringify: (this: T, value?: V | null) => string;
  // Decides if, based on a new value, an attribute gets updated to match the
  // new value (true/false) or removed (null). Defaults to a function that
  // always returns true.
  updateAttrPredicate?: (this: T, value: V) => boolean | null;
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
    context: ClassAccessorDecoratorContext<T, V>
  ) => void;
};

/* eslint-disable */
export type ClassAccessorDecorator<
  T,
  V,
  R extends ClassAccessorDecoratorResult<
    unknown,
    unknown
  > | void = ClassAccessorDecoratorResult<T, V>
> = (
  target: ClassAccessorDecoratorTarget<T, V>,
  context: ClassAccessorDecoratorContext<T, V>
) => R;
/* eslint-enable */
